import { requireUser } from "@/lib/apiAuth";
import { scopeGroupIds } from "@/lib/scope";
import { query, queryOne } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Dashboard L&D (read-only) — realisasi pelatihan & JPL dari `_rekap_classroom_excel`
 * (rekap per peserta: jpl, biaya, level, kategori, tanggal). Difilter per entitas
 * (group) + tahun, hanya baris `status_data='publish'`.
 *
 * Metrik:
 *  - JPL & Sesi : level-sesi (1 nilai per training, agar tidak dihitung per-peserta)
 *  - Biaya      : total realisasi (level-peserta)
 *  - Peserta    : karyawan unik (distinct member)
 */
const SESSION_KEY = "nama_pelatihan, tgl_pelatihan_mulai, tgl_pelatihan_selesai";

interface KpiRow extends RowDataPacket { biaya: number | null; peserta: number }
interface SesRow extends RowDataPacket { sesi: number; jpl: number | null }
interface MonthAggRow extends RowDataPacket { bln: number; biaya: number | null; peserta: number }
interface MonthSesRow extends RowDataPacket { bln: number; sesi: number; jpl: number | null }
interface BarRow extends RowDataPacket { label: string | null; jpl: number | null }
interface SubRow extends RowDataPacket { sub: string | null; jpl: number | null; sesi: number }

// Subkelompok metode belajar (kerangka 70-20-10) — porsi ideal tiap kelompok.
// `key` = nilai kolom `_learning_kategori.kategori` untuk metode belajar.
const SUB_META: { key: string; ideal: number }[] = [
  { key: "metode_belajar70", ideal: 70 },
  { key: "metode_belajar20", ideal: 20 },
  { key: "metode_belajar10", ideal: 10 },
];

