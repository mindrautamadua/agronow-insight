import { requireUser } from "@/lib/apiAuth";
import { query, queryOne } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Project Assignment (read-only) — penugasan proyek pasca-pelatihan (learning 70%/
 * on-the-job) dari `_project_assignment`. Join `_member` (peserta & atasan) dan
 * `_classroom` (pelatihan asal). Status: open/draft/progress/final + progress 0–100.
 */
const STATUS_LABEL: Record<string, string> = {
  open: "Belum mulai", draft: "Draft", progress: "Berjalan", final: "Selesai",
};
const statusLabel = (s: string | null) => STATUS_LABEL[(s ?? "").toLowerCase()] ?? "Lainnya";

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
const clean = (v: string | null): string | null => {
  const t = decodeEntities(v ?? "").replace(/\s+/g, " ").trim();
  return t && t.toLowerCase() !== "null" ? t : null;
};

interface BarRow extends RowDataPacket { label: string | null; n: number }
interface PaRow extends RowDataPacket {
  id: number; nama: string | null; nip: string | null; jabatan: string | null; atasan: string | null;
  pelatihan: string | null; problem: string | null; target: string | null; uom: string | null;
  progress: number | null; status: string | null; tgl: string | null;
}

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const url = new URL(request.url);
  const status = (url.searchParams.get("status") ?? "").trim(); // ''=semua | open | progress | draft | final

  try {
    const kpi = await queryOne<RowDataPacket & {
      total: number; peserta: number; pelatihan: number; avg: number | null; berjalan: number; selesai: number;
    }>(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT member_id) AS peserta, COUNT(DISTINCT cr_id) AS pelatihan,
              ROUND(AVG(pa_progress)::numeric, 1) AS avg,
              SUM(CASE WHEN pa_status = 'progress' THEN 1 ELSE 0 END) AS berjalan,
              SUM(CASE WHEN pa_status = 'final' OR pa_progress >= 100 THEN 1 ELSE 0 END) AS selesai
         FROM _project_assignment`);

    const byStatus = await query<BarRow>(
      `SELECT pa_status AS label, COUNT(*) AS n FROM _project_assignment GROUP BY pa_status ORDER BY n DESC`);

    const byProgress = await query<BarRow>(
      `SELECT CASE WHEN pa_progress >= 100 THEN 'Selesai' WHEN pa_progress >= 51 THEN '51–99%'
                   WHEN pa_progress >= 1 THEN '1–50%' ELSE 'Belum mulai' END AS label, COUNT(*) AS n
         FROM _project_assignment GROUP BY 1`);

    const perPelatihan = await query<BarRow>(
      `SELECT cr.cr_name AS label, COUNT(*) AS n
         FROM _project_assignment pa JOIN _classroom cr ON cr.cr_id = pa.cr_id
        GROUP BY cr.cr_id, cr.cr_name ORDER BY n DESC LIMIT 12`);

    const where = status ? "WHERE pa.pa_status = ?" : "";
    const P = status ? [status] : [];
    const rows = await query<PaRow>(
      `SELECT pa.pa_id AS id, m.member_name AS nama, m.member_nip AS nip,
              COALESCE(NULLIF(TRIM(pa.pa_jabatan), ''), m.member_jabatan) AS jabatan,
              a.member_name AS atasan, cr.cr_name AS pelatihan,
              pa.pa_problem AS problem, pa.pa_target AS target, pa."UOM" AS uom,
              pa.pa_progress AS progress, pa.pa_status AS status, pa.pa_date_create AS tgl
         FROM _project_assignment pa
         LEFT JOIN _member m ON m.member_id = pa.member_id
         LEFT JOIN _member a ON a.member_id = pa.atasan_id
         LEFT JOIN _classroom cr ON cr.cr_id = pa.cr_id
         ${where}
        ORDER BY pa.pa_date_create DESC NULLS LAST, pa.pa_id DESC
        LIMIT 300`, P);

    // Rincian deliverable & outcome (`_project_assignment_detail`) — tiap PA bisa
    // punya beberapa program/deliverable dengan progres sendiri (org-wide).
    const det = await queryOne<RowDataPacket & { total: number; tuntas: number; avg: number | null; pa: number }>(
      `SELECT COUNT(*) AS total, SUM(CASE WHEN pad_progress >= 100 THEN 1 ELSE 0 END) AS tuntas,
              ROUND(AVG(LEAST(100, GREATEST(0, pad_progress)))::numeric, 1) AS avg, COUNT(DISTINCT pa_id) AS pa
         FROM _project_assignment_detail`);
    const outcomeRows = await query<RowDataPacket & { program: string | null; deliverable: string | null; outcome: string | null; progress: number | null }>(
      `SELECT pad_program AS program, pad_deliverable AS deliverable, pad_outcome AS outcome, pad_progress AS progress
         FROM _project_assignment_detail
        WHERE NULLIF(TRIM(pad_outcome), '') IS NOT NULL
        ORDER BY pad_date_change DESC NULLS LAST, pad_id DESC LIMIT 15`);
    const detTotal = Number(det?.total ?? 0);

    const bars = (rs: BarRow[], labelFn: (s: string | null) => string) =>
      rs.map(r => ({ label: labelFn(r.label), n: Number(r.n) }));

    return Response.json({
      status,
      kpi: {
        total: Number(kpi?.total ?? 0),
        peserta: Number(kpi?.peserta ?? 0),
        pelatihan: Number(kpi?.pelatihan ?? 0),
        avgProgress: Number(kpi?.avg ?? 0),
        berjalan: Number(kpi?.berjalan ?? 0),
        selesai: Number(kpi?.selesai ?? 0),
      },
      byStatus: bars(byStatus, statusLabel),
      byProgress: byProgress.map(r => ({ label: r.label ?? "?", n: Number(r.n) })),
      perPelatihan: bars(perPelatihan, l => clean(l) ?? "(Tanpa nama)"),
      list: rows.map(r => ({
        id: r.id,
        nama: clean(r.nama) ?? `Member #${r.id}`,
        nip: clean(r.nip),
        jabatan: clean(r.jabatan),
        atasan: clean(r.atasan),
        pelatihan: clean(r.pelatihan) ?? "(Tanpa nama)",
        problem: clean(r.problem),
        target: clean(r.target),
        uom: clean(r.uom),
        progress: Math.max(0, Math.min(100, Number(r.progress ?? 0))),
        status: statusLabel(r.status),
        tgl: r.tgl ? String(r.tgl).slice(0, 10) : null,
      })),
      deliverable: {
        total: detTotal,
        tuntas: Number(det?.tuntas ?? 0),
        pctTuntas: detTotal ? Math.round((Number(det?.tuntas ?? 0) / detTotal) * 1000) / 10 : 0,
        avgProgress: Number(det?.avg ?? 0),
        paCount: Number(det?.pa ?? 0),
        list: outcomeRows.map(r => ({
          program: clean(r.program), deliverable: clean(r.deliverable), outcome: clean(r.outcome),
          progress: Math.max(0, Math.min(100, Number(r.progress ?? 0))),
        })),
      },
    });
  } catch (err) {
    console.error("project-assignment GET error", err);
    return Response.json({ error: "Gagal memuat Project Assignment." }, { status: 500 });
  }
}
