import { requireUser } from "@/lib/apiAuth";
import { query, queryOne } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Learning Wallet — pengajuan & anggaran pelatihan (read-only).
 * Sumber: `_learning_wallet_pengajuan` (alur approval 2 tahap SDM→SEVP) join
 * `_group` (entitas), `_learning_wallet_classroom` (pelatihan) +
 * `_learning_wallet_penyelenggara` (vendor), `_member`, `_member_level_karyawan`.
 * Difilter entitas (opsional, 0=semua) + tahun (opsional, 0=semua), `status='aktif'`.
 *
 * kode_status_current: >=40 Disetujui · 20 Dalam proses · 0 Draft · <0 Ditolak.
 */
const STATUS_CASE =
  "CASE WHEN p.kode_status_current >= 40 THEN 'Disetujui' " +
  "WHEN p.kode_status_current = 20 THEN 'Dalam proses' " +
  "WHEN p.kode_status_current = 0 THEN 'Draft' ELSE 'Ditolak' END";

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
const clean = (v: string | null): string | null => {
  const t = decodeEntities(v ?? "").replace(/\s+/g, " ").trim();
  return t && t.toLowerCase() !== "null" ? t : null;
};
const statusLabel = (k: number) => (k >= 40 ? "Disetujui" : k === 20 ? "Dalam proses" : k === 0 ? "Draft" : "Ditolak");

