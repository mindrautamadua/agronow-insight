import { requireUser } from "@/lib/apiAuth";
import { query, queryOne } from "@/lib/db";
import type { RowDataPacket } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Knowledge Management (read-only) — insight konten pembelajaran/portal pengetahuan
 * dari `_content` (status publish) + engagement (`_content_comment`, `_member_bookmark`,
 * `_content_download`, `_media_download`) dan tag (`_content_tags`).
 * Bersifat org-wide (mayoritas group_id='all'), jadi difilter per TAHUN saja
 * (content_create_date), bukan per entitas. `year=0` → semua tahun.
 */
const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
const clean = (v: string | null): string | null => {
  const t = decodeEntities(v ?? "").replace(/\s+/g, " ").trim();
  return t && t.toLowerCase() !== "null" ? t : null;
};
// Author kerap diisi placeholder "-"/"–" → anggap anonim.
const cleanAuthor = (v: string | null): string | null => {
  const t = clean(v);
  return t && t !== "-" && t !== "–" ? t : null;
};
// SQL: author valid (bukan kosong/"-").
const AUTHOR_OK = "NULLIF(NULLIF(TRIM(content_author), ''), '-') IS NOT NULL";

interface BarRow extends RowDataPacket { label: string | null; n: number }

export async function GET(request: Request) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const reqYear = Number(new URL(request.url).searchParams.get("year")) || 0;

  try {
    // Tahun tersedia (dari tanggal pembuatan konten publish).
    const years = (await query<RowDataPacket & { y: number }>(
      `SELECT DISTINCT EXTRACT(YEAR FROM content_create_date)::int AS y
         FROM _content
        WHERE content_status = 'publish' AND content_create_date IS NOT NULL
          AND EXTRACT(YEAR FROM content_create_date) > 2000
        ORDER BY y DESC`)).map(r => Number(r.y)).filter(Boolean);
    // `year` divalidasi terhadap whitelist → aman di-interpolasi (integer).
    const year = years.includes(reqYear) ? reqYear : 0;
    const yc = (col: string) => (year ? ` AND EXTRACT(YEAR FROM ${col})::int = ${year}` : "");
    const W = `content_status = 'publish'${year ? ` AND EXTRACT(YEAR FROM content_create_date)::int = ${year}` : ""}`;

    const k = await queryOne<RowDataPacket & { konten: number; views: number; kontributor: number }>(
      `SELECT COUNT(*) AS konten, COALESCE(SUM(content_hits), 0) AS views,
              COUNT(DISTINCT NULLIF(NULLIF(TRIM(content_author), ''), '-')) AS kontributor
         FROM _content WHERE ${W}`);
    const komentar = (await queryOne<RowDataPacket & { n: number }>(`SELECT COUNT(*) AS n FROM _content_comment WHERE TRUE${yc("comment_create_date")}`))?.n ?? 0;
    const bookmark = (await queryOne<RowDataPacket & { n: number }>(`SELECT COUNT(*) AS n FROM _member_bookmark WHERE TRUE${yc("bookmark_create_date")}`))?.n ?? 0;
    const dlContent = (await queryOne<RowDataPacket & { n: number }>(`SELECT COUNT(*) AS n FROM _content_download WHERE TRUE${yc("cd_date")}`))?.n ?? 0;
    const dlMedia = (await queryOne<RowDataPacket & { n: number }>(`SELECT COUNT(*) AS n FROM _media_download WHERE TRUE${yc("md_date")}`))?.n ?? 0;

    // Tren: per bulan bila tahun dipilih, per tahun bila "Semua tahun".
    let trend: { label: string; konten: number; views: number }[];
    if (year) {
      const rows = await query<RowDataPacket & { mo: number; konten: number; views: number }>(
        `SELECT EXTRACT(MONTH FROM content_create_date)::int AS mo, COUNT(*) AS konten, COALESCE(SUM(content_hits), 0) AS views
           FROM _content WHERE ${W} AND content_create_date IS NOT NULL GROUP BY 1`);
      const m = new Map(rows.map(r => [Number(r.mo), r]));
      trend = BULAN.map((b, i) => { const r = m.get(i + 1); return { label: b, konten: Number(r?.konten ?? 0), views: Number(r?.views ?? 0) }; });
    } else {
      const rows = await query<RowDataPacket & { yr: number; konten: number; views: number }>(
        `SELECT EXTRACT(YEAR FROM content_create_date)::int AS yr, COUNT(*) AS konten, COALESCE(SUM(content_hits), 0) AS views
           FROM _content
          WHERE content_status = 'publish' AND content_create_date IS NOT NULL AND EXTRACT(YEAR FROM content_create_date) > 2000
          GROUP BY 1 ORDER BY 1`);
      trend = rows.slice(-8).map(r => ({ label: String(r.yr), konten: Number(r.konten), views: Number(r.views) }));
    }

    // Topik populer — agregat tag global (sepanjang waktu).
    const topTags = (await query<BarRow>(
      `SELECT tags_name AS label, COALESCE(tags_count, 0) AS n FROM _content_tags
        WHERE NULLIF(TRIM(tags_name), '') IS NOT NULL ORDER BY tags_count DESC NULLS LAST LIMIT 12`))
      .map(r => ({ label: clean(r.label) ?? "—", n: Number(r.n) }));

    const topContent = (await query<RowDataPacket & { id: number; judul: string | null; author: string | null; views: number; tgl: string | null }>(
      `SELECT content_id AS id, content_name AS judul, content_author AS author,
              COALESCE(content_hits, 0) AS views, content_create_date::date AS tgl
         FROM _content WHERE ${W} ORDER BY content_hits DESC NULLS LAST LIMIT 12`))
      .map(r => ({ id: Number(r.id), judul: clean(r.judul) ?? "(Tanpa judul)", author: cleanAuthor(r.author), views: Number(r.views), tgl: r.tgl ? String(r.tgl).slice(0, 10) : null }));

    const topAuthor = (await query<RowDataPacket & { label: string | null; konten: number; views: number }>(
      `SELECT TRIM(content_author) AS label, COUNT(*) AS konten, COALESCE(SUM(content_hits), 0) AS views
         FROM _content WHERE ${W} AND ${AUTHOR_OK}
        GROUP BY 1 ORDER BY views DESC NULLS LAST LIMIT 8`))
      .map(r => ({ label: clean(r.label) ?? "—", konten: Number(r.konten), views: Number(r.views) }));

    return Response.json({
      year, years,
      kpi: {
        konten: Number(k?.konten ?? 0), views: Number(k?.views ?? 0),
        komentar: Number(komentar), bookmark: Number(bookmark),
        unduhan: Number(dlContent) + Number(dlMedia), kontributor: Number(k?.kontributor ?? 0),
      },
      trend, topTags, topContent, topAuthor,
    });
  } catch (err) {
    console.error("km GET error", err);
    return Response.json({ error: "Gagal memuat data knowledge management." }, { status: 500 });
  }
}
