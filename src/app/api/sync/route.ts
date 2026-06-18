import { requireGlobalAdmin, requireUser } from "@/lib/apiAuth";
import { query, getPool } from "@/lib/db";
import { runSync } from "@/lib/syncCore";
import mysql from "mysql2/promise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET = status (sync_state + riwayat run). POST = jalankan sync (admin / cron). */
export async function GET() {
  const g = await requireUser();
  if ("response" in g) return g.response;
  try {
    const state = await query(
      `SELECT table_name, last_watermark, last_run FROM sync_state ORDER BY table_name`);
    const runs = await query(
      `SELECT id, started_at, finished_at, ok, total_upsert, total_delete, duration_ms, detail, error
         FROM sync_log ORDER BY started_at DESC LIMIT 10`);
    return Response.json({ state, runs });
  } catch (err) {
    console.error("sync GET error", err);
    return Response.json({ error: "Gagal memuat status sync." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Auth: admin login ATAU header rahasia untuk cron.
  const secret = process.env.SYNC_SECRET;
  const headerSecret = request.headers.get("x-sync-secret");
  if (!(secret && headerSecret && headerSecret === secret)) {
    const g = await requireGlobalAdmin();
    if ("response" in g) return g.response;
  }

  const started = Date.now();
  const my = await mysql.createConnection({
    host: process.env.MYSQL_HOST, port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE, dateStrings: true,
  });
  try {
    const results = await runSync(my, getPool());
    const totalUpsert = results.reduce((s, r) => s + r.upserted, 0);
    const totalDelete = results.reduce((s, r) => s + r.deleted, 0);
    const ok = results.every(r => !r.error);
    const ms = Date.now() - started;
    await query(
      `INSERT INTO sync_log (finished_at, ok, total_upsert, total_delete, duration_ms, detail)
       VALUES (now(), $1, $2, $3, $4, $5::jsonb)`,
      [ok, totalUpsert, totalDelete, ms, JSON.stringify(results)],
    );
    return Response.json({ ok, totalUpsert, totalDelete, durationMs: ms, results });
  } catch (err) {
    await query(
      `INSERT INTO sync_log (finished_at, ok, duration_ms, error) VALUES (now(), false, $1, $2)`,
      [Date.now() - started, (err as Error).message],
    ).catch(() => {});
    console.error("sync POST error", err);
    return Response.json({ error: "Sync gagal: " + (err as Error).message }, { status: 500 });
  } finally {
    await my.end().catch(() => {});
  }
}
