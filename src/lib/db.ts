/**
 * Postgres connection pool untuk Agronow L&D.
 *
 * Sumber data: Supabase Postgres (project `agronow`), via session pooler (IPv4).
 * Sebelumnya MySQL; kini seluruh data dibaca dari Supabase. Koneksi dari
 * `SUPABASE_DB_URL` di `.env.local`. Pool `pg` disimpan singleton lintas HMR.
 *
 * Catatan dialek: route handler memakai placeholder gaya `?` (warisan MySQL);
 * `query()`/`execute()` otomatis mengubahnya jadi `$1, $2, …` untuk Postgres.
 */
import pg, { Pool } from "pg";

// Samakan perilaku dengan mysql2 lama: tanggal sebagai STRING (bukan Date) agar
// kode route yang mengasumsikan string tetap jalan, dan COUNT/bigint sebagai number.
pg.types.setTypeParser(1082, v => v);            // date      → 'YYYY-MM-DD'
pg.types.setTypeParser(1114, v => v);            // timestamp → 'YYYY-MM-DD HH:MM:SS'
pg.types.setTypeParser(1184, v => v);            // timestamptz
pg.types.setTypeParser(20, v => (v === null ? null : parseInt(v, 10))); // int8/bigint → number

declare global {
  // eslint-disable-next-line no-var
  var __agronowPg: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error("SUPABASE_DB_URL belum di-set di .env.local");
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.PG_POOL_LIMIT ?? 10),
  });
}

export function getPool(): Pool {
  if (!global.__agronowPg) global.__agronowPg = createPool();
  return global.__agronowPg;
}

/** Ubah placeholder `?` → `$1, $2, …` (urutan kemunculan). */
function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

/** Jalankan SELECT, kembalikan array baris bertipe T. */
export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query(toPg(sql), params);
  return res.rows as T[];
}

/** Ambil satu baris (atau null). */
export async function queryOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/** Jalankan INSERT/UPDATE/DELETE. `insertId` terisi bila query memakai RETURNING id. */
export async function execute(sql: string, params: unknown[] = []): Promise<{ affectedRows: number; insertId?: number | string }> {
  const res = await getPool().query(toPg(sql), params);
  const insertId = (res.rows?.[0] as { id?: number | string } | undefined)?.id;
  return { affectedRows: res.rowCount ?? 0, insertId };
}
