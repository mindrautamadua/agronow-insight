import { requireUser } from "@/lib/apiAuth";
import { query } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Katalog Training (read-only) — definisi program dari tabel legacy
 * `_learning_katalog`. Catatan: `_classroom` adalah kelas/batch pelaksanaan
 * (enrollment), bukan katalog, jadi BUKAN sumber modul ini.
 */
interface KatalogRow extends RowDataPacket {
  id: number;
  kode: string | null;
  nama: string;
  deskripsi: string | null;
  kategori_key_element: string | null;
  metode: string | null;
  jpl_total: number | null;
  durasi_hari: number | null;
  harga: number | null;
  status: "aktif" | "dihapus";
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
function clean(s: string | null): string | null {
  if (!s) return null;
  const out = decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
  return out || null;
}

// metode katalog → label mode yang dipakai UI.
const MODE: Record<string, string> = {
  Offline: "offline", Online: "online", Hybrid: "hybrid", Blended: "blended",
};

export async function GET() {
  const g = await requireUser();
  if ("response" in g) return g.response;
  try {
    const rows = await query<KatalogRow>(
      `SELECT id, kode, nama, deskripsi, kategori_key_element, metode,
              jpl_total, durasi_hari, harga, status
         FROM _learning_katalog
        WHERE status <> 'dihapus'
        ORDER BY nama ASC`,
    );

    const courses = rows.map((r) => ({
      id: r.id,
      kode: r.kode?.trim() || `LK-${r.id}`,
      judul: decodeEntities(r.nama ?? "").trim(),
      // key element (mis. "5G,ECL,IQM") sebagai pengelompokan; rapikan spasi.
      kategori: r.kategori_key_element?.trim()
        ? r.kategori_key_element.trim().replace(/\s*,\s*/g, ", ")
        : null,
      deskripsi: clean(r.deskripsi),
      mode: r.metode?.trim() ? (MODE[r.metode.trim()] ?? r.metode.trim().toLowerCase()) : null,
      durasi_jam: r.jpl_total && r.jpl_total > 0 ? r.jpl_total : null,
      durasi_hari: r.durasi_hari && r.durasi_hari > 0 ? r.durasi_hari : null,
      biaya: Number(r.harga ?? 0),
      status: r.status === "aktif" ? "aktif" : "arsip",
    }));

    return Response.json({ courses });
  } catch (err) {
    console.error("courses GET error", err);
    return Response.json({ error: "Gagal memuat data." }, { status: 500 });
  }
}
