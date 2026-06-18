import { requireUser } from "@/lib/apiAuth";
import { scopeWhere } from "@/lib/scope";
import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Daftar peserta sebuah kelas (read-only) — `_classroom_member` join `_member`.
 * `id` adalah cr_id kelas di `_classroom`.
 */
interface MemberRow extends RowDataPacket {
  id: number;
  nama: string | null;
  nip: string | null;
  email: string | null;
  jabatan: string | null;
  unit_kerja: string | null;
  entitas: string | null;
  level: string | null;
  phone: string | null;
  photo: string | null;
  is_verified: "0" | "1";
  nilai_post_test: number | null;
}

const nn = (v: string | null) => (v && v.trim() && v.trim().toLowerCase() !== "null" ? v.trim() : null);

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const { id } = await params;
  const crId = Number(id);
  if (!Number.isInteger(crId) || crId <= 0) {
    return Response.json({ error: "ID kelas tidak valid." }, { status: 400 });
  }

  const sc = scopeWhere(g.user, "g.group_name");
  try {
    const rows = await query<MemberRow>(
      `SELECT cm.member_id AS id,
              m.member_name AS nama, m.member_nip AS nip, m.member_email AS email,
              COALESCE(NULLIF(TRIM(m.member_jabatan), ''), NULLIF(TRIM(m.member_kel_jabatan), '')) AS jabatan,
              m.member_unit_kerja AS unit_kerja,
              g.group_name AS entitas,
              lk.nama AS level,
              m.member_phone AS phone, ep.photo_url AS photo,
              cm.is_verified, cm.nilai_post_test
         FROM _classroom_member cm
         LEFT JOIN _member m ON m.member_id = cm.member_id
         LEFT JOIN _group g ON g.group_id = m.group_id
         LEFT JOIN _member_level_karyawan lk ON lk.id = m.id_level_karyawan
         LEFT JOIN employee_photos ep ON ep.nip = m.member_nip
        WHERE cm.cr_id = ?${sc.sql ? ` AND ${sc.sql}` : ""}
        ORDER BY m.member_name ASC`,
      [crId, ...sc.params],
    );

    const members = rows.map((r) => {
      const level = nn(r.level);
      return {
        id: r.id,
        nama: nn(r.nama) ?? `Member #${r.id}`,
        nip: nn(r.nip),
        email: nn(r.email),
        jabatan: nn(r.jabatan),
        unit_kerja: nn(r.unit_kerja),
        entitas: nn(r.entitas),
        level: level && !/unknown/i.test(level) ? level : null,
        phone: nn(r.phone),
        photo: r.photo ?? null,
        verified: r.is_verified === "1",
        nilai: r.nilai_post_test && r.nilai_post_test > 0 ? Number(r.nilai_post_test) : null,
      };
    });

    return Response.json({ members });
  } catch (err) {
    console.error("class members GET error", err);
    return Response.json({ error: "Gagal memuat data peserta." }, { status: 500 });
  }
}
