import { requireUser } from "@/lib/apiAuth";
import { scopeGroupIds } from "@/lib/scope";
import { query, queryOne } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Rincian Biaya pelatihan (read-only) — realisasi biaya dari `_rekap_classroom_excel`
 * per entitas (group) + tahun, status publish. Biaya bersifat per-peserta; sesi
 * didedup via SESSION_KEY untuk metrik "sesi berbiaya / tanpa biaya".
 */
const SESSION_KEY = "r.nama_pelatihan, r.tgl_pelatihan_mulai, r.tgl_pelatihan_selesai";

interface BiayaRow extends RowDataPacket { label: string | null; biaya: number | null }

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
const clean = (v: string | null) => {
  const t = decodeEntities(v ?? "").replace(/\s+/g, " ").trim();
  return t && t.toLowerCase() !== "null" ? t : null;
};
function normLevel(v: string | null): string {
  const t = clean(v);
  if (!t || t === "#N/A" || /unknown/i.test(t)) return "Lainnya";
  return t;
}
// LPP & variannya (mis. "PT. LPP AN") digabung sebagai satu penyelenggara.
function normPenyelenggara(v: string | null): string {
  const t = clean(v);
  if (!t) return "Lainnya";
  if (/\bLPP\b/i.test(t)) return "LPP";
  return t;
}

// Group baris menjadi [{label, biaya}] terurut desc, dengan normalisasi label opsional.
function aggregate(rows: BiayaRow[], norm: (v: string | null) => string): { label: string; biaya: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const label = norm(r.label);
    map.set(label, (map.get(label) ?? 0) + Number(r.biaya ?? 0));
  }
  return [...map.entries()].map(([label, biaya]) => ({ label, biaya })).sort((a, b) => b.biaya - a.biaya);
}

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const url = new URL(request.url);
  const entitas = Number(url.searchParams.get("entitas"));
  const year = Number(url.searchParams.get("year"));
  const empty = { kpi: { totalBiaya: 0, biayaPerJpl: 0, biayaPerPeserta: 0, sesiBerbiaya: 0, sesiTanpaBiaya: 0 }, perUnit: [], perPenyelenggara: [], perLevel: [], perKategori: [] };
  if (!entitas || !year) return Response.json(empty);
  // Tolak entitas di luar cakupan user.
  const allowedIds = await scopeGroupIds(g.user);
  if (allowedIds && !allowedIds.includes(entitas)) return Response.json(empty);

  const W = "r.group_id = ? AND EXTRACT(YEAR FROM r.tgl_pelatihan_mulai)::int = ? AND r.status_data = 'publish'";
  const P = [entitas, year];

  try {
    const kpiAgg = await queryOne<RowDataPacket & { biaya: number | null; peserta: number }>(
      `SELECT SUM(r.biaya) AS biaya, COUNT(DISTINCT r.member_id) AS peserta
         FROM _rekap_classroom_excel r WHERE ${W}`, P);
    const sesAgg = await queryOne<RowDataPacket & { jpl: number | null; sesi: number; berbiaya: number; gratis: number }>(
      `SELECT SUM(s.jpl) AS jpl, COUNT(*) AS sesi,
              SUM(CASE WHEN s.biaya > 0 THEN 1 ELSE 0 END) AS berbiaya,
              SUM(CASE WHEN s.biaya = 0 OR s.biaya IS NULL THEN 1 ELSE 0 END) AS gratis
         FROM (SELECT MAX(r.jpl) AS jpl, SUM(r.biaya) AS biaya
                 FROM _rekap_classroom_excel r WHERE ${W} GROUP BY ${SESSION_KEY}) s`, P);

    const totalBiaya = Number(kpiAgg?.biaya ?? 0);
    const peserta = Number(kpiAgg?.peserta ?? 0);
    const jpl = Number(sesAgg?.jpl ?? 0);

    const unitRows = await query<BiayaRow>(
      `SELECT r.unit_kerja AS label, SUM(r.biaya) AS biaya FROM _rekap_classroom_excel r WHERE ${W} GROUP BY r.unit_kerja`, P);
    const penyRows = await query<BiayaRow>(
      `SELECT r.penyelenggara AS label, SUM(r.biaya) AS biaya FROM _rekap_classroom_excel r WHERE ${W} GROUP BY r.penyelenggara`, P);
    const levelRows = await query<BiayaRow>(
      `SELECT r.level AS label, SUM(r.biaya) AS biaya FROM _rekap_classroom_excel r WHERE ${W} GROUP BY r.level`, P);
    const katRows = await query<BiayaRow>(
      `SELECT kk.nama AS label, SUM(r.biaya) AS biaya
         FROM _rekap_classroom_excel r LEFT JOIN _learning_kategori kk ON kk.id = r.kategori
        WHERE ${W} GROUP BY r.kategori, kk.nama`, P);

    return Response.json({
      kpi: {
        totalBiaya,
        biayaPerJpl: jpl ? Math.round(totalBiaya / jpl) : 0,
        biayaPerPeserta: peserta ? Math.round(totalBiaya / peserta) : 0,
        sesiBerbiaya: Number(sesAgg?.berbiaya ?? 0),
        sesiTanpaBiaya: Number(sesAgg?.gratis ?? 0),
      },
      perUnit: aggregate(unitRows, v => clean(v) ?? "Lainnya"),
      perPenyelenggara: aggregate(penyRows, normPenyelenggara),
      perLevel: aggregate(levelRows, normLevel),
      perKategori: aggregate(katRows, v => clean(v) ?? "—"),
    });
  } catch (err) {
    console.error("biaya GET error", err);
    return Response.json({ error: "Gagal memuat rincian biaya." }, { status: 500 });
  }
}
