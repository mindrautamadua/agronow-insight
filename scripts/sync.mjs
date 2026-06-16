/**
 * Sync harian MySQL → Supabase (tabel inti). Untuk cron:
 *   node scripts/sync.mjs
 * Kredensial dari .env.local (MYSQL_* + SUPABASE_DB_URL). Logika di src/lib/syncCore.ts.
 */
import mysql from "mysql2/promise";
import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runSync } from "../src/lib/syncCore.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: join(root, ".env.local") });

const started = Date.now();
const my = await mysql.createConnection({
  host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE, dateStrings: true,
});
const pool = new pg.Pool({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false }, max: 4 });

try {
  const results = await runSync(my, pool);
  const up = results.reduce((s, r) => s + r.upserted, 0);
  const del = results.reduce((s, r) => s + r.deleted, 0);
  const ok = results.every(r => !r.error);
  const ms = Date.now() - started;
  for (const r of results) console.log(`${r.error ? "✗" : "✓"} ${r.table.padEnd(34)} upsert ${String(r.upserted).padStart(6)} · delete ${String(r.deleted).padStart(5)}${r.error ? "  ERR: " + r.error : ""}`);
  await pool.query(
    `INSERT INTO sync_log (finished_at, ok, total_upsert, total_delete, duration_ms, detail) VALUES (now(),$1,$2,$3,$4,$5::jsonb)`,
    [ok, up, del, ms, JSON.stringify(results)]);
  console.log(`\n${ok ? "✅" : "⚠️"} Selesai ${(ms / 1000).toFixed(1)}s · upsert ${up} · delete ${del}`);
} catch (e) {
  await pool.query(`INSERT INTO sync_log (finished_at, ok, duration_ms, error) VALUES (now(),false,$1,$2)`, [Date.now() - started, e.message]).catch(() => {});
  console.error("✗ Sync gagal:", e.message); process.exitCode = 1;
} finally {
  await my.end().catch(() => {});
  await pool.end().catch(() => {});
}
