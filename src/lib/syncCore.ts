/**
 * Sync inti MySQL (lppexternal_dbagronow) → Supabase Postgres (agronow), tabel inti.
 * Framework-agnostic: terima koneksi mysql2 + pool `pg`, dipakai oleh /api/sync
 * (tombol manual) maupun scripts/sync.ts (cron harian).
 *
 * Strategi per tabel (lihat audit):
 *  - incremental : ambil baris dgn timestamp > watermark (baru+edit), upsert.
 *  - full        : ambil semua baris (proyeksi kolom utk yg besar), upsert.
 *  - SEMUA tabel : prune — hapus baris di Supabase yang PK-nya tak ada lagi di MySQL.
 */
import type { Pool } from "pg";
import type { Connection, FieldPacket, RowDataPacket } from "mysql2/promise";

type Mode = "incremental" | "full";
interface TableCfg { name: string; pk: string; mode: Mode; ts?: string; select?: string }

export const CORE: TableCfg[] = [
  // master kecil → full
  { name: "_group", pk: "group_id", mode: "full" },
  { name: "_member_level_karyawan", pk: "id", mode: "full" },
  { name: "_learning_kategori", pk: "id", mode: "full" },
  { name: "_learning_katalog", pk: "id", mode: "full" },
  { name: "_learning_wallet_penyelenggara", pk: "id", mode: "full" },
  { name: "_learning_wallet_classroom", pk: "id", mode: "full" },
  { name: "_classroom", pk: "cr_id", mode: "full" },
  { name: "_classroom_evaluasi_lv3_rekap", pk: "id", mode: "full" },
  { name: "_learning_wishlist_v2", pk: "id", mode: "full" },
  { name: "_learning_wallet_wishlist", pk: "id", mode: "full" },
  { name: "_classroom_attendance", pk: "cra_id", mode: "full" },
  // besar tanpa edit-timestamp → full, proyeksi kolom (buang longtext yg tak dipakai)
  { name: "_classroom_member", pk: "crm_id", mode: "full",
    select: "crm_id,cr_id,member_id,id_group,crm_channel,content_id,is_pk,member_status,nilai_pre_test,nilai_post_test,berkas_sertifikat,is_verified,is_rekap_kategori1,is_rekap_kategori2,is_rekap_kategori3,crm_create_date" },
  // punya edit-timestamp → incremental
  { name: "_category", pk: "cat_id", mode: "incremental", ts: "cat_update_date" },
  { name: "_member", pk: "member_id", mode: "incremental", ts: "member_user_update_date" },
  { name: "_rekap_classroom_excel", pk: "id", mode: "incremental", ts: "tgl_update" },
  { name: "_learning_wallet_pengajuan", pk: "id", mode: "incremental",
    ts: "GREATEST(COALESCE(tgl_update_status,'1000-01-01'),COALESCE(tgl_update_sdm,'1000-01-01'),COALESCE(tgl_update_sevp,'1000-01-01'),COALESCE(tgl_request,'1000-01-01'))" },
  { name: "_nps_jawab", pk: "id", mode: "incremental", ts: "GREATEST(COALESCE(create_date,'1000-01-01'),COALESCE(edit_date,'1000-01-01'))" },
  { name: "_nps_set_soal", pk: "id", mode: "incremental", ts: "GREATEST(COALESCE(create_date,'1000-01-01'),COALESCE(edit_date,'1000-01-01'))" },
  { name: "_project_assignment", pk: "pa_id", mode: "incremental", ts: "GREATEST(COALESCE(pa_date_create,'1000-01-01'),COALESCE(pa_date_change,'1000-01-01'))" },
];

export interface TableResult { table: string; upserted: number; deleted: number; error?: string }

const qi = (id: string) => `"${id.replace(/"/g, '""')}"`;
const mi = (id: string) => `\`${id.replace(/`/g, "``")}\``;

function convert(v: unknown): unknown {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.startsWith("0000-00-00") ? null : v;
  if (Buffer.isBuffer(v)) return v.toString("utf8");
  if (typeof v === "object" && !(v instanceof Date)) return JSON.stringify(v);
  return v;
}

export async function runSync(my: Connection, pg: Pool): Promise<TableResult[]> {
  const out: TableResult[] = [];
  for (const cfg of CORE) {
    try { out.push(await syncTable(my, pg, cfg)); }
    catch (e) { out.push({ table: cfg.name, upserted: 0, deleted: 0, error: (e as Error).message }); }
  }
  // Post-sync: normalisasi identitas rekap dari master `_member`.
  try { out.push(await normalizeRekapNames(pg)); }
  catch (e) { out.push({ table: "_rekap_classroom_excel:normalize", upserted: 0, deleted: 0, error: (e as Error).message }); }
  return out;
}

