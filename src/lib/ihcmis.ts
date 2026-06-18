/**
 * Koneksi read-only ke Supabase **IHCMIS-DEV** — sumber master data korporat
 * (entitas/perusahaan, regional, unit kerja) yang dipakai lintas aplikasi PTPN.
 *
 * Berbeda dari `db.ts` (pool aplikasi Agronow sendiri): di sini kita hanya
 * MEMBACA dari database lain via `IHCMIS_DB_URL`. Pool `pg` disimpan singleton
 * lintas HMR. Placeholder pakai gaya `$1, $2, …` (native Postgres).
 */
import pg, { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __ihcmisPg: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.IHCMIS_DB_URL;
  if (!connectionString) throw new Error("IHCMIS_DB_URL belum di-set di .env.local");
  return new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: Number(process.env.IHCMIS_POOL_LIMIT ?? 5),
    // Gagal cepat bila kredensial/host salah, alih-alih menggantung lama
    // (IHCMIS-DEV ada di region ap-south-1, RTT relatif tinggi dari ID).
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 30000,
  });
}

export function isIhcmisConfigured(): boolean {
  return !!process.env.IHCMIS_DB_URL;
}

function getPool(): Pool {
  if (!global.__ihcmisPg) global.__ihcmisPg = createPool();
  return global.__ihcmisPg;
}

/** Jalankan SELECT terhadap IHCMIS-DEV, kembalikan array baris bertipe T. */
export async function ihcmisQuery<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await getPool().query(sql, params);
  return res.rows as T[];
}

// Pastikan modul `pg` ter-treeshake dengan benar saat dipakai di route nodejs.
void pg;
