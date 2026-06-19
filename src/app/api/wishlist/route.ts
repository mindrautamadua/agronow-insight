import { requireUser } from "@/lib/apiAuth";
import { scopeGroupIds } from "@/lib/scope";
import { query, queryOne } from "@/lib/db";
import type { RowDataPacket } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Demand / Wishlist Pelatihan (read-only) — pelatihan yang diinginkan karyawan
 * (sinyal perencanaan). Dua kanal:
 *  - internal : `_learning_wishlist_v2` → `_learning_katalog` (katalog internal)
 *  - wallet   : `_learning_wallet_wishlist` → `_learning_wallet_classroom` (eksternal)
 * prioritas 1 = tertinggi, 99 = tanpa prioritas. status='aktif'.
 */
const SOURCES = {
  internal: {
    table: "_learning_wishlist_v2",
    itemJoin: "JOIN _learning_katalog it ON it.id = w.id_learning_katalog",
    yearExpr: "w.tahun",
  },
  wallet: {
    table: "_learning_wallet_wishlist",
    itemJoin: "JOIN _learning_wallet_classroom it ON it.id = w.id_lw_classroom",
    yearExpr: "EXTRACT(YEAR FROM w.tanggal)::int",
  },
} as const;

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
const clean = (v: string | null): string | null => {
  const t = decodeEntities(v ?? "").replace(/\s+/g, " ").trim();
  return t && t.toLowerCase() !== "null" ? t : null;
};

interface BarRow extends RowDataPacket { label: string | null; n: number }
interface TopRow extends RowDataPacket { label: string | null; peminat: number; prioritas: number }

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const url = new URL(request.url);
  const source = (url.searchParams.get("source") === "wallet" ? "wallet" : "internal") as keyof typeof SOURCES;
  const reqYear = Number(url.searchParams.get("year")) || 0;
  const S = SOURCES[source];

  try {
    const years = (await query<RowDataPacket & { y: number }>(
      `SELECT DISTINCT ${S.yearExpr} AS y FROM ${S.table} w
        WHERE w.status = 'aktif' AND ${S.yearExpr} > 2000 ORDER BY y DESC`,
    )).map(r => Number(r.y)).filter(Boolean);
    const year = years.includes(reqYear) ? reqYear : 0;

    const where = ["w.status = 'aktif'"];
    const P: unknown[] = [];
    if (year) { where.push(`${S.yearExpr} = ?`); P.push(year); }
    // Pembatas cakupan: batasi ke member yang group-nya termasuk scope user.
    const allowedIds = await scopeGroupIds(g.user);
    if (allowedIds) { where.push("w.id_member IN (SELECT m.member_id FROM _member m WHERE m.group_id = ANY(?))"); P.push(allowedIds); }
    const W = where.join(" AND ");

    const kpi = await queryOne<RowDataPacket & { total: number; pelatihan: number; peminat: number; prioritas: number }>(
      `SELECT COUNT(*) AS total,
              COUNT(DISTINCT it.id) AS pelatihan,
              COUNT(DISTINCT w.id_member) AS peminat,
              SUM(CASE WHEN w.prioritas BETWEEN 1 AND 3 THEN 1 ELSE 0 END) AS prioritas
         FROM ${S.table} w ${S.itemJoin} WHERE ${W}`, P);

    const topPelatihan = await query<TopRow>(
      `SELECT it.nama AS label, COUNT(*) AS peminat,
              SUM(CASE WHEN w.prioritas BETWEEN 1 AND 3 THEN 1 ELSE 0 END) AS prioritas
         FROM ${S.table} w ${S.itemJoin} WHERE ${W}
        GROUP BY it.id, it.nama ORDER BY peminat DESC LIMIT 200`, P);

    const perEntitas = await query<BarRow>(
      `SELECT gr.group_name AS label, COUNT(*) AS n
         FROM ${S.table} w
         LEFT JOIN _member m ON m.member_id = w.id_member
         LEFT JOIN _group gr ON gr.group_id = m.group_id
        WHERE ${W} AND NULLIF(TRIM(gr.group_name), '') IS NOT NULL
        GROUP BY gr.group_name ORDER BY n DESC LIMIT 12`, P);

    const byPriority = await query<BarRow>(
      `SELECT CASE WHEN w.prioritas BETWEEN 1 AND 5 THEN 'Prioritas ' || w.prioritas ELSE 'Tanpa prioritas' END AS label,
              COUNT(*) AS n FROM ${S.table} w WHERE ${W} GROUP BY 1 ORDER BY 1`, P);

    return Response.json({
      source, year, years,
      kpi: {
        total: Number(kpi?.total ?? 0),
        pelatihan: Number(kpi?.pelatihan ?? 0),
        peminat: Number(kpi?.peminat ?? 0),
        prioritasTinggi: Number(kpi?.prioritas ?? 0),
      },
      topPelatihan: topPelatihan.map(r => ({ label: clean(r.label) ?? "(Tanpa nama)", peminat: Number(r.peminat), prioritas: Number(r.prioritas) })),
      perEntitas: perEntitas.map(r => ({ label: clean(r.label) ?? "Lainnya", n: Number(r.n) })),
      byPriority: byPriority.map(r => ({ label: r.label ?? "?", n: Number(r.n) })),
    });
  } catch (err) {
    console.error("wishlist GET error", err);
    return Response.json({ error: "Gagal memuat demand pelatihan." }, { status: 500 });
  }
}
