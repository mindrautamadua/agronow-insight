import { requireUser } from "@/lib/apiAuth";
import { scopeGroupIds } from "@/lib/scope";
import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daftar Pelatihan (read-only) — realisasi pelatihan dari `_rekap_classroom_excel`
 * per entitas (group) + tahun, status publish. Dua sudut pandang:
 *  - Per Pelatihan: 1 baris per sesi (dedup via SESSION_KEY), JPL = MAX (1 nilai
 *    per training), peserta = COUNT DISTINCT member, biaya = SUM seluruh baris.
 *  - Per Peserta: 1 baris per member per sesi (biaya = SUM baris member tsb).
 * Tiap pelatihan diberi `flags` heuristik "data janggal" (biaya/JPL/tanggal) agar
 * baris hasil salah input gampang ditelusuri.
 */
const SESSION_KEY = "r.nama_pelatihan, r.tgl_pelatihan_mulai, r.tgl_pelatihan_selesai";

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
const clean = (v: string | null): string | null => {
  const t = decodeEntities(v ?? "").replace(/\s+/g, " ").trim();
  return t && t.toLowerCase() !== "null" ? t : null;
};
// LPP & variannya (mis. "PT. LPP AN") digabung sebagai satu penyelenggara.
function normPenyelenggara(v: string | null): string {
  const t = clean(v);
  if (!t) return "Lainnya";
  if (/\bLPP\b/i.test(t)) return "LPP";
  return t;
}

// Rentang hari sesi (inklusif), atau null bila tanggal mulai kosong.
function spanHari(mulai: string | null, selesai: string | null): number | null {
  if (!mulai) return null;
  const a = Date.parse(mulai), b = Date.parse(selesai || mulai);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000) + 1;
}

// Heuristik "data janggal" — kemungkinan salah input. Sesuai banner: biaya/JPL/tanggal.
// Catatan: biaya = 0 itu sah (banyak webinar/seminar gratis), jadi tidak ditandai.
function flagsFor(t: { jpl: number; biaya: number; tglMulai: string | null; tglSelesai: string | null }): string[] {
  const f: string[] = [];
  const span = spanHari(t.tglMulai, t.tglSelesai);
  // JPL
  if (!t.jpl) f.push("JPL kosong");
  else if (t.jpl > 300) f.push("JPL janggal");
  else if (span !== null && span >= 3 && t.jpl < span) f.push("JPL vs durasi"); // <1 JPL/hari utk sesi multi-hari
  // Tanggal
  if (!t.tglMulai) f.push("Tanggal kosong");
  else if (t.tglSelesai && t.tglSelesai < t.tglMulai) f.push("Tanggal terbalik");
  // Biaya — outlier biaya per JPL (hanya untuk yang berbiaya)
  if (t.biaya > 0 && t.jpl > 0 && t.biaya / t.jpl > 10_000_000) f.push("Biaya/JPL janggal");
  return f;
}

interface TrainRow extends RowDataPacket {
  pelatihan: string | null; tgl_mulai: string | null; tgl_selesai: string | null;
  penyelenggara: string | null; kategori: string | null; sub: string | null;
  jpl: number | null; peserta: number; biaya: number | null;
}
interface PesertaRow extends RowDataPacket {
  member_id: number; nama: string | null; nip: string | null; unit: string | null; level: string | null;
  pelatihan: string | null; tgl_mulai: string | null; tgl_selesai: string | null;
  penyelenggara: string | null; kategori: string | null; sub: string | null; jpl: number | null; biaya: number | null;
  photo: string | null;
}

