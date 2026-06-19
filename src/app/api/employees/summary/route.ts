import { requireUser } from "@/lib/apiAuth";
import { scopeWhere } from "@/lib/scope";
import { queryOne } from "@/lib/db";
import type { RowDataPacket } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ringkasan peserta untuk kartu summary — mengikuti seluruh filter scope yang
 * sama dengan daftar: pencarian, entitas, sub-entitas, DAN tab status
 * (aktif/nonaktif). Saat tab "aktif", kartu Nonaktif jadi 0 (dan sebaliknya).
 */
interface SummaryRow extends RowDataPacket {
  total: number;
  aktif: number;
}

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "all"; // all | aktif | nonaktif
  const entitas = (url.searchParams.get("entitas") ?? "").trim();
  const sub = (url.searchParams.get("sub") ?? "").trim();

  const where: string[] = ["TRIM(m.member_name) <> ''"];
  const params: unknown[] = [];
  if (status === "aktif") where.push("m.member_status = 'active'");
  else if (status === "nonaktif") where.push("m.member_status = 'block'");
  if (sub) {
    where.push("g.group_name = ?");
    params.push(sub);
  } else if (entitas) {
    where.push("(g.group_name = ? OR g.group_name ILIKE ?)");
    params.push(entitas, `${entitas} - %`);
  }
  if (q) {
    where.push("(m.member_name ILIKE ? OR m.member_nip ILIKE ? OR m.member_email ILIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const sc = scopeWhere(g.user, "g.group_name");
  if (sc.sql) { where.push(sc.sql); params.push(...sc.params); }

  try {
    const row = await queryOne<SummaryRow>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN m.member_status = 'active' THEN 1 ELSE 0 END) AS aktif
         FROM _member m
         LEFT JOIN _group g ON g.group_id = m.group_id
        WHERE ${where.join(" AND ")}`,
      params,
    );
    const total = Number(row?.total ?? 0);
    const aktif = Number(row?.aktif ?? 0);
    return Response.json({ total, aktif, nonaktif: Math.max(0, total - aktif) });
  } catch (err) {
    console.error("employees summary GET error", err);
    return Response.json({ error: "Gagal memuat ringkasan." }, { status: 500 });
  }
}
