import { requireUser } from "@/lib/apiAuth";
import { query, queryOne } from "@/lib/db";
import type { RowDataPacket } from "mysql2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Detail satu konten (read-only) — info konten + engagement (komentar/bookmark/
 * unduhan) + komentar terbaru. `comment_text` bertipe bytea → dikonversi di JS
 * (Buffer→utf8) agar aman dari byte invalid; HTML di-strip jadi teks ringkas.
 */
function decodeEntities(s: string): string {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, " ");
}
const clean = (v: string | null): string | null => {
  const t = decodeEntities(v ?? "").replace(/\s+/g, " ").trim();
  return t && t.toLowerCase() !== "null" ? t : null;
};
const cleanAuthor = (v: string | null): string | null => {
  const t = clean(v);
  return t && t !== "-" && t !== "–" ? t : null;
};
const stripHtml = (v: string | null): string | null => clean((v ?? "").replace(/<[^>]*>/g, " "));
const norm = (v: string | null): string | null => { const t = clean(v); return t && t.toLowerCase() !== "all" ? t : null; };

// Heuristik spam komentar (tak ada flag status di DB — semua comment_status='1').
// Tanda kuat: berisi URL/anchor/BBCode link, atau kata kunci spam khas.
const SPAM_LINK = /(https?:\/\/|www\.[a-z0-9]|<a\s+href|href\s*=|\[url|\[link)/i;
const SPAM_WORD = /\b(casino|viagra|cialis|payday\s*loan|essay\s*(writer|writing)|write\s+my\s+essay|porn|xxx|escort|zithromax|azithromycin|pharmac(y|ies)|crypto\s*pump)\b/i;
function looksSpam(raw: string, text: string): boolean {
  return SPAM_LINK.test(raw) || SPAM_LINK.test(text) || SPAM_WORD.test(text);
}

interface ContentRow extends RowDataPacket {
  id: number; judul: string | null; author: string | null; source: string | null;
  tags: string | null; views: number; tgl: string | null; bidang: string | null; descr: string | null;
}
interface CommentRow extends RowDataPacket {
  id: number; nama: string | null; teks_raw: Buffer | null; rate: number | null; tgl: string | null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireUser();
  if ("response" in g) return g.response;

  const { id } = await params;
  const cid = Number(id);
  if (!Number.isInteger(cid) || cid <= 0) return Response.json({ error: "ID konten tidak valid." }, { status: 400 });

  try {
    const c = await queryOne<ContentRow>(
      `SELECT content_id AS id, content_name AS judul, content_author AS author, content_source AS source,
              content_tags AS tags, COALESCE(content_hits, 0) AS views, content_create_date::date AS tgl,
              content_bidang AS bidang, content_desc AS descr
         FROM _content WHERE content_id = ?`, [cid]);
    if (!c) return Response.json({ error: "Konten tidak ditemukan." }, { status: 404 });

    const eng = await queryOne<RowDataPacket & { komentar: number; bookmark: number; unduhan: number }>(
      `SELECT (SELECT COUNT(*) FROM _content_comment WHERE content_id = ?) AS komentar,
              (SELECT COUNT(*) FROM _member_bookmark  WHERE content_id = ?) AS bookmark,
              (SELECT COUNT(*) FROM _content_download  WHERE content_id = ?) AS unduhan`, [cid, cid, cid]);

    // Ambil batch lebih besar lalu saring spam; tampilkan ≤20 komentar bersih.
    const commentRows = await query<CommentRow>(
      `SELECT comment_id AS id, comment_name AS nama, comment_text AS teks_raw,
              comment_rate AS rate, comment_create_date::date AS tgl
         FROM _content_comment WHERE content_id = ?
        ORDER BY comment_create_date DESC NULLS LAST LIMIT 80`, [cid]);

    const comments: { id: number; nama: string | null; teks: string; rate: number | null; tgl: string | null }[] = [];
    let spamHidden = 0;
    for (const r of commentRows) {
      const raw = r.teks_raw ? Buffer.from(r.teks_raw).toString("utf8") : "";
      const teks = (stripHtml(raw) ?? "").slice(0, 320);
      if (!teks) continue;
      if (looksSpam(raw, teks)) { spamHidden++; continue; }
      if (comments.length < 20) comments.push({ id: Number(r.id), nama: clean(r.nama), teks, rate: r.rate ? Number(r.rate) : null, tgl: r.tgl ? String(r.tgl).slice(0, 10) : null });
    }

    const tags = (clean(c.tags) ?? "").split(",").map(t => t.trim()).filter(Boolean).slice(0, 10);
    const deskripsi = (stripHtml(c.descr) ?? "").slice(0, 280) || null;

    return Response.json({
      id: Number(c.id),
      judul: clean(c.judul) ?? "(Tanpa judul)",
      author: cleanAuthor(c.author),
      source: clean(c.source),
      tags,
      views: Number(c.views),
      tgl: c.tgl ? String(c.tgl).slice(0, 10) : null,
      bidang: norm(c.bidang),
      deskripsi,
      engagement: { komentar: Number(eng?.komentar ?? 0), bookmark: Number(eng?.bookmark ?? 0), unduhan: Number(eng?.unduhan ?? 0) },
      comments,
      spamHidden,
    });
  } catch (err) {
    console.error("km detail GET error", err);
    return Response.json({ error: "Gagal memuat detail konten." }, { status: 500 });
  }
}
