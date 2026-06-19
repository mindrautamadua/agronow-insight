import { requireUser } from "@/lib/apiAuth";
import { scopeWhere } from "@/lib/scope";
import { query, queryOne } from "@/lib/db";
import type { RowDataPacket } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serapan Anggaran Learning Wallet (read-only) — target vs realisasi anggaran & JPL
 * per member, dari `_learning_wallet_serapan` (nama_group/level sudah denormal).
 * Difilter per TAHUN (default tahun terbaru). Nama orang dari `_member`,
 * foto dari `employee_photos`.
 */
function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
const clean = (v: string | null): string | null => {
  const t = decodeEntities(v ?? "").replace(/\s+/g, " ").trim();
  return t && t.toLowerCase() !== "null" ? t : null;
};
const norm = (v: string | null): string => clean(v) ?? "Lainnya";
const pctOf = (real: number, target: number): number | null => (target > 0 ? Math.round((100 * real / target) * 10) / 10 : null);

interface BarRow extends RowDataPacket { label: string | null; target: number; realisasi: number }
interface MemberRow extends RowDataPacket {
  id: number; nama: string | null; photo: string | null; grp: string | null; level: string | null;
  target: number; realisasi: number;
}
const bars = (rows: BarRow[]) => rows.map(r => {
  const target = Number(r.target ?? 0), realisasi = Number(r.realisasi ?? 0);
  return { label: norm(r.label), target, realisasi, pct: pctOf(realisasi, target) };
});

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const reqYear = Number(new URL(request.url).searchParams.get("year")) || 0;
  const empty = { year: 0, years: [] as number[], kpi: { target: 0, realisasi: 0, pctRp: 0, peserta: 0, jplTarget: 0, jplRealisasi: 0, pctJpl: 0 }, perEntitas: [], perLevel: [], members: [] };

  try {
    const years = (await query<RowDataPacket & { y: number }>(
      `SELECT DISTINCT tahun AS y FROM _learning_wallet_serapan WHERE tahun > 2000 ORDER BY y DESC`)).map(r => Number(r.y)).filter(Boolean);
    if (years.length === 0) return Response.json(empty);
    const year = years.includes(reqYear) ? reqYear : years[0];
    // Pembatas cakupan via kolom denormal `nama_group` (alias `s` di query member).
    const sc = scopeWhere(g.user, "nama_group");
    const scS = scopeWhere(g.user, "s.nama_group");
    const scAnd = sc.sql ? ` AND ${sc.sql}` : "";
    const P = [year, ...sc.params];

    const k = await queryOne<RowDataPacket & { peserta: number; target: number; realisasi: number; jpl_target: number; jpl_realisasi: number }>(
      `SELECT COUNT(*) AS peserta,
              COALESCE(SUM(nominal_target), 0) AS target,
              COALESCE(SUM(nominal_realisasi), 0) AS realisasi,
              COALESCE(SUM(jpl_target), 0) AS jpl_target,
              COALESCE(SUM(jpl_realisasi), 0) AS jpl_realisasi
         FROM _learning_wallet_serapan WHERE tahun = ?${scAnd}`, P);

    const perEntitas = bars(await query<BarRow>(
      `SELECT nama_group AS label, COALESCE(SUM(nominal_target), 0) AS target, COALESCE(SUM(nominal_realisasi), 0) AS realisasi
         FROM _learning_wallet_serapan WHERE tahun = ?${scAnd} GROUP BY nama_group ORDER BY target DESC NULLS LAST LIMIT 12`, P));
    const perLevel = bars(await query<BarRow>(
      `SELECT nama_level_karyawan AS label, COALESCE(SUM(nominal_target), 0) AS target, COALESCE(SUM(nominal_realisasi), 0) AS realisasi
         FROM _learning_wallet_serapan WHERE tahun = ?${scAnd} GROUP BY nama_level_karyawan ORDER BY target DESC NULLS LAST LIMIT 12`, P));

    const members = (await query<MemberRow>(
      `SELECT s.id_member AS id, m.member_name AS nama, ep.photo_url AS photo,
              s.nama_group AS grp, s.nama_level_karyawan AS level,
              COALESCE(s.nominal_target, 0) AS target, COALESCE(s.nominal_realisasi, 0) AS realisasi
         FROM _learning_wallet_serapan s
         LEFT JOIN _member m ON m.member_id = s.id_member
         LEFT JOIN employee_photos ep ON ep.nip = m.member_nip
        WHERE s.tahun = ?${scS.sql ? ` AND ${scS.sql}` : ""}
        ORDER BY s.nominal_realisasi DESC NULLS LAST, s.nominal_target DESC NULLS LAST
        LIMIT 600`, [year, ...scS.params])).map(r => {
      const target = Number(r.target ?? 0), realisasi = Number(r.realisasi ?? 0);
      return {
        id: Number(r.id), nama: clean(r.nama) ?? `Member #${r.id}`, photo: r.photo ?? null,
        grp: clean(r.grp), level: clean(r.level), target, realisasi, pct: pctOf(realisasi, target),
      };
    });

    const target = Number(k?.target ?? 0), realisasi = Number(k?.realisasi ?? 0);
    const jplTarget = Number(k?.jpl_target ?? 0), jplRealisasi = Number(k?.jpl_realisasi ?? 0);
    return Response.json({
      year, years,
      kpi: {
        target, realisasi, pctRp: pctOf(realisasi, target) ?? 0, peserta: Number(k?.peserta ?? 0),
        jplTarget, jplRealisasi, pctJpl: pctOf(jplRealisasi, jplTarget) ?? 0,
      },
      perEntitas, perLevel, members,
    });
  } catch (err) {
    console.error("serapan GET error", err);
    return Response.json({ error: "Gagal memuat data serapan anggaran." }, { status: 500 });
  }
}
