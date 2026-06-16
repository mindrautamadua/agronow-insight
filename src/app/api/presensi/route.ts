import { requireUser } from "@/lib/apiAuth";
import { query, queryOne } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Kehadiran / Presensi (read-only) — check-in peserta dari `_classroom_attendance`
 * (stat='in') join `_classroom`. Tingkat kehadiran per kelas = peserta hadir /
 * peserta terdaftar (`_classroom_member`). Channel: android/ios/cms.
 */
const ENROLLED = "(SELECT cr_id, COUNT(DISTINCT member_id) AS enrolled FROM _classroom_member GROUP BY cr_id)";

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
const clean = (v: string | null): string | null => {
  const t = decodeEntities(v ?? "").replace(/\s+/g, " ").trim();
  return t && t.toLowerCase() !== "null" ? t : null;
};

interface BarRow extends RowDataPacket { label: string | null; n: number }
interface KelasRow extends RowDataPacket { label: string | null; enrolled: number; hadir: number }

export async function GET() {
  const g = await requireUser();
  if ("response" in g) return g.response;

  try {
    const kpi = await queryOne<RowDataPacket & { kelas: number; hadir: number; checkin: number }>(
      `SELECT COUNT(DISTINCT cr_id) AS kelas, COUNT(DISTINCT member_id) AS hadir, COUNT(*) AS checkin
         FROM _classroom_attendance WHERE stat = 'in'`);

    const rateAgg = await queryOne<RowDataPacket & { avg_rate: number | null }>(
      `SELECT ROUND(AVG(LEAST(100, rate))::numeric, 1) AS avg_rate FROM (
         SELECT COUNT(DISTINCT a.member_id)::float / NULLIF(cm.enrolled, 0) * 100 AS rate
           FROM _classroom_attendance a LEFT JOIN ${ENROLLED} cm ON cm.cr_id = a.cr_id
          WHERE a.stat = 'in' GROUP BY a.cr_id, cm.enrolled
       ) t WHERE rate IS NOT NULL`);

    const perChannel = await query<BarRow>(
      `SELECT cra_channel AS label, COUNT(*) AS n FROM _classroom_attendance WHERE stat = 'in' GROUP BY cra_channel ORDER BY n DESC`);

    const rateBuckets = await query<BarRow>(
      `SELECT CASE WHEN rate >= 90 THEN '≥90%' WHEN rate >= 75 THEN '75–89%'
                   WHEN rate >= 50 THEN '50–74%' ELSE '<50%' END AS label, COUNT(*) AS n FROM (
         SELECT LEAST(100, COUNT(DISTINCT a.member_id)::float / NULLIF(cm.enrolled, 0) * 100) AS rate
           FROM _classroom_attendance a LEFT JOIN ${ENROLLED} cm ON cm.cr_id = a.cr_id
          WHERE a.stat = 'in' GROUP BY a.cr_id, cm.enrolled
       ) t WHERE rate IS NOT NULL GROUP BY 1`);

    const perKelas = await query<KelasRow>(
      `SELECT cr.cr_name AS label, COALESCE(cm.enrolled, 0) AS enrolled, COUNT(DISTINCT a.member_id) AS hadir
         FROM _classroom_attendance a
         JOIN _classroom cr ON cr.cr_id = a.cr_id
         LEFT JOIN ${ENROLLED} cm ON cm.cr_id = a.cr_id
        WHERE a.stat = 'in'
        GROUP BY cr.cr_id, cr.cr_name, cm.enrolled
        ORDER BY hadir DESC LIMIT 200`);

    // Presensi v2 (`_classroom2_presensi`, 2025–2026) — kolom `hadir` menyimpan
    // MODE kehadiran (online/offline) bagi peserta yang hadir.
    const v2 = await queryOne<RowDataPacket & { rekam: number; peserta: number; sesi: number }>(
      `SELECT COUNT(*) AS rekam, COUNT(DISTINCT id_member) AS peserta, COUNT(DISTINCT id_jadwal) AS sesi
         FROM _classroom2_presensi WHERE NULLIF(TRIM(hadir), '') IS NOT NULL`);
    const v2Modus = await query<BarRow>(
      `SELECT hadir AS label, COUNT(*) AS n FROM _classroom2_presensi
        WHERE NULLIF(TRIM(hadir), '') IS NOT NULL GROUP BY hadir ORDER BY n DESC`);

    const RATE_ORDER = ["≥90%", "75–89%", "50–74%", "<50%"];
    return Response.json({
      kpi: {
        kelas: Number(kpi?.kelas ?? 0),
        hadir: Number(kpi?.hadir ?? 0),
        checkin: Number(kpi?.checkin ?? 0),
        avgRate: Number(rateAgg?.avg_rate ?? 0),
      },
      perChannel: perChannel.map(r => ({ label: clean(r.label) ?? "lainnya", n: Number(r.n) })),
      rateBuckets: rateBuckets
        .map(r => ({ label: r.label ?? "?", n: Number(r.n) }))
        .sort((a, b) => RATE_ORDER.indexOf(a.label) - RATE_ORDER.indexOf(b.label)),
      perKelas: perKelas.map(r => {
        const enrolled = Number(r.enrolled), hadir = Number(r.hadir);
        const rate = enrolled > 0 ? Math.min(100, Math.round((hadir / enrolled) * 1000) / 10) : null;
        return { label: clean(r.label) ?? "(Tanpa nama)", enrolled, hadir, rate };
      }),
      presensiV2: {
        rekam: Number(v2?.rekam ?? 0), peserta: Number(v2?.peserta ?? 0), sesi: Number(v2?.sesi ?? 0),
        modus: v2Modus.map(r => ({ label: clean(r.label) ?? "lainnya", n: Number(r.n) })),
      },
    });
  } catch (err) {
    console.error("presensi GET error", err);
    return Response.json({ error: "Gagal memuat presensi." }, { status: 500 });
  }
}
