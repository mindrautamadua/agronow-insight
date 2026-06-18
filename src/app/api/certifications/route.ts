import { requireUser } from "@/lib/apiAuth";
import { scopeWhere } from "@/lib/scope";
import { query, queryOne } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sertifikat peserta (read-only) — diturunkan dari `_classroom_member` yang
 * punya berkas sertifikat, join `_member` (peserta) & `_classroom` (pelatihan).
 * Server-side search + paginasi (puluhan ribu baris).
 */
const PAGE_SIZE = 50;

interface CertRow extends RowDataPacket {
  id: number;
  nama: string | null;
  nip: string | null;
  sertifikat: string | null;
  sertifikat_alt: string | null;
  kategori: string | null;
  entitas: string | null;
  tanggal: string | null;
  berkas: string | null;
  is_verified: "0" | "1";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
const nn = (v: string | null) => {
  const t = v?.trim();
  return t && t !== "-" && t !== "0" && t.toLowerCase() !== "null" ? t : null;
};
const dt = (v: string | null) => (v && !v.startsWith("0000") && v > "1970-01-01" ? v.slice(0, 10) : null);

// Hanya baris yang benar-benar punya berkas sertifikat.
const HAS_CERT = "NULLIF(TRIM(cm.berkas_sertifikat), '') IS NOT NULL AND TRIM(cm.berkas_sertifikat) NOT IN ('-', '0')";

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const verified = url.searchParams.get("verified") ?? "all"; // all | verified | unverified
  const entitas = (url.searchParams.get("entitas") ?? "").trim(); // parent, "" = semua
  const sub = (url.searchParams.get("sub") ?? "").trim();         // full group_name, "" = semua sub
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const where: string[] = [HAS_CERT];
  const params: unknown[] = [];
  if (verified === "verified") where.push("cm.is_verified = '1'");
  else if (verified === "unverified") where.push("cm.is_verified <> '1'");
  if (sub) {
    where.push("g.group_name = ?");
    params.push(sub);
  } else if (entitas) {
    // Cocokkan entitas induk: nama persis ATAU berawalan "<entitas> - ".
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
  const whereSql = `WHERE ${where.join(" AND ")}`;

  try {
    const totalRow = await queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n
         FROM _classroom_member cm
         JOIN _classroom cr ON cr.cr_id = cm.cr_id
         LEFT JOIN _member m ON m.member_id = cm.member_id
         LEFT JOIN _group g ON g.group_id = m.group_id
        ${whereSql}`,
      params,
    );
    const total = totalRow?.n ?? 0;

    const rows = await query<CertRow>(
      `SELECT cm.crm_id AS id,
              m.member_name AS nama, m.member_nip AS nip,
              cr.cr_name_sertifikat AS sertifikat, cr.cr_name AS sertifikat_alt,
              cat.cat_name AS kategori,
              g.group_name AS entitas,
              cm.crm_create_date AS tanggal,
              cm.berkas_sertifikat AS berkas,
              cm.is_verified
         FROM _classroom_member cm
         JOIN _classroom cr ON cr.cr_id = cm.cr_id
         LEFT JOIN _member m ON m.member_id = cm.member_id
         LEFT JOIN _category cat ON cat.cat_id::text = cr.cat_id
         LEFT JOIN _group g ON g.group_id = m.group_id
        ${whereSql}
        ORDER BY cm.crm_create_date DESC, cm.crm_id DESC
        LIMIT ? OFFSET ?`,
      [...params, PAGE_SIZE, offset],
    );

    const certifications = rows.map((r) => ({
      id: r.id,
      nama: nn(r.nama) ?? "—",
      nip: nn(r.nip),
      sertifikat: decodeEntities(nn(r.sertifikat) ?? nn(r.sertifikat_alt) ?? "Sertifikat Pelatihan").trim(),
      kategori: nn(r.kategori) ? decodeEntities(r.kategori as string).trim() : null,
      entitas: nn(r.entitas),
      tanggal: dt(r.tanggal),
      berkas: nn(r.berkas),
      verified: r.is_verified === "1",
    }));

    return Response.json({ certifications, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
  } catch (err) {
    console.error("certifications GET error", err);
    return Response.json({ error: "Gagal memuat data." }, { status: 500 });
  }
}
