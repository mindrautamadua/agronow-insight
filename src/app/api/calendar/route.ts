import { requireUser } from "@/lib/apiAuth";
import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kalender Training (read-only) — sesi/kelas pelaksanaan dari tabel legacy
 * `_classroom` (+ peserta dari `_classroom_member`). DB legacy bersifat
 * SELECT-only, jadi penjadwalan baru (POST) tidak tersedia.
 */
interface ClassRow extends RowDataPacket {
  id: number;
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
      `SELECT c.cr_id AS id, c.cr_name,
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
          AND c.cr_date_start > '1970-01-01'
        ORDER BY c.cr_date_start DESC, c.cr_id DESC`,
    );

    // Map ke bentuk TrainingSession yang dipakai UI kalender.
    const sessions = rows.map((r) => ({
      id: r.id,
      course_id: r.id,
      judul: decodeEntities(r.cr_name ?? "").trim(),
      tanggal_mulai: r.tanggal_mulai,
      tanggal_selesai: r.tanggal_selesai,
      waktu: null,
      lokasi: r.tipe_presensi ? (MODE[r.tipe_presensi] ?? null) : null,
      instruktur: null,
      kuota: null,
      status: r.status,
      course_judul: r.cat_name ? decodeEntities(r.cat_name).trim() : null,
      course_kode: null,
      kategori: r.cat_name ? decodeEntities(r.cat_name).trim() : null,
      terdaftar: Number(r.peserta),
    }));

    return Response.json({ sessions });
  } catch (err) {
    console.error("calendar GET error", err);
    return Response.json({ error: "Gagal memuat data." }, { status: 500 });
  }
}

// DB legacy read-only — penjadwalan sesi baru tidak didukung.
export async function POST() {
  return Response.json(
    { error: "Kalender bersumber dari data legacy read-only; penjadwalan baru tidak tersedia." },
    { status: 405 },
  );
}
