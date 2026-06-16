import { requireUser } from "@/lib/apiAuth";
import { query, queryOne } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Karyawan/peserta (read-only) — master `_member` (±53rb baris), join entitas
 * (`_group`) & level karyawan (`_member_level_karyawan`). Server-side search +
 * paginasi karena datanya besar.
 */
const PAGE_SIZE = 50;

interface MemberRow extends RowDataPacket {
  id: number;
  nama: string | null;
  nip: string | null;
  email: string | null;
  jabatan: string | null;
  unit_kerja: string | null;
  kota: string | null;
  entitas: string | null;
  level: string | null;
  phone: string | null;
  photo: string | null;
  status: "active" | "block";
  tanggal_masuk: string | null;
}

const nn = (v: string | null) => (v && v.trim() && v.trim().toLowerCase() !== "null" ? v.trim() : null);
const dt = (v: string | null) => (v && !v.startsWith("0000") && v > "1970-01-01" ? v : null);

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const status = url.searchParams.get("status") ?? "all"; // all | aktif | nonaktif
  const entitas = (url.searchParams.get("entitas") ?? "").trim(); // "" = semua entitas
  const sub = (url.searchParams.get("sub") ?? "").trim(); // group_name spesifik (sub-entitas)
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const where: string[] = ["TRIM(m.member_name) <> ''"];
  const params: unknown[] = [];
  if (status === "aktif") where.push("m.member_status = 'active'");
  else if (status === "nonaktif") where.push("m.member_status = 'block'");
  // Sub-entitas (group_name penuh) lebih spesifik daripada entitas (prefix).
  if (sub) { where.push("g.group_name = ?"); params.push(sub); }
  else if (entitas) { where.push("(g.group_name = ? OR g.group_name ILIKE ?)"); params.push(entitas, `${entitas} - %`); }
  if (q) {
    where.push("(m.member_name ILIKE ? OR m.member_nip ILIKE ? OR m.member_email ILIKE ?)");
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  const whereSql = `WHERE ${where.join(" AND ")}`;

  try {
    const totalRow = await queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM _member m
         LEFT JOIN _group g ON g.group_id = m.group_id
        ${whereSql}`, params,
    );
    const total = totalRow?.n ?? 0;

    const rows = await query<MemberRow>(
      `SELECT m.member_id AS id, m.member_name AS nama, m.member_nip AS nip, m.member_email AS email,
              COALESCE(NULLIF(TRIM(m.member_jabatan), ''), NULLIF(TRIM(m.member_kel_jabatan), '')) AS jabatan,
              m.member_unit_kerja AS unit_kerja, m.member_city AS kota,
              g.group_name AS entitas, lk.nama AS level,
              m.member_phone AS phone, m.member_status AS status,
              m.date_masuk_kerja AS tanggal_masuk, ep.photo_url AS photo
         FROM _member m
         LEFT JOIN _group g ON g.group_id = m.group_id
         LEFT JOIN _member_level_karyawan lk ON lk.id = m.id_level_karyawan
         LEFT JOIN employee_photos ep ON ep.nip = m.member_nip
         ${whereSql}
        ORDER BY m.member_name ASC
        LIMIT ? OFFSET ?`,
      [...params, PAGE_SIZE, offset],
    );

    const employees = rows.map((r) => {
      const level = nn(r.level);
      return {
        id: r.id,
        nip: nn(r.nip) ?? "—",
        nama: nn(r.nama) ?? `Member #${r.id}`,
        email: nn(r.email),
        jabatan: nn(r.jabatan),
        departemen: nn(r.unit_kerja),
        lokasi: nn(r.kota),
        entitas: nn(r.entitas),
        level: level && !/unknown/i.test(level) ? level : null,
        phone: nn(r.phone),
        photo: r.photo ?? null,
        tanggal_masuk: dt(r.tanggal_masuk),
        status: r.status === "block" ? "nonaktif" : "aktif",
      };
    });

    return Response.json({ employees, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) });
  } catch (err) {
    console.error("employees GET error", err);
    return Response.json({ error: "Gagal memuat data." }, { status: 500 });
  }
}
