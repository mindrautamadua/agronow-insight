import { requireUser } from "@/lib/apiAuth";
import { scopeGroupIds } from "@/lib/scope";
import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pencarian JPL per karyawan (read-only) — cari seorang karyawan berdasarkan
 * NIK atau nama, lalu akumulasi total jam pelajaran (JPL) dari
 * `_rekap_classroom_excel` lintas entitas & tahun (status publish).
 *
 * JPL didedup per sesi (1 nilai per training via SESSION_KEY) agar tidak
 * terhitung berulang per baris peserta. Mengembalikan total JPL, jumlah sesi,
 * rincian per tahun, dan daftar pelatihan tiap karyawan yang cocok.
 */
const SESSION_KEY = "r.nama_pelatihan, r.tgl_pelatihan_mulai, r.tgl_pelatihan_selesai";
const MAX_RESULTS = 50;

const nn = (v: string | null) => (v && v.trim() && v.trim().toLowerCase() !== "null" ? v.trim() : null);
function normLevel(v: string | null): string | null {
  const t = (v ?? "").trim();
  if (!t || t === "#N/A" || /unknown/i.test(t)) return null;
  return t;
}
function normPenyelenggara(v: string | null): string {
  const t = nn(v);
  if (!t) return "Lainnya";
  if (/\bLPP\b/i.test(t)) return "LPP";
  return t;
}
const d = (v: string | null): string | null => (v ? String(v).slice(0, 10) : null);

interface EmpRow extends RowDataPacket {
  id: number; nama: string | null; nip: string | null;
  jabatan: string | null; unit: string | null; level: string | null;
  entitas: string | null; photo: string | null; jpl: number | null; sesi: number;
}
interface TrainRow extends RowDataPacket {
  member_id: number; pelatihan: string | null;
  tgl_mulai: string | null; tgl_selesai: string | null; year: number | null;
  penyelenggara: string | null; kategori: string | null; jpl: number | null;
}

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return Response.json({ query: q, employees: [] });

  const like = `%${q}%`;

  try {
    const allowedIds = await scopeGroupIds(g.user); // null = tanpa batas
    const scopeSql = allowedIds ? " AND r.group_id = ANY(?)" : "";
    // Karyawan yang cocok (NIK/nama) + total JPL deduped per sesi, lintas tahun & entitas.
    const empRows = await query<EmpRow>(
      `SELECT t.member_id AS id,
              MAX(t.nama) AS nama, MAX(t.nip) AS nip,
              MAX(t.jabatan) AS jabatan, MAX(t.unit) AS unit, MAX(t.level) AS level,
              MAX(t.entitas) AS entitas, MAX(t.photo) AS photo,
              SUM(t.jpl) AS jpl, COUNT(*) AS sesi
         FROM (
           SELECT r.member_id,
                  MAX(r.member_name) AS nama, MAX(r.member_nip) AS nip,
                  MAX(r.jabatan) AS jabatan, MAX(r.unit_kerja) AS unit, MAX(r.level) AS level,
                  MAX(grp.group_name) AS entitas, MAX(ep.photo_url) AS photo,
                  MAX(r.jpl) AS jpl
             FROM _rekap_classroom_excel r
             LEFT JOIN _group grp ON grp.group_id = r.group_id
             LEFT JOIN employee_photos ep ON ep.nip = r.member_nip
            WHERE r.status_data = 'publish'${scopeSql}
              AND r.member_id IN (
                SELECT DISTINCT member_id FROM _rekap_classroom_excel
                 WHERE status_data = 'publish' AND (member_nip ILIKE ? OR member_name ILIKE ?)
              )
            GROUP BY r.member_id, ${SESSION_KEY}
         ) t
        GROUP BY t.member_id
        ORDER BY jpl DESC, nama ASC
        LIMIT ${MAX_RESULTS}`,
      [...(allowedIds ? [allowedIds] : []), like, like],
    );

    const ids = empRows.map(r => Number(r.id));
    const employees = empRows.map(r => ({
      id: Number(r.id),
      nama: nn(r.nama) ?? `Member #${r.id}`,
      nip: nn(r.nip),
      jabatan: nn(r.jabatan),
      unit: nn(r.unit),
      level: normLevel(r.level),
      entitas: nn(r.entitas),
      photo: r.photo ?? null,
      jpl: Number(r.jpl ?? 0),
      sesi: Number(r.sesi ?? 0),
      perYear: [] as { year: number; jpl: number; sesi: number }[],
      trainings: [] as {
        pelatihan: string; tglMulai: string | null; tglSelesai: string | null;
        year: number | null; penyelenggara: string; kategori: string | null; jpl: number;
      }[],
    }));

    if (ids.length > 0) {
      // Rincian pelatihan (per sesi) untuk karyawan yang cocok.
      const trainRows = await query<TrainRow>(
        `SELECT r.member_id,
                r.nama_pelatihan AS pelatihan,
                r.tgl_pelatihan_mulai::date AS tgl_mulai,
                r.tgl_pelatihan_selesai::date AS tgl_selesai,
                EXTRACT(YEAR FROM r.tgl_pelatihan_mulai)::int AS year,
                MAX(r.penyelenggara) AS penyelenggara,
                MAX(kk.nama) AS kategori,
                MAX(r.jpl) AS jpl
           FROM _rekap_classroom_excel r
           LEFT JOIN _learning_kategori kk ON kk.id = r.kategori
          WHERE r.status_data = 'publish' AND r.member_id = ANY(?)${scopeSql}
          GROUP BY r.member_id, ${SESSION_KEY}, year
          ORDER BY r.tgl_pelatihan_mulai DESC, r.nama_pelatihan ASC`,
        [ids, ...(allowedIds ? [allowedIds] : [])],
      );

      const byId = new Map(employees.map(e => [e.id, e]));
      for (const r of trainRows) {
        const e = byId.get(Number(r.member_id));
        if (!e) continue;
        const jpl = Number(r.jpl ?? 0);
        const year = r.year != null ? Number(r.year) : null;
        e.trainings.push({
          pelatihan: nn(r.pelatihan) ?? "(Tanpa nama)",
          tglMulai: d(r.tgl_mulai),
          tglSelesai: d(r.tgl_selesai),
          year,
          penyelenggara: normPenyelenggara(r.penyelenggara),
          kategori: nn(r.kategori),
          jpl,
        });
        if (year != null) {
          const py = e.perYear.find(p => p.year === year);
          if (py) { py.jpl += jpl; py.sesi += 1; }
          else e.perYear.push({ year, jpl, sesi: 1 });
        }
      }
      for (const e of employees) e.perYear.sort((a, b) => b.year - a.year);
    }

    return Response.json({ query: q, employees });
  } catch (err) {
    console.error("jpl-search GET error", err);
    return Response.json({ error: "Gagal mencari JPL karyawan." }, { status: 500 });
  }
}
