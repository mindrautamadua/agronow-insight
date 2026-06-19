import { requireUser } from "@/lib/apiAuth";
import { scopeGroupIds } from "@/lib/scope";
import { query } from "@/lib/db";
import type { RowDataPacket } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Capaian JPL per karyawan (read-only) — realisasi JPL tiap member dari
 * `_rekap_classroom_excel`, difilter per entitas (group) + tahun, status publish.
 * JPL didedup per sesi (1 nilai per training) agar tidak terhitung berulang.
 * Target normatif 40 JPL/tahun.
 */
const TARGET = 40;
const SESSION_KEY = "r.nama_pelatihan, r.tgl_pelatihan_mulai, r.tgl_pelatihan_selesai";

interface Row extends RowDataPacket {
  id: number; nama: string | null; nip: string | null;
  jabatan: string | null; unit: string | null; level: string | null;
  jpl: number | null; sesi: number; photo: string | null;
}

function normLevel(v: string | null): string | null {
  const t = (v ?? "").trim();
  if (!t || t === "#N/A" || /unknown/i.test(t)) return null;
  return t;
}
const nn = (v: string | null) => (v && v.trim() && v.trim().toLowerCase() !== "null" ? v.trim() : null);

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const url = new URL(request.url);
  const entitas = Number(url.searchParams.get("entitas"));
  const year = Number(url.searchParams.get("year"));
  if (!entitas || !year) {
    return Response.json({ target: TARGET, employees: [] });
  }
  const allowedIds = await scopeGroupIds(g.user);
  if (allowedIds && !allowedIds.includes(entitas)) {
    return Response.json({ target: TARGET, employees: [] });
  }

  try {
    // Realisasi JPL per member (yang punya rekam pelatihan tahun & entitas ini).
    const rows = await query<Row>(
      `SELECT t.member_id AS id,
              MAX(t.nama) AS nama, MAX(t.nip) AS nip,
              MAX(t.jabatan) AS jabatan, MAX(t.unit) AS unit, MAX(t.level) AS level,
              SUM(t.jpl) AS jpl, COUNT(*) AS sesi, MAX(t.photo) AS photo
         FROM (
           -- Identitas (nama/NIK/jabatan/unit/level) diambil dari master _member,
           -- bukan kolom snapshot rekap yang tidak ternormalisasi. Fallback ke rekap
           -- hanya bila member_id tak ada di _member.
           SELECT r.member_id,
                  COALESCE(MAX(m.member_name), MAX(r.member_name)) AS nama,
                  COALESCE(MAX(m.member_nip), MAX(r.member_nip)) AS nip,
                  COALESCE(NULLIF(TRIM(MAX(m.member_jabatan)), ''),
                           NULLIF(TRIM(MAX(m.member_kel_jabatan)), ''),
                           MAX(r.jabatan)) AS jabatan,
                  COALESCE(MAX(m.member_unit_kerja), MAX(r.unit_kerja)) AS unit,
                  COALESCE(MAX(lk.nama), MAX(r.level)) AS level,
                  MAX(r.jpl) AS jpl, MAX(ep.photo_url) AS photo
             FROM _rekap_classroom_excel r
             LEFT JOIN _member m ON m.member_id = r.member_id
             LEFT JOIN _member_level_karyawan lk ON lk.id = m.id_level_karyawan
             LEFT JOIN employee_photos ep ON ep.nip = COALESCE(m.member_nip, r.member_nip)
            WHERE r.group_id = ? AND EXTRACT(YEAR FROM r.tgl_pelatihan_mulai)::int = ? AND r.status_data = 'publish'
            GROUP BY r.member_id, ${SESSION_KEY}
         ) t
        GROUP BY t.member_id
        ORDER BY jpl DESC, nama ASC`,
      [entitas, year],
    );

    const byId = new Map<number, ReturnType<typeof toEmp>>();
    function toEmp(r: Row) {
      return {
        id: r.id,
        nama: nn(r.nama) ?? `Member #${r.id}`,
        nip: nn(r.nip),
        jabatan: nn(r.jabatan),
        unit: nn(r.unit),
        level: normLevel(r.level),
        jpl: Number(r.jpl ?? 0),
        sesi: Number(r.sesi),
        photo: r.photo ?? null,
      };
    }
    for (const r of rows) byId.set(r.id, toEmp(r));

    // Roster aktif entitas — peserta dengan 0 JPL (belum ikut pelatihan apa pun).
    const roster = await query<RowDataPacket & {
      id: number; nama: string | null; nip: string | null; jabatan: string | null; unit: string | null; level: string | null; photo: string | null;
    }>(
      `SELECT m.member_id AS id, m.member_name AS nama, m.member_nip AS nip,
              COALESCE(NULLIF(TRIM(m.member_jabatan), ''), NULLIF(TRIM(m.member_kel_jabatan), '')) AS jabatan,
              m.member_unit_kerja AS unit, lk.nama AS level, ep.photo_url AS photo
         FROM _member m
         LEFT JOIN _member_level_karyawan lk ON lk.id = m.id_level_karyawan
         LEFT JOIN employee_photos ep ON ep.nip = m.member_nip
        WHERE m.group_id = ? AND m.member_status = 'active' AND TRIM(m.member_name) <> ''`,
      [entitas],
    );
    for (const r of roster) {
      if (byId.has(r.id)) continue;
      byId.set(r.id, {
        id: r.id, nama: nn(r.nama) ?? `Member #${r.id}`, nip: nn(r.nip),
        jabatan: nn(r.jabatan), unit: nn(r.unit), level: normLevel(r.level), jpl: 0, sesi: 0,
        photo: r.photo ?? null,
      });
    }

    const employees = [...byId.values()].sort((a, b) => b.jpl - a.jpl || a.nama.localeCompare(b.nama));

    return Response.json({ target: TARGET, employees });
  } catch (err) {
    console.error("capaian GET error", err);
    return Response.json({ error: "Gagal memuat capaian JPL." }, { status: 500 });
  }
}