function normLevel(v: string | null): string {
  const t = (v ?? "").trim();
  if (!t || t === "#N/A" || /unknown/i.test(t)) return "Lainnya";
  return t;
}

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  try {
    const allowedIds = await scopeGroupIds(g.user); // null = tanpa batas
    const entitasList = (await query<RowDataPacket & { id: number; nama: string }>(
      `SELECT DISTINCT r.group_id AS id, g.group_name AS nama
         FROM _rekap_classroom_excel r
         LEFT JOIN _group g ON g.group_id = r.group_id
        WHERE r.status_data = 'publish'
        ORDER BY nama`,
    )).filter(e => !allowedIds || allowedIds.includes(Number(e.id)));
    const years = (await query<RowDataPacket & { y: number }>(
      `SELECT DISTINCT EXTRACT(YEAR FROM tgl_pelatihan_mulai)::int AS y
         FROM _rekap_classroom_excel WHERE status_data = 'publish' AND tgl_pelatihan_mulai IS NOT NULL
        ORDER BY y DESC`,
    )).map(r => Number(r.y));

    const url = new URL(request.url);
    const reqEntitas = Number(url.searchParams.get("entitas"));
    const reqYear = Number(url.searchParams.get("year"));
    const entitas = entitasList.find(e => e.id === reqEntitas) ?? entitasList[0] ?? null;
    const year = years.includes(reqYear) ? reqYear : (years[0] ?? new Date().getFullYear());

    const emptyMonthly = Array.from({ length: 12 }, (_, i) => ({ bln: i + 1, jpl: 0, sesi: 0, biaya: 0, peserta: 0 }));
    if (!entitas) {
      return Response.json({
        entitas: null, entitasList: [], years, year,
        kpi: { sesi: 0, jpl: 0, biaya: 0, peserta: 0 },
        monthly: emptyMonthly, perLevel: [], perKategori: [],
        perSubkelompok: SUB_META.map(m => ({ ...m, jpl: 0, sesi: 0 })), perDivisi: [],
      });
    }

    const W = "r.group_id = ? AND EXTRACT(YEAR FROM r.tgl_pelatihan_mulai)::int = ? AND r.status_data = 'publish'";
    const P = [entitas.id, year];

    const kpiAgg = await queryOne<KpiRow>(
      `SELECT SUM(r.biaya) AS biaya, COUNT(DISTINCT r.member_id) AS peserta
         FROM _rekap_classroom_excel r WHERE ${W}`, P);
    const sesAgg = await queryOne<SesRow>(
      `SELECT COUNT(*) AS sesi, SUM(s.jpl) AS jpl FROM (
         SELECT MAX(r.jpl) AS jpl FROM _rekap_classroom_excel r WHERE ${W} GROUP BY ${SESSION_KEY}
       ) s`, P);

    const sesi = Number(sesAgg?.sesi ?? 0);
    const jpl = Number(sesAgg?.jpl ?? 0);
    const biaya = Number(kpiAgg?.biaya ?? 0);
    const peserta = Number(kpiAgg?.peserta ?? 0);

    const monthAgg = await query<MonthAggRow>(
      `SELECT EXTRACT(MONTH FROM r.tgl_pelatihan_mulai)::int AS bln, SUM(r.biaya) AS biaya, COUNT(DISTINCT r.member_id) AS peserta
         FROM _rekap_classroom_excel r WHERE ${W} GROUP BY EXTRACT(MONTH FROM r.tgl_pelatihan_mulai)`, P);
    const monthSes = await query<MonthSesRow>(
      `SELECT bln, COUNT(*) AS sesi, SUM(jpl) AS jpl FROM (
         SELECT EXTRACT(MONTH FROM r.tgl_pelatihan_mulai)::int AS bln, MAX(r.jpl) AS jpl
           FROM _rekap_classroom_excel r WHERE ${W} GROUP BY EXTRACT(MONTH FROM r.tgl_pelatihan_mulai), ${SESSION_KEY}
       ) t GROUP BY bln`, P);

    const byMonth = new Map<number, { jpl: number; sesi: number; biaya: number; peserta: number }>();
    for (let m = 1; m <= 12; m++) byMonth.set(m, { jpl: 0, sesi: 0, biaya: 0, peserta: 0 });
    for (const r of monthSes) { const e = byMonth.get(Number(r.bln))!; e.jpl = Number(r.jpl ?? 0); e.sesi = Number(r.sesi ?? 0); }
    for (const r of monthAgg) { const e = byMonth.get(Number(r.bln))!; e.biaya = Number(r.biaya ?? 0); e.peserta = Number(r.peserta ?? 0); }
    const monthly = [...byMonth.entries()].map(([bln, v]) => ({ bln, ...v }));

    const levelRows = await query<BarRow>(
      `SELECT r.level AS label, SUM(r.jpl) AS jpl FROM _rekap_classroom_excel r WHERE ${W} GROUP BY r.level`, P);
    const levelMap = new Map<string, number>();
    for (const r of levelRows) {
      const k = normLevel(r.label);
      levelMap.set(k, (levelMap.get(k) ?? 0) + Number(r.jpl ?? 0));
    }
    const perLevel = [...levelMap.entries()].map(([label, j]) => ({ label, jpl: j })).sort((a, b) => b.jpl - a.jpl);

    // JPL per kategori = JPL per-sesi (dedup via SESSION_KEY), konsisten dgn Total JPL
    // & drill-down "Daftar Pelatihan". 1 sesi 1 kategori → jumlah seluruh kategori = Total JPL.
    const katRows = await query<BarRow>(
      `SELECT label, SUM(jpl) AS jpl FROM (
         SELECT MAX(k.nama) AS label, MAX(r.jpl) AS jpl
           FROM _rekap_classroom_excel r LEFT JOIN _learning_kategori k ON k.id = r.kategori
          WHERE ${W} GROUP BY ${SESSION_KEY}
       ) s GROUP BY label ORDER BY jpl DESC`, P);
    const perKategori = katRows.map(r => ({ label: r.label?.trim() || "Lainnya", jpl: Number(r.jpl ?? 0) }));

    // Realisasi JPL per subkelompok 70-20-10 — JPL per-sesi (dedup via SESSION_KEY,
    // konsisten dgn Total JPL & per Kategori) dikelompokkan via `_learning_kategori.kategori`
    // (metode_belajar70/20/10). Selalu kembalikan 3 kelompok berurut 70→20→10, walau 0.
    const subRows = await query<SubRow>(
      `SELECT sub, COUNT(*) AS sesi, SUM(jpl) AS jpl FROM (
         SELECT MAX(k.kategori) AS sub, MAX(r.jpl) AS jpl
           FROM _rekap_classroom_excel r LEFT JOIN _learning_kategori k ON k.id = r.kategori
          WHERE ${W} GROUP BY ${SESSION_KEY}
       ) s WHERE sub IN ('metode_belajar70','metode_belajar20','metode_belajar10')
       GROUP BY sub`, P);
    const subMap = new Map<string, { jpl: number; sesi: number }>();
    for (const r of subRows) {
      const e = subMap.get(r.sub ?? "") ?? { jpl: 0, sesi: 0 };
      e.jpl += Number(r.jpl ?? 0); e.sesi += Number(r.sesi ?? 0);
      subMap.set(r.sub ?? "", e);
    }
    const perSubkelompok = SUB_META.map(m => ({
      key: m.key, ideal: m.ideal,
      jpl: subMap.get(m.key)?.jpl ?? 0, sesi: subMap.get(m.key)?.sesi ?? 0,
    }));

    // JPL per Divisi — dimensi tambahan (penempatan member tahun ybs dari
    // `_member_bagian_divisi` → `_bagian_divisi`). Data baru terisi mulai 2026;
    // tahun lain bisa kosong. Person-JPL (mirip per Level).
    const diviRows = await query<BarRow>(
      `SELECT bd.nama AS label, SUM(r.jpl) AS jpl
         FROM _rekap_classroom_excel r
         JOIN _member_bagian_divisi mbd ON mbd.member_id = r.member_id AND mbd.tahun = ?
         JOIN _bagian_divisi bd ON bd.id = mbd.id_divisi
        WHERE ${W} AND NULLIF(TRIM(bd.nama), '') IS NOT NULL
        GROUP BY bd.id, bd.nama ORDER BY jpl DESC LIMIT 12`, [year, ...P]);
    const perDivisi = diviRows.map(r => ({ label: r.label?.trim() || "Lainnya", jpl: Number(r.jpl ?? 0) }));

    return Response.json({
      entitas: { id: entitas.id, nama: entitas.nama },
      entitasList: entitasList.map(e => ({ id: e.id, nama: e.nama })),
      years, year,
      kpi: { sesi, jpl, biaya, peserta },
      monthly, perLevel, perKategori, perSubkelompok, perDivisi,
    });
  } catch (err) {
    console.error("dashboard GET error", err);
    return Response.json({ error: "Gagal memuat dashboard." }, { status: 500 });
  }
}