/**
 * Timpa `_rekap_classroom_excel.member_name` dengan nama kanonik dari `_member`
 * (di-key oleh member_id). Kolom snapshot ini terbukti rusak — saat impor Excel
 * kolom nama tergeser relatif terhadap member_id sehingga sebagian baris memuat
 * nama orang lain (~10% baris publish; lihat audit Fase 1). `member_id` &
 * `member_nip` TETAP akurat (cek NIP cocok 100%), jadi penimpaan ini aman dan
 * sekaligus menyeragamkan ejaan. Idempotent & self-healing: dijalankan tiap sync
 * sehingga baris yang baru ter-upsert dari MySQL ikut dibersihkan kembali.
 * Aplikasi sendiri sudah membaca identitas dari `_member`; langkah ini menjaga
 * tabel sumber agar tidak menyesatkan query/fitur yang membaca rekap langsung.
 */
async function normalizeRekapNames(pg: Pool): Promise<TableResult> {
  const res = await pg.query(
    `UPDATE _rekap_classroom_excel r
        SET member_name = m.member_name
       FROM _member m
      WHERE m.member_id = r.member_id
        AND NULLIF(TRIM(m.member_name), '') IS NOT NULL
        AND r.member_name IS DISTINCT FROM m.member_name`);
  return { table: "_rekap_classroom_excel:normalize", upserted: res.rowCount ?? 0, deleted: 0 };
}

async function syncTable(my: Connection, pg: Pool, cfg: TableCfg): Promise<TableResult> {
  const colSql = cfg.select ? cfg.select.split(",").map(s => mi(s.trim())).join(",") : "*";

  // --- watermark (incremental) ---
  let where = "";
  const qparams: unknown[] = [];
  if (cfg.mode === "incremental" && cfg.ts) {
    const st = await pg.query<{ last_watermark: string | null }>("SELECT last_watermark FROM sync_state WHERE table_name=$1", [cfg.name]);
    where = ` WHERE ${cfg.ts} > ?`;
    qparams.push(st.rows[0]?.last_watermark ?? "1970-01-01 00:00:00");
  }

  // --- fetch + upsert ---
  const [rows, fields] = await my.query<RowDataPacket[]>(`SELECT ${colSql} FROM ${mi(cfg.name)}${where}`, qparams);
  const colNames = (fields as FieldPacket[]).map(f => f.name);
  const setCols = colNames.filter(c => c !== cfg.pk);
  const setList = setCols.length ? setCols.map(c => `${qi(c)}=excluded.${qi(c)}`).join(", ") : `${qi(cfg.pk)}=excluded.${qi(cfg.pk)}`;
  const batch = Math.max(1, Math.floor(60000 / Math.max(1, colNames.length)));

  let upserted = 0;
  for (let i = 0; i < rows.length; i += batch) {
    const chunk = rows.slice(i, i + batch);
    const p: unknown[] = [];
    const tuples = chunk.map(r => `(${colNames.map(c => `$${p.push(convert((r as Record<string, unknown>)[c]))}`).join(",")})`);
    await pg.query(
      `INSERT INTO ${qi(cfg.name)} (${colNames.map(qi).join(",")}) VALUES ${tuples.join(",")}
       ON CONFLICT (${qi(cfg.pk)}) DO UPDATE SET ${setList}`, p);
    upserted += chunk.length;
  }

  // --- advance watermark ---
  if (cfg.mode === "incremental" && cfg.ts) {
    const [mx] = await my.query<RowDataPacket[]>(`SELECT MAX(${cfg.ts}) AS wm FROM ${mi(cfg.name)}`);
    await pg.query(
      `INSERT INTO sync_state(table_name,last_watermark,last_run) VALUES($1,$2,now())
       ON CONFLICT(table_name) DO UPDATE SET last_watermark=excluded.last_watermark, last_run=now()`,
      [cfg.name, (mx[0] as { wm: string | null })?.wm ?? null]);
  } else {
    await pg.query(
      `INSERT INTO sync_state(table_name,last_run) VALUES($1,now())
       ON CONFLICT(table_name) DO UPDATE SET last_run=now()`, [cfg.name]);
  }

  // --- prune (hard delete) ---
  const [pkRows] = await my.query<RowDataPacket[]>(`SELECT ${mi(cfg.pk)} AS id FROM ${mi(cfg.name)}`);
  const ids = pkRows.map(r => Number((r as { id: unknown }).id)).filter(Number.isFinite);
  const client = await pg.connect();
  let deleted = 0;
  try {
    await client.query("BEGIN");
    await client.query("CREATE TEMP TABLE _keep (id bigint) ON COMMIT DROP");
    if (ids.length) await client.query("INSERT INTO _keep(id) SELECT x FROM unnest($1::bigint[]) AS x", [ids]);
    const del = await client.query(`DELETE FROM ${qi(cfg.name)} WHERE ${qi(cfg.pk)} NOT IN (SELECT id FROM _keep)`);
    deleted = del.rowCount ?? 0;
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK"); throw e;
  } finally {
    client.release();
  }

  return { table: cfg.name, upserted, deleted };
}
