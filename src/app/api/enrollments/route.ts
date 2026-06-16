import { requireUser } from "@/lib/apiAuth";
import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Enrollment Class (read-only) — kelas/batch pelaksanaan training dari tabel
 * legacy `_classroom`. Jumlah peserta diambil dari `_classroom_member`.
 * Status diturunkan dari jadwal (terjadwal/berlangsung/selesai) relatif CURDATE.
 */
interface ClassRow extends RowDataPacket {
  id: number;
  cr_kode: string | null;
  cr_name: string;
  cat_name: string | null;
  tipe_presensi: "" | "full_online" | "full_offline" | "hybrid";
  tanggal_mulai: string | null;
  tanggal_selesai: string | null;
  peserta: number;
  status: "terjadwal" | "berlangsung" | "selesai";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}

const MODE: Record<string, string> = {
  full_online: "online", full_offline: "offline", hybrid: "hybrid",
};

export async function GET() {
  const g = await requireUser();
  if ("response" in g) return g.response;
  try {
    const rows = await query<ClassRow>(
      `SELECT c.cr_id AS id, c.cr_kode, c.cr_name,
              cat.cat_name,
              c.cr_date_start::date AS tanggal_mulai,
              c.cr_date_end::date   AS tanggal_selesai,
              c.tipe_presensi,
              COALESCE(mc.n, 0) AS peserta,
              CASE
                WHEN c.cr_date_end   IS NOT NULL AND c.cr_date_end::date   < CURRENT_DATE THEN 'selesai'
                WHEN c.cr_date_start IS NOT NULL AND c.cr_date_start::date > CURRENT_DATE THEN 'terjadwal'
                ELSE 'berlangsung'
              END AS status
         FROM _classroom c
         LEFT JOIN _category cat ON cat.cat_id::text = c.cat_id
         LEFT JOIN (SELECT cr_id, COUNT(*) AS n FROM _classroom_member GROUP BY cr_id) mc
                ON mc.cr_id = c.cr_id
        WHERE c.cr_status <> 'hapus'
        ORDER BY c.cr_date_start DESC, c.cr_id DESC`,
    );

    const classes = rows.map((r) => ({
      id: r.id,
      kode: `CR-${r.id}`,
      judul: decodeEntities(r.cr_name ?? "").trim(),
      kategori: r.cat_name ? decodeEntities(r.cat_name).trim() : null,
      mode: r.tipe_presensi ? (MODE[r.tipe_presensi] ?? null) : null,
      tanggal_mulai: r.tanggal_mulai,
      tanggal_selesai: r.tanggal_selesai,
      peserta: Number(r.peserta),
      status: r.status,
    }));

    return Response.json({ classes });
  } catch (err) {
    console.error("enrollments GET error", err);
    return Response.json({ error: "Gagal memuat data." }, { status: 500 });
  }
}
