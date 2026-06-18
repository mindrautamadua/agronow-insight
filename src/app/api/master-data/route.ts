import { requireUser } from "@/lib/apiAuth";
import { ihcmisQuery, isIhcmisConfigured } from "@/lib/ihcmis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Master Data korporat — dibaca read-only dari Supabase **IHCMIS-DEV**:
 *   • Entitas    → `master_company`   (perusahaan/holding)
 *   • Regional   → `master_regional`  (FK kode_perusahaan → company.id)
 *   • Unit Kerja → `master_workunit`  (FK perusahaan/kode_regional)
 * Mengembalikan ketiganya beserta jumlah relasi & ringkasan KPI dalam satu GET
 * (total baris kecil: ±12 + 48 + 645).
 */
interface EntitasRow {
  id: string; kode: string | null; nama: string | null; singkatan: string | null;
  type: string | null; aktif: boolean; urutan: number | null; logo_url: string | null;
  regional_count: number; workunit_count: number;
}
interface RegionalRow {
  id: string; kode: string | null; nama: string | null; aktif: boolean;
  urutan: number | null; entitas: string | null; entitas_id: string | null; workunit_count: number;
}
interface WorkunitRow {
  id: string; kode: string | null; nama: string | null; plant: string | null;
  profit_center: string | null; regional_text: string | null; sub_unit: string | null;
  komoditas: string | null; aktif: boolean; entitas: string | null; regional_master: string | null;
  entitas_id: string | null; regional_id: string | null;
}

// Cache in-memory lintas request (master data jarang berubah & DB di region
// Mumbai). TTL 5 menit; cukup untuk menghindari round-trip lintas region pada
// tiap load tanpa bikin data basi.
const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { at: number; payload: unknown } | undefined;

export async function GET() {
  const g = await requireUser();
  if ("response" in g) return g.response;

  if (!isIhcmisConfigured()) {
    return Response.json(
      { error: "IHCMIS_DB_URL belum dikonfigurasi di .env.local.", configured: false },
      { status: 400 },
    );
  }

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return Response.json(cache.payload);
  }

  try {
    const [entitas, regional, workunit] = await Promise.all([
      ihcmisQuery<EntitasRow>(
        `SELECT c.id, c.kode_perusahaan AS kode, c.nama_perusahaan AS nama,
                c.singkatan_perusahaan AS singkatan, c.type, c.status_aktif AS aktif,
                c.urutan, c.logo_url,
                (SELECT COUNT(*) FROM master_regional r WHERE r.kode_perusahaan = c.id) AS regional_count,
                (SELECT COUNT(*) FROM master_workunit w WHERE w.perusahaan = c.id) AS workunit_count
           FROM master_company c
          ORDER BY c.urutan NULLS LAST, c.nama_perusahaan`,
      ),
      ihcmisQuery<RegionalRow>(
        `SELECT r.id, r.kode_regional AS kode, r.nama_regional AS nama,
                r.status_aktif AS aktif, r.urutan,
                c.singkatan_perusahaan AS entitas, r.kode_perusahaan AS entitas_id,
                (SELECT COUNT(*) FROM master_workunit w WHERE w.kode_regional = r.id) AS workunit_count
           FROM master_regional r
           LEFT JOIN master_company c ON c.id = r.kode_perusahaan
          ORDER BY r.urutan NULLS LAST, r.nama_regional`,
      ),
      ihcmisQuery<WorkunitRow>(
        `SELECT w.id, w.kode, w.nama, w.plant, w.profit_center,
                w.regional AS regional_text, w.sub_unit, w.komoditas,
                w.status_aktif AS aktif,
                c.singkatan_perusahaan AS entitas, r.nama_regional AS regional_master,
                w.perusahaan AS entitas_id, w.kode_regional AS regional_id
           FROM master_workunit w
           LEFT JOIN master_company c ON c.id = w.perusahaan
           LEFT JOIN master_regional r ON r.id = w.kode_regional
          ORDER BY w.kode`,
      ),
    ]);

    const countActive = <T extends { aktif: boolean }>(rows: T[]) => rows.filter(r => r.aktif).length;

    const payload = {
      configured: true,
      summary: {
        entitas: { total: entitas.length, aktif: countActive(entitas) },
        regional: { total: regional.length, aktif: countActive(regional) },
        workunit: { total: workunit.length, aktif: countActive(workunit) },
      },
      entitas: entitas.map(r => ({ ...r, regional_count: Number(r.regional_count), workunit_count: Number(r.workunit_count) })),
      regional: regional.map(r => ({ ...r, workunit_count: Number(r.workunit_count) })),
      workunit,
    };

    cache = { at: Date.now(), payload };
    return Response.json(payload);
  } catch (err) {
    console.error("master-data GET error", err);
    return Response.json({ error: "Gagal memuat master data dari IHCMIS-DEV." }, { status: 500 });
  }
}
