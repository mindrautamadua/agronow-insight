import { requireUser } from "@/lib/apiAuth";
import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Penggunaan Eksternal — seberapa banyak & dalam Agronow dipakai pihak DI LUAR
 * PTPN Group. Segmen dari `_group.silsilah`: '01.%'=PTPN, name 'Umum'=Umum,
 * sisanya=Eksternal (non-PTPN). Mengukur per modul + daftar entitas + pelatihan.
 */
const SEG = "CASE WHEN g.silsilah LIKE '01.%' THEN 'PTPN' WHEN g.group_name='Umum' THEN 'Umum' ELSE 'Eksternal' END";
const NON_PTPN = "COALESCE(g.silsilah,'') NOT LIKE '01.%' AND g.group_name <> 'Umum'";

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
const clean = (v: string | null) => { const t = decodeEntities(v ?? "").replace(/\s+/g, " ").trim(); return t && t.toLowerCase() !== "null" ? t : null; };

interface SegRow extends RowDataPacket { metric: string; seg: string; n: number }
interface EntRow extends RowDataPacket { id: number; nama: string; members: number; peserta: number; sertifikat: number; pelatihan: number }
interface TrRow extends RowDataPacket { crId: number; entitas: string; pelatihan: string | null; peserta: number; tgl: string | null }
interface PartRow extends RowDataPacket { crId: number; entitas: string; nama: string | null; nip: string | null; jabatan: string | null; photo: string | null }