interface BarRow extends RowDataPacket { label: string | null; n: number; nilai: number | null }
interface ListRow extends RowDataPacket {
  id: number; nama: string | null; nip: string | null; entitas: string | null;
  pelatihan: string | null; penyelenggara: string | null; level: string | null;
  harga: number | null; kode: number; tgl: string | null;
}

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  try {
    const entitasList = await query<RowDataPacket & { id: number; nama: string }>(
      `SELECT p.id_group AS id, gr.group_name AS nama, COUNT(*) AS n
         FROM _learning_wallet_pengajuan p LEFT JOIN _group gr ON gr.group_id = p.id_group
        WHERE p.status = 'aktif' AND NULLIF(TRIM(gr.group_name), '') IS NOT NULL
        GROUP BY p.id_group, gr.group_name ORDER BY n DESC`,
    );
    const years = (await query<RowDataPacket & { y: number }>(
      `SELECT DISTINCT tahun AS y FROM _learning_wallet_pengajuan WHERE status='aktif' AND tahun > 2000 ORDER BY y DESC`,
    )).map(r => Number(r.y));

    const url = new URL(request.url);
    const reqEntitas = Number(url.searchParams.get("entitas")) || 0; // 0 = semua
    const reqYear = Number(url.searchParams.get("year")) || 0;       // 0 = semua
    const entitas = entitasList.some(e => e.id === reqEntitas) ? reqEntitas : 0;
    const year = years.includes(reqYear) ? reqYear : 0;

    const where = ["p.status = 'aktif'"];
    const P: unknown[] = [];
    if (entitas) { where.push("p.id_group = ?"); P.push(entitas); }
    if (year) { where.push("p.tahun = ?"); P.push(year); }
    const W = where.join(" AND ");

    const kpi = await queryOne<RowDataPacket & {
      total: number; nilai: number | null; disetujui: number; nilai_disetujui: number | null; proses: number; ditolak: number;
    }>(
      `SELECT COUNT(*) AS total, SUM(p.harga) AS nilai,
              SUM(CASE WHEN p.kode_status_current >= 40 THEN 1 ELSE 0 END) AS disetujui,
              SUM(CASE WHEN p.kode_status_current >= 40 THEN p.harga ELSE 0 END) AS nilai_disetujui,
              SUM(CASE WHEN p.kode_status_current = 20 THEN 1 ELSE 0 END) AS proses,
              SUM(CASE WHEN p.kode_status_current < 0 THEN 1 ELSE 0 END) AS ditolak
         FROM _learning_wallet_pengajuan p WHERE ${W}`, P);

    const pipeline = await query<BarRow>(
      `SELECT ${STATUS_CASE} AS label, COUNT(*) AS n, SUM(p.harga) AS nilai
         FROM _learning_wallet_pengajuan p WHERE ${W} GROUP BY 1`, P);

    const perEntitas = await query<BarRow>(
      `SELECT gr.group_name AS label, COUNT(*) AS n, SUM(p.harga) AS nilai
         FROM _learning_wallet_pengajuan p LEFT JOIN _group gr ON gr.group_id = p.id_group
        WHERE ${W} GROUP BY gr.group_name ORDER BY nilai DESC NULLS LAST LIMIT 12`, P);

    const perPenyelenggara = await query<BarRow>(
      `SELECT pny.nama AS label, COUNT(*) AS n, SUM(p.harga) AS nilai
         FROM _learning_wallet_pengajuan p
         LEFT JOIN _learning_wallet_classroom lwc ON lwc.id = p.id_lw_classroom
         LEFT JOIN _learning_wallet_penyelenggara pny ON pny.id = lwc.id_penyelenggara
        WHERE ${W} GROUP BY pny.nama ORDER BY nilai DESC NULLS LAST LIMIT 10`, P);

    const perLevel = await query<BarRow>(
      `SELECT lk.nama AS label, COUNT(*) AS n, SUM(p.harga) AS nilai
         FROM _learning_wallet_pengajuan p LEFT JOIN _member_level_karyawan lk ON lk.id = p.id_level_karyawan
        WHERE ${W} GROUP BY lk.nama ORDER BY nilai DESC NULLS LAST LIMIT 10`, P);

    const listRows = await query<ListRow>(
      `SELECT p.id, m.member_name AS nama, m.member_nip AS nip, gr.group_name AS entitas,
              lwc.nama AS pelatihan, pny.nama AS penyelenggara, lk.nama AS level,
              p.harga, p.kode_status_current AS kode, p.tgl_request AS tgl
         FROM _learning_wallet_pengajuan p
         LEFT JOIN _member m ON m.member_id = p.id_member
         LEFT JOIN _group gr ON gr.group_id = p.id_group
         LEFT JOIN _learning_wallet_classroom lwc ON lwc.id = p.id_lw_classroom
         LEFT JOIN _learning_wallet_penyelenggara pny ON pny.id = lwc.id_penyelenggara
         LEFT JOIN _member_level_karyawan lk ON lk.id = p.id_level_karyawan
        WHERE ${W}
        ORDER BY p.tgl_request DESC NULLS LAST, p.id DESC
        LIMIT 200`, P);

    const bar = (r: BarRow) => ({ label: clean(r.label) ?? "Lainnya", n: Number(r.n), nilai: Number(r.nilai ?? 0) });

    return Response.json({
      entitas, year,
      entitasList: entitasList.map(e => ({ id: e.id, nama: e.nama })),
      years,
      kpi: {
        total: Number(kpi?.total ?? 0),
        nilai: Number(kpi?.nilai ?? 0),
        disetujui: Number(kpi?.disetujui ?? 0),
        nilaiDisetujui: Number(kpi?.nilai_disetujui ?? 0),
        proses: Number(kpi?.proses ?? 0),
        ditolak: Number(kpi?.ditolak ?? 0),
      },
      pipeline: pipeline.map(bar),
      perEntitas: perEntitas.map(bar),
      perPenyelenggara: perPenyelenggara.map(bar),
      perLevel: perLevel.map(bar),
      list: listRows.map(r => ({
        id: r.id,
        nama: clean(r.nama) ?? `Member #${r.id}`,
        nip: clean(r.nip),
        entitas: clean(r.entitas),
        pelatihan: clean(r.pelatihan) ?? "(Tanpa nama)",
        penyelenggara: clean(r.penyelenggara),
        level: clean(r.level),
        harga: Number(r.harga ?? 0),
        status: statusLabel(Number(r.kode)),
        tgl: r.tgl ? String(r.tgl).slice(0, 10) : null,
      })),
    });
  } catch (err) {
    console.error("wallet GET error", err);
    return Response.json({ error: "Gagal memuat Learning Wallet." }, { status: 500 });
  }
}
