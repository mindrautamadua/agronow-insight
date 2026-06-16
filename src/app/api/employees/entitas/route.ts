import { requireUser } from "@/lib/apiAuth";
import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Hierarki entitas untuk filter peserta. `group_name` berpola
 * "<Entitas> - <Sub-entitas>" (mis. "PTPN IV - Regional 2"), jadi entitas =
 * bagian sebelum " - ", sub-entitas = sisanya.
 */
interface Row extends RowDataPacket { grp: string; total: number }

const SEP = " - ";

export async function GET() {
  const g = await requireUser();
  if ("response" in g) return g.response;
  try {
    const rows = await query<Row>(
      `SELECT g.group_name AS grp, COUNT(*) AS total
         FROM _member m
         JOIN _group g ON g.group_id = m.group_id
        WHERE TRIM(m.member_name) <> '' AND NULLIF(TRIM(g.group_name), '') IS NOT NULL
        GROUP BY g.group_name`,
    );

    // Bangun pohon entitas → sub-entitas.
    const map = new Map<string, { nama: string; total: number; subs: { nama: string; group: string; total: number }[] }>();
    for (const r of rows) {
      const grp = r.grp.trim();
      const total = Number(r.total);
      const idx = grp.indexOf(SEP);
      const parent = idx >= 0 ? grp.slice(0, idx).trim() : grp;
      const subNama = idx >= 0 ? grp.slice(idx + SEP.length).trim() : null;
      let node = map.get(parent);
      if (!node) { node = { nama: parent, total: 0, subs: [] }; map.set(parent, node); }
      node.total += total;
      if (subNama) node.subs.push({ nama: subNama, group: grp, total });
    }

    const entitas = [...map.values()]
      .map(e => ({ ...e, subs: e.subs.sort((a, b) => b.total - a.total) }))
      .sort((a, b) => b.total - a.total);

    return Response.json({ entitas });
  } catch (err) {
    console.error("employees entitas GET error", err);
    return Response.json({ error: "Gagal memuat entitas." }, { status: 500 });
  }
}