export async function GET() {
  const g = await requireUser();
  if ("response" in g) return g.response;

  try {
    const segRows = await query<SegRow>(
      `WITH seg AS (SELECT group_id, ${SEG} s FROM _group g)
       SELECT 'Karyawan' metric, s.s seg, COUNT(*) n FROM _member m JOIN seg s ON s.group_id=m.group_id WHERE TRIM(m.member_name)<>'' GROUP BY s.s
       UNION ALL SELECT 'Peserta Kelas', s.s, COUNT(DISTINCT cm.member_id) FROM _classroom_member cm JOIN _member m ON m.member_id=cm.member_id JOIN seg s ON s.group_id=m.group_id GROUP BY s.s
       UNION ALL SELECT 'Sertifikat', s.s, COUNT(*) FROM _classroom_member cm JOIN _member m ON m.member_id=cm.member_id JOIN seg s ON s.group_id=m.group_id WHERE NULLIF(TRIM(cm.berkas_sertifikat),'') IS NOT NULL AND TRIM(cm.berkas_sertifikat) NOT IN ('-','0') GROUP BY s.s
       UNION ALL SELECT 'Wishlist', s.s, COUNT(*) FROM _learning_wishlist_v2 w JOIN _member m ON m.member_id=w.id_member JOIN seg s ON s.group_id=m.group_id WHERE w.status='aktif' GROUP BY s.s
       UNION ALL SELECT 'Project Assignment', s.s, COUNT(*) FROM _project_assignment pa JOIN _member m ON m.member_id=pa.member_id JOIN seg s ON s.group_id=m.group_id GROUP BY s.s
       UNION ALL SELECT 'Learning Wallet', s.s, COUNT(*) FROM _learning_wallet_pengajuan p JOIN seg s ON s.group_id=p.id_group WHERE p.status='aktif' GROUP BY s.s
       UNION ALL SELECT 'Evaluasi L3', s.s, COUNT(*) FROM _classroom_evaluasi_lv3_rekap r JOIN seg s ON s.group_id=r.group_id GROUP BY s.s`);

    const order = ["Karyawan", "Peserta Kelas", "Sertifikat", "Evaluasi L3", "Project Assignment", "Learning Wallet", "Wishlist"];
    const segMap = new Map<string, { metric: string; PTPN: number; Eksternal: number; Umum: number }>();
    for (const m of order) segMap.set(m, { metric: m, PTPN: 0, Eksternal: 0, Umum: 0 });
    for (const r of segRows) {
      const e = segMap.get(r.metric); if (!e) continue;
      (e as Record<string, number | string>)[r.seg] = Number(r.n);
    }
    const summary = [...segMap.values()];

    const entRows = await query<EntRow>(
      `SELECT g.group_id id, g.group_name nama,
        (SELECT COUNT(*) FROM _member m WHERE m.group_id=g.group_id AND TRIM(m.member_name)<>'') members,
        (SELECT COUNT(DISTINCT cm.member_id) FROM _classroom_member cm JOIN _member m ON m.member_id=cm.member_id WHERE m.group_id=g.group_id) peserta,
        (SELECT COUNT(*) FROM _classroom_member cm JOIN _member m ON m.member_id=cm.member_id WHERE m.group_id=g.group_id AND NULLIF(TRIM(cm.berkas_sertifikat),'') IS NOT NULL AND TRIM(cm.berkas_sertifikat) NOT IN ('-','0')) sertifikat,
        (SELECT COUNT(DISTINCT cm.cr_id) FROM _classroom_member cm JOIN _member m ON m.member_id=cm.member_id WHERE m.group_id=g.group_id) pelatihan
       FROM _group g WHERE ${NON_PTPN}
       ORDER BY peserta DESC, members DESC`);

    const trRows = await query<TrRow>(
      `SELECT cr.cr_id "crId", g.group_name entitas, cr.cr_name pelatihan, COUNT(DISTINCT cm.member_id) peserta, MAX(cr.cr_date_start::date) tgl
         FROM _classroom_member cm
         JOIN _member m ON m.member_id=cm.member_id
         JOIN _group g ON g.group_id=m.group_id
         JOIN _classroom cr ON cr.cr_id=cm.cr_id
        WHERE ${NON_PTPN}
        GROUP BY cr.cr_id, g.group_name, cr.cr_name ORDER BY peserta DESC, tgl DESC`);

    const partRows = await query<PartRow>(
      `SELECT cm.cr_id "crId", g.group_name entitas, m.member_name nama, m.member_nip nip,
              COALESCE(NULLIF(TRIM(m.member_jabatan),''), NULLIF(TRIM(m.member_kel_jabatan),'')) jabatan,
              ep.photo_url photo
         FROM _classroom_member cm
         JOIN _member m ON m.member_id=cm.member_id
         JOIN _group g ON g.group_id=m.group_id
         LEFT JOIN employee_photos ep ON ep.nip=m.member_nip
        WHERE ${NON_PTPN}
        ORDER BY g.group_name, m.member_name`);

    const entitas = entRows.map(r => ({
      id: r.id, nama: clean(r.nama) ?? `Grup #${r.id}`,
      members: Number(r.members), peserta: Number(r.peserta), sertifikat: Number(r.sertifikat), pelatihan: Number(r.pelatihan),
    }));
    const trainings = trRows.map(r => ({
      crId: Number(r.crId), entitas: clean(r.entitas) ?? "—", pelatihan: clean(r.pelatihan) ?? "(Tanpa nama)",
      peserta: Number(r.peserta), tgl: r.tgl ? String(r.tgl).slice(0, 10) : null,
    }));
    const participants = partRows.map(r => ({
      crId: Number(r.crId), entitas: clean(r.entitas) ?? "—",
      nama: clean(r.nama) ?? "—", nip: clean(r.nip), jabatan: clean(r.jabatan), photo: r.photo ?? null,
    }));

    const aktif = entitas.filter(e => e.peserta > 0).length;
    return Response.json({
      summary,
      kpi: {
        terdaftar: entitas.length,
        aktif,
        dorman: entitas.length - aktif,
        peserta: entitas.reduce((s, e) => s + e.peserta, 0),
      },
      entitas, trainings, participants,
    });
  } catch (err) {
    console.error("eksternal GET error", err);
    return Response.json({ error: "Gagal memuat data penggunaan eksternal." }, { status: 500 });
  }
}
