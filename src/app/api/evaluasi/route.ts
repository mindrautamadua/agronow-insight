import { requireUser } from "@/lib/apiAuth";
import { query, queryOne } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Evaluasi & Kepuasan Pelatihan (read-only) — survei NPS dari `_nps_jawab`
 * (skor 0–100). Tiga dimensi (`jenis`): narasumber · penyelenggaraan · sarana;
 * tipe internal/eksternal. Narasumber dari `_nps_set_soal.pengajar` (via set_id),
 * pelatihan dari `_classroom` (via cr_id). Filter: jenis, tipe, tahun.
 */
interface BarRow extends RowDataPacket { label: string | null; n: number; avg: number | null }

const cleanPengajar = (v: string | null): string => {
  const t = (v ?? "").replace(/_/g, " ").replace(/\s+/g, " ").trim();
  const base = t.split(/\s*:\s*/)[0].trim(); // buang " : topik"
  return base || "(Tanpa nama)";
};
function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
const cleanJudul = (v: string | null) => (v ? decodeEntities(v).replace(/\s+/g, " ").trim() || "(Tanpa nama)" : "(Tanpa nama)");

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const url = new URL(request.url);
  const jenis = (url.searchParams.get("jenis") ?? "").trim();   // ''=semua | narasumber | penyelenggaraan | sarana
  const tipe = (url.searchParams.get("tipe") ?? "").trim();     // ''=semua | internal | eksternal
  const reqYear = Number(url.searchParams.get("year")) || 0;

  try {
    const years = (await query<RowDataPacket & { y: number }>(
      `SELECT DISTINCT EXTRACT(YEAR FROM create_date)::int AS y FROM _nps_jawab
        WHERE score > 0 AND create_date > '1970-01-01' ORDER BY y DESC`,
    )).map(r => Number(r.y));
    const year = years.includes(reqYear) ? reqYear : 0;

    // WHERE dasar (tipe + tahun), dan WHERE + jenis.
    const base = ["j.score > 0"];
    const baseP: unknown[] = [];
    if (tipe) { base.push("j.tipe = ?"); baseP.push(tipe); }
    if (year) { base.push("EXTRACT(YEAR FROM j.create_date)::int = ?"); baseP.push(year); }
    const WB = base.join(" AND ");
    const W = jenis ? `${WB} AND j.jenis = ?` : WB;
    const WP = jenis ? [...baseP, jenis] : baseP;

    const kpi = await queryOne<RowDataPacket & { avg: number | null; n: number; pelatihan: number }>(
      `SELECT ROUND(AVG(j.score)::numeric, 1) AS avg, COUNT(*) AS n, COUNT(DISTINCT j.cr_id) AS pelatihan
         FROM _nps_jawab j WHERE ${W}`, WP);
    const narsumCount = await queryOne<RowDataPacket & { n: number }>(
      `SELECT COUNT(DISTINCT s.pengajar) AS n
         FROM _nps_jawab j JOIN _nps_set_soal s ON s.id = j.set_id
        WHERE ${WB} AND j.jenis = 'narasumber' AND NULLIF(TRIM(s.pengajar), '') IS NOT NULL`, baseP);

    // Skor per dimensi — selalu semua 3 (abaikan filter jenis), ikut tipe+tahun.
    const perDimensi = await query<BarRow>(
      `SELECT j.jenis AS label, COUNT(*) AS n, ROUND(AVG(j.score)::numeric, 1) AS avg
         FROM _nps_jawab j WHERE ${WB} GROUP BY j.jenis ORDER BY n DESC`, baseP);

    const internalEksternal = await query<BarRow>(
      `SELECT j.tipe AS label, COUNT(*) AS n, ROUND(AVG(j.score)::numeric, 1) AS avg
         FROM _nps_jawab j WHERE ${W} GROUP BY j.tipe ORDER BY n DESC`, WP);

    // Narasumber (selalu jenis=narasumber), min 5 responden.
    const pengajarRows = await query<BarRow>(
      `SELECT s.pengajar AS label, COUNT(*) AS n, ROUND(AVG(j.score)::numeric, 1) AS avg
         FROM _nps_jawab j JOIN _nps_set_soal s ON s.id = j.set_id
        WHERE ${WB} AND j.jenis = 'narasumber' AND NULLIF(TRIM(s.pengajar), '') IS NOT NULL
        GROUP BY s.pengajar HAVING COUNT(*) >= 5
        ORDER BY n DESC LIMIT 200`, baseP);

    // Pelatihan dinilai (jenis terpilih), min 5 responden.
    const pelatihanRows = await query<BarRow>(
      `SELECT cr.cr_name AS label, COUNT(*) AS n, ROUND(AVG(j.score)::numeric, 1) AS avg
         FROM _nps_jawab j JOIN _classroom cr ON cr.cr_id = j.cr_id
        WHERE ${W} GROUP BY cr.cr_id, cr.cr_name HAVING COUNT(*) >= 5
        ORDER BY n DESC LIMIT 200`, WP);

    const bar = (r: BarRow, f: (s: string | null) => string) => ({ label: f(r.label), n: Number(r.n), avg: Number(r.avg ?? 0) });

    return Response.json({
      jenis, tipe, year, years,
      kpi: {
        avg: Number(kpi?.avg ?? 0),
        responden: Number(kpi?.n ?? 0),
        pelatihan: Number(kpi?.pelatihan ?? 0),
        narasumber: Number(narsumCount?.n ?? 0),
      },
      perDimensi: perDimensi.map(r => ({ label: r.label ?? "?", n: Number(r.n), avg: Number(r.avg ?? 0) })),
      internalEksternal: internalEksternal.map(r => ({ label: r.label ?? "?", n: Number(r.n), avg: Number(r.avg ?? 0) })),
      pengajar: pengajarRows.map(r => bar(r, cleanPengajar)),
      pelatihan: pelatihanRows.map(r => bar(r, cleanJudul)),
    });
  } catch (err) {
    console.error("evaluasi GET error", err);
    return Response.json({ error: "Gagal memuat evaluasi." }, { status: 500 });
  }
}
