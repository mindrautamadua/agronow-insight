import { requireUser } from "@/lib/apiAuth";
import { scopeWhere } from "@/lib/scope";
import { queryOne } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ringkasan sertifikat untuk kartu summary — mengikuti seluruh filter scope yang
 * sama dengan daftar: pencarian, entitas, sub-entitas, DAN tab verifikasi.
 * Saat tab "Terverifikasi", kartu Belum jadi 0 (dan sebaliknya).
 */
const HAS_CERT = "NULLIF(TRIM(cm.berkas_sertifikat), '') IS NOT NULL AND TRIM(cm.berkas_sertifikat) NOT IN ('-', '0')";

interface SummaryRow extends RowDataPacket {
  total: number;
  verified: number;
}

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const verified = url.searchParams.get("verified") ?? "all"; // all | verified | unverified
  const entitas = (url.searchParams.get("entitas") ?? "").trim();
  const sub = (url.searchParams.get("sub") ?? "").trim();

  const where: string[] = [HAS_CERT];
  const params: unknown[] = [];
  if (verified === "verified") where.push("cm.is_verified = '1'");
  else if (verified === "unverified") where.push("cm.is_verified <> '1'");
  if (sub) {
    where.push("g.group_name = ?");
    params.push(sub);
  } else if (entitas) {
    where.push("(g.group_name = ? OR g.group_name ILIKE ?)");
    params.push(entitas, `${entitas} - %`);
  }
  if (q) {
    where.push("(m.member_name ILIKE ? OR m.member_nip ILIKE ? OR cr.cr_name ILIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const sc = scopeWhere(g.user, "g.group_name");
  if (sc.sql) { where.push(sc.sql); params.push(...sc.params); }

  try {
    const row = await queryOne<SummaryRow>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN cm.is_verified = '1' THEN 1 ELSE 0 END) AS verified
         FROM _classroom_member cm
         JOIN _classroom cr ON cr.cr_id = cm.cr_id
         LEFT JOIN _member m ON m.member_id = cm.member_id
         LEFT JOIN _group g ON g.group_id = m.group_id
        WHERE ${where.join(" AND ")}`,
      params,
    );
    const total = Number(row?.total ?? 0);
    const verified = Number(row?.verified ?? 0);
    return Response.json({ total, verified, unverified: Math.max(0, total - verified) });
  } catch (err) {
    console.error("certifications summary GET error", err);
    return Response.json({ error: "Gagal memuat ringkasan." }, { status: 500 });
  }
}
