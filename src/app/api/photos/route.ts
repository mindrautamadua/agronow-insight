import { requireUser, requireGlobalAdmin } from "@/lib/apiAuth";
import { query, queryOne, execute } from "@/lib/db";
import { Client } from "pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Sinkronisasi foto karyawan: tabel `employee_photos` (nip → photo_url) di
 * Supabase agronow disalin dari `employees` (IHCMIS-DEV) — koneksi via
 * `IHCMIS_DB_URL`. GET = status, POST = jalankan sync (admin).
 */
const SRC_SQL =
  "SELECT employee_number AS nip, photo_url FROM employees " +
  "WHERE photo_url LIKE 'http%' AND employee_number IS NOT NULL AND employee_number <> ''";

export async function GET() {
  const g = await requireUser();
  if ("response" in g) return g.response;
  try {
    const s = await queryOne<{ total: number; matched: number; last_sync: string | null }>(
      `SELECT (SELECT COUNT(*) FROM employee_photos) AS total,
              (SELECT COUNT(DISTINCT m.member_nip) FROM _member m JOIN employee_photos ep ON ep.nip = m.member_nip) AS matched,
              (SELECT MAX(synced_at) FROM employee_photos) AS last_sync`);
    return Response.json({
      total: Number(s?.total ?? 0),
      matched: Number(s?.matched ?? 0),
      lastSync: s?.last_sync ?? null,
      configured: !!process.env.IHCMIS_DB_URL,
    });
  } catch (err) {
    console.error("photos GET error", err);
    return Response.json({ error: "Gagal memuat status foto." }, { status: 500 });
  }
}

export async function POST() {
  const g = await requireGlobalAdmin();
  if ("response" in g) return g.response;

  const url = process.env.IHCMIS_DB_URL;
  if (!url) return Response.json({ error: "IHCMIS_DB_URL belum dikonfigurasi di .env.local." }, { status: 400 });

  const src = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    await src.connect();
    const { rows } = await src.query<{ nip: string; photo_url: string }>(SRC_SQL);
    const nips = rows.map(r => r.nip);
    const urls = rows.map(r => r.photo_url);

    if (nips.length) {
      await execute(
        `INSERT INTO employee_photos (nip, photo_url, synced_at)
         SELECT nip, url, now() FROM unnest($1::text[], $2::text[]) AS t(nip, url)
         ON CONFLICT (nip) DO UPDATE SET photo_url = excluded.photo_url, synced_at = now()`,
        [nips, urls],
      );
    }
    return Response.json({ ok: true, synced: nips.length });
  } catch (err) {
    console.error("photos sync error", err);
    return Response.json({ error: "Sync gagal: " + (err as Error).message }, { status: 500 });
  } finally {
    await src.end().catch(() => {});
  }
}