const d = (v: string | null): string | null => (v ? String(v).slice(0, 10) : null);
// Subkelompok metode belajar 70-20-10 (kolom `_learning_kategori.kategori`).
// Hanya 3 nilai ini yang dipakai untuk drill-down; selain itu → null.
const SUB_KEYS = new Set(["metode_belajar70", "metode_belajar20", "metode_belajar10"]);
const subKey = (v: string | null): string | null => (v && SUB_KEYS.has(v) ? v : null);

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const url = new URL(request.url);
  const entitas = Number(url.searchParams.get("entitas"));
  const year = Number(url.searchParams.get("year"));
  const empty = { trainings: [], peserta: [], categories: [] };
  if (!entitas || !year) return Response.json(empty);
  const allowedIds = await scopeGroupIds(g.user);
  if (allowedIds && !allowedIds.includes(entitas)) return Response.json(empty);

  const W = "r.group_id = ? AND EXTRACT(YEAR FROM r.tgl_pelatihan_mulai)::int = ? AND r.status_data = 'publish'";
  const P = [entitas, year];

  try {
    const trainRows = await query<TrainRow>(
      `SELECT r.nama_pelatihan AS pelatihan,
              r.tgl_pelatihan_mulai::date AS tgl_mulai,
              r.tgl_pelatihan_selesai::date AS tgl_selesai,
              MAX(r.penyelenggara) AS penyelenggara,
              MAX(kk.nama) AS kategori,
              MAX(kk.kategori) AS sub,
              MAX(r.jpl) AS jpl,
              COUNT(DISTINCT r.member_id) AS peserta,
              SUM(r.biaya) AS biaya
         FROM _rekap_classroom_excel r
         LEFT JOIN _learning_kategori kk ON kk.id = r.kategori
        WHERE ${W}
        GROUP BY ${SESSION_KEY}
        ORDER BY r.tgl_pelatihan_mulai DESC, r.nama_pelatihan ASC`, P);

    const trainings = trainRows.map((r, i) => {
      const base = {
        id: `t${i}`,
        pelatihan: clean(r.pelatihan) ?? "(Tanpa nama)",
        tglMulai: d(r.tgl_mulai),
        tglSelesai: d(r.tgl_selesai),
        penyelenggara: normPenyelenggara(r.penyelenggara),
        kategori: clean(r.kategori),
        sub: subKey(r.sub),
        jpl: Number(r.jpl ?? 0),
        peserta: Number(r.peserta ?? 0),
        biaya: Number(r.biaya ?? 0),
      };
      return { ...base, flags: flagsFor(base) };
    });

    // Identitas peserta (nama/NIK/unit/level) dari master `_member`, bukan kolom
    // snapshot rekap yang tidak ternormalisasi. Fallback ke rekap bila orphan.
    const pesertaRows = await query<PesertaRow>(
      `SELECT r.member_id,
              COALESCE(MAX(m.member_name), MAX(r.member_name)) AS nama,
              COALESCE(MAX(m.member_nip), MAX(r.member_nip)) AS nip,
              COALESCE(MAX(m.member_unit_kerja), MAX(r.unit_kerja)) AS unit,
              COALESCE(MAX(lk.nama), MAX(r.level)) AS level,
              r.nama_pelatihan AS pelatihan,
              r.tgl_pelatihan_mulai::date AS tgl_mulai,
              r.tgl_pelatihan_selesai::date AS tgl_selesai,
              MAX(r.penyelenggara) AS penyelenggara,
              MAX(kk.nama) AS kategori, MAX(kk.kategori) AS sub,
              MAX(r.jpl) AS jpl, SUM(r.biaya) AS biaya, MAX(ep.photo_url) AS photo
         FROM _rekap_classroom_excel r
         LEFT JOIN _member m ON m.member_id = r.member_id
         LEFT JOIN _member_level_karyawan lk ON lk.id = m.id_level_karyawan
         LEFT JOIN _learning_kategori kk ON kk.id = r.kategori
         LEFT JOIN employee_photos ep ON ep.nip = COALESCE(m.member_nip, r.member_nip)
        WHERE ${W}
        GROUP BY r.member_id, ${SESSION_KEY}
        ORDER BY r.tgl_pelatihan_mulai DESC, nama ASC`, P);

    const peserta = pesertaRows.map((r, i) => ({
      id: `p${i}`,
      memberId: Number(r.member_id),
      nama: clean(r.nama) ?? `Member #${r.member_id}`,
      nip: clean(r.nip),
      unit: clean(r.unit),
      level: clean(r.level),
      pelatihan: clean(r.pelatihan) ?? "(Tanpa nama)",
      tglMulai: d(r.tgl_mulai),
      tglSelesai: d(r.tgl_selesai),
      penyelenggara: normPenyelenggara(r.penyelenggara),
      kategori: clean(r.kategori),
      sub: subKey(r.sub),
      jpl: Number(r.jpl ?? 0),
      biaya: Number(r.biaya ?? 0),
      photo: r.photo ?? null,
    }));

    const categories = [...new Set(trainings.map(t => t.kategori).filter((v): v is string => !!v))].sort((a, b) => a.localeCompare(b));

    return Response.json({ trainings, peserta, categories });
  } catch (err) {
    console.error("daftar GET error", err);
    return Response.json({ error: "Gagal memuat daftar pelatihan." }, { status: 500 });
  }
}
