import { requireUser } from "@/lib/apiAuth";
import { query, queryOne } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Efektivitas Pelatihan (read-only) — evaluasi Kirkpatrick Level 3 dari
 * `_classroom_evaluasi_lv3_rekap` (nilai pre/post 0–100 per peserta). Gain =
 * post − pre. Join `_classroom` (pelatihan) & `_group` (entitas). Filter entitas.
 */
function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
const clean = (v: string | null): string | null => {
  const t = decodeEntities(v ?? "").replace(/\s+/g, " ").trim();
  return t && t.toLowerCase() !== "null" ? t : null;
};

interface PelatihanRow extends RowDataPacket { label: string | null; n: number; pre: number | null; post: number | null }
interface EntitasRow extends RowDataPacket { label: string | null; n: number; gain: number | null }

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const url = new URL(request.url);
  const reqEntitas = Number(url.searchParams.get("entitas")) || 0;

  try {
    const entitasList = await query<RowDataPacket & { id: number; nama: string }>(
      `SELECT r.group_id AS id, gr.group_name AS nama, COUNT(*) AS n
         FROM _classroom_evaluasi_lv3_rekap r LEFT JOIN _group gr ON gr.group_id = r.group_id
        WHERE NULLIF(TRIM(gr.group_name), '') IS NOT NULL
        GROUP BY r.group_id, gr.group_name ORDER BY n DESC`);
    const entitas = entitasList.some(e => e.id === reqEntitas) ? reqEntitas : 0;

    const where = entitas ? "WHERE r.group_id = ?" : "";
    const P = entitas ? [entitas] : [];

    const kpi = await queryOne<RowDataPacket & {
      pelatihan: number; peserta: number; pre: number | null; post: number | null; gain: number | null; naik: number;
    }>(
      `SELECT COUNT(DISTINCT r.cr_id) AS pelatihan, COUNT(*) AS peserta,
              ROUND(AVG(r.nilai_pre_test)::numeric, 1) AS pre,
              ROUND(AVG(r.nilai_post_test)::numeric, 1) AS post,
              ROUND(AVG(r.nilai_post_test - r.nilai_pre_test)::numeric, 1) AS gain,
              SUM(CASE WHEN r.nilai_post_test > r.nilai_pre_test THEN 1 ELSE 0 END) AS naik
         FROM _classroom_evaluasi_lv3_rekap r ${where}`, P);

    const perEntitas = await query<EntitasRow>(
      `SELECT gr.group_name AS label, COUNT(*) AS n,
              ROUND(AVG(r.nilai_post_test - r.nilai_pre_test)::numeric, 1) AS gain
         FROM _classroom_evaluasi_lv3_rekap r LEFT JOIN _group gr ON gr.group_id = r.group_id
        ${where} GROUP BY gr.group_name ORDER BY n DESC LIMIT 12`, P);

    const perPelatihan = await query<PelatihanRow>(
      `SELECT cr.cr_name AS label, COUNT(*) AS n,
              ROUND(AVG(r.nilai_pre_test)::numeric, 1) AS pre,
              ROUND(AVG(r.nilai_post_test)::numeric, 1) AS post
         FROM _classroom_evaluasi_lv3_rekap r JOIN _classroom cr ON cr.cr_id = r.cr_id
        ${where} GROUP BY cr.cr_id, cr.cr_name HAVING COUNT(*) >= 5
        ORDER BY n DESC LIMIT 200`, P);

    // Tindak lanjut L3 — penilaian perubahan perilaku oleh ATASAN langsung
    // (`_classroom_evaluasi_lv3_pairing`, status_penilai='atasan', progress 0–100).
    // Difilter entitas via group_id peserta yang dinilai (id_dinilai → _member).
    const aWhere = entitas ? "AND md.group_id = ?" : "";
    const aP = entitas ? [entitas] : [];
    const atasan = await queryOne<RowDataPacket & { penilaian: number; kelas: number; dinilai: number; tuntas: number; avg_progress: number | null }>(
      `SELECT COUNT(*) AS penilaian, COUNT(DISTINCT p.cr_id) AS kelas, COUNT(DISTINCT p.id_dinilai) AS dinilai,
              SUM(CASE WHEN p.progress >= 100 THEN 1 ELSE 0 END) AS tuntas,
              ROUND(AVG(p.progress)::numeric, 1) AS avg_progress
         FROM _classroom_evaluasi_lv3_pairing p
         LEFT JOIN _member md ON md.member_id = p.id_dinilai
        WHERE p.status_penilai = 'atasan' ${aWhere}`, aP);

    const peserta = Number(kpi?.peserta ?? 0);
    const aPenilaian = Number(atasan?.penilaian ?? 0);
    return Response.json({
      entitas,
      entitasList: entitasList.map(e => ({ id: e.id, nama: e.nama })),
      kpi: {
        pelatihan: Number(kpi?.pelatihan ?? 0),
        peserta,
        pre: Number(kpi?.pre ?? 0),
        post: Number(kpi?.post ?? 0),
        gain: Number(kpi?.gain ?? 0),
        pctNaik: peserta ? Math.round((Number(kpi?.naik ?? 0) / peserta) * 1000) / 10 : 0,
      },
      perEntitas: perEntitas.map(r => ({ label: clean(r.label) ?? "Lainnya", n: Number(r.n), gain: Number(r.gain ?? 0) })),
      perPelatihan: perPelatihan.map(r => {
        const pre = Number(r.pre ?? 0), post = Number(r.post ?? 0);
        return { label: clean(r.label) ?? "(Tanpa nama)", n: Number(r.n), pre, post, gain: Math.round((post - pre) * 10) / 10 };
      }),
      l3Atasan: {
        penilaian: aPenilaian,
        kelas: Number(atasan?.kelas ?? 0),
        dinilai: Number(atasan?.dinilai ?? 0),
        tuntas: Number(atasan?.tuntas ?? 0),
        pctTuntas: aPenilaian ? Math.round((Number(atasan?.tuntas ?? 0) / aPenilaian) * 1000) / 10 : 0,
        avgProgress: Number(atasan?.avg_progress ?? 0),
      },
    });
  } catch (err) {
    console.error("efektivitas GET error", err);
    return Response.json({ error: "Gagal memuat efektivitas." }, { status: 500 });
  }
}
