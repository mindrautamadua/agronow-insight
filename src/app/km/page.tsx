"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Library, FileText, Eye, MessageSquare, Bookmark, Download, PenLine,
  Tag, Search, ChevronDown, ChevronRight, X, Star, Loader2, ExternalLink,
} from "lucide-react";
import { fetchKm, fetchKmContent, type KmData, type KmBar, type KmContent, type KmContentDetail } from "@/lib/data";
import { fmtNum } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui";

// Format angka ringkas (1,2 rb / 3,4 jt) untuk views besar.
function fmtCompact(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (v >= 1e3) return `${(v / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`;
  return fmtNum(v);
}

export default function KmPage() {
  const [data, setData] = useState<KmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(0);
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<KmContent | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchKm(year).then(setData).finally(() => setLoading(false));
  }, [year]);

  const top = useMemo(() => {
    const rows = data?.topContent ?? [];
    const s = q.trim().toLowerCase();
    return s ? rows.filter(r => [r.judul, r.author ?? ""].some(v => v.toLowerCase().includes(s))) : rows;
  }, [data, q]);

  if (loading) return <PageSkeleton cards={6} cardCols="lg:grid-cols-6" variant="chart" />;
  if (!data) return null;

  const { kpi } = data;
  const kpis = [
    { label: "Konten Terbit", value: fmtNum(kpi.konten), sub: "status publish", icon: FileText, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Total Dilihat", value: fmtCompact(kpi.views), sub: "akumulasi views", icon: Eye, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { label: "Komentar", value: fmtNum(kpi.komentar), sub: "diskusi konten", icon: MessageSquare, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
    { label: "Disimpan", value: fmtNum(kpi.bookmark), sub: "bookmark member", icon: Bookmark, tone: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { label: "Unduhan", value: fmtNum(kpi.unduhan), sub: "konten & media", icon: Download, tone: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20" },
    { label: "Kontributor", value: fmtNum(kpi.kontributor), sub: "penulis berbeda", icon: PenLine, tone: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
  ];

  const maxViews = Math.max(1, ...top.map(r => r.views));

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Library className="w-5 h-5 text-emerald-500" /> Knowledge Management
          </h1>
          <p className="text-xs text-[var(--muted)] mt-1">
            Konten pembelajaran &amp; portal pengetahuan — produksi &amp; engagement · {data.year || "Semua tahun"} · sumber AgroNow Insight
          </p>
        </div>
        <Selector value={String(year)} onChange={v => setYear(Number(v))}
          options={[{ value: "0", label: "Semua tahun" }, ...data.years.map(y => ({ value: String(y), label: String(y) }))]} />
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${k.tone}`}><Icon className="w-4 h-4" /></div>
              <p className="text-2xl font-bold text-[var(--foreground)] mt-2.5 tabular-nums">{k.value}</p>
              <p className="text-[11px] font-semibold text-[var(--foreground)] mt-0.5">{k.label}</p>
              <p className="text-[10px] text-[var(--muted)]">{k.sub}</p>
            </div>
          );
        })}
      </div>

      <TrendCard trend={data.trend} perBulan={!!data.year} />

      <div className="grid lg:grid-cols-2 gap-4">
        <BarCard title="Topik Populer" icon={Tag} rows={data.topTags} suffix="konten" note="agregat tag sepanjang waktu" />
        <BarCard title="Kontributor Teratas" icon={PenLine}
          rows={data.topAuthor.map(a => ({ label: a.label, n: a.views }))} suffix="views"
          note="berdasarkan total views" />
      </div>

      {/* Konten terpopuler */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-[var(--foreground)]">Konten Terpopuler</h3>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari judul / penulis…"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors" />
          </div>
          <p className="text-xs text-[var(--muted)] tabular-nums">{top.length} konten</p>
        </div>

        {top.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-10">Tidak ada data.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {top.map((r, i) => <ContentRow key={r.id} r={r} rank={i + 1} max={maxViews} onOpen={setDetail} />)}
          </ul>
        )}
      </div>

      {detail && <KmContentModal item={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function ContentRow({ r, rank, max, onOpen }: { r: KmContent; rank: number; max: number; onOpen: (r: KmContent) => void }) {
  return (
    <li>
      <button type="button" onClick={() => onOpen(r)}
        className="group w-full flex items-center gap-3 py-2.5 text-left rounded-lg -mx-2 px-2 transition-colors hover:bg-[var(--bg-card2)]/60">
        <span className="w-6 shrink-0 text-[11px] text-[var(--muted)] tabular-nums text-right">{rank}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--foreground)] truncate" title={r.judul}>{r.judul}</p>
          <p className="text-[11px] text-[var(--muted)] truncate">{[r.author, r.tgl].filter(Boolean).join(" · ") || "—"}</p>
        </div>
        <div className="hidden sm:block w-40 h-2 rounded-full bg-[var(--bg-card2)] overflow-hidden shrink-0">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${(r.views / max) * 100}%` }} />
        </div>
        <span className="shrink-0 w-20 text-right text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400">
          {fmtNum(r.views)} <span className="text-[10px] font-normal text-[var(--muted)]">views</span>
        </span>
        <ChevronRight className="w-4 h-4 shrink-0 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </li>
  );
}

function KmContentModal({ item, onClose }: { item: KmContent; onClose: () => void }) {
  const [data, setData] = useState<KmContentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true; setLoading(true); setError(null);
    fetchKmContent(item.id)
      .then(d => { if (alive) setData(d); })
      .catch(e => { if (alive) setError((e as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [item.id]);

  const stats = [
    { label: "Dilihat", value: fmtNum(data?.views ?? item.views), icon: Eye, tone: "text-blue-600 dark:text-blue-400" },
    { label: "Komentar", value: fmtNum(data?.engagement.komentar ?? 0), icon: MessageSquare, tone: "text-violet-600 dark:text-violet-400" },
    { label: "Disimpan", value: fmtNum(data?.engagement.bookmark ?? 0), icon: Bookmark, tone: "text-amber-600 dark:text-amber-400" },
    { label: "Unduhan", value: fmtNum(data?.engagement.unduhan ?? 0), icon: Download, tone: "text-cyan-600 dark:text-cyan-400" },
  ];
  const isUrl = !!data?.source && /^https?:\/\//i.test(data.source);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
          <div className="min-w-0 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"><FileText className="w-4 h-4" /></div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-[var(--foreground)] leading-snug">{item.judul}</h3>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">{[data?.author ?? item.author, data?.tgl ?? item.tgl, data?.bidang].filter(Boolean).join(" · ") || "—"}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          {/* Stat engagement */}
          <div className="grid grid-cols-4 gap-2">
            {stats.map(s => {
              const Icon = s.icon;
              return (
                <div key={s.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card2)]/50 px-3 py-2">
                  <Icon className={`w-3.5 h-3.5 ${s.tone}`} />
                  <p className="text-sm font-bold text-[var(--foreground)] tabular-nums mt-1">{s.value}</p>
                  <p className="text-[10px] text-[var(--muted)]">{s.label}</p>
                </div>
              );
            })}
          </div>

          {data?.tags && data.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.tags.map(t => (
                <span key={t} className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-medium px-1.5 py-0.5">
                  <Tag className="w-2.5 h-2.5" /> {t}
                </span>
              ))}
            </div>
          )}

          {data?.deskripsi && <p className="text-xs text-[var(--muted)] leading-relaxed">{data.deskripsi}{data.deskripsi.length >= 280 ? "…" : ""}</p>}
          {data?.source && (
            <p className="text-[11px] text-[var(--muted)]">
              Sumber: {isUrl
                ? <a href={data.source} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline inline-flex items-center gap-1 break-all">{data.source}<ExternalLink className="w-3 h-3 shrink-0" /></a>
                : <span className="text-[var(--foreground)]">{data.source}</span>}
            </p>
          )}

          {/* Komentar */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">Komentar terbaru</p>
              {!!data?.spamHidden && <span className="text-[10px] text-[var(--muted)]">{data.spamHidden} spam disembunyikan</span>}
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-[var(--muted)]"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : error ? (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            ) : !data || data.comments.length === 0 ? (
              <p className="text-sm text-[var(--muted)] text-center py-6">{data && data.spamHidden > 0 ? "Komentar tersembunyi (terdeteksi spam)." : "Belum ada komentar."}</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {data.comments.map(c => (
                  <li key={c.id} className="py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-[var(--foreground)] truncate">{c.nama || "Anonim"}</p>
                      <div className="flex items-center gap-2 shrink-0">
                        {c.rate ? <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500"><Star className="w-3 h-3 fill-amber-500" />{c.rate}</span> : null}
                        {c.tgl && <span className="text-[10px] text-[var(--muted)] tabular-nums">{c.tgl}</span>}
                      </div>
                    </div>
                    <p className="text-xs text-[var(--muted)] leading-snug mt-0.5 line-clamp-3">{c.teks}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrendCard({ trend, perBulan }: { trend: { label: string; konten: number; views: number }[]; perBulan: boolean }) {
  const max = Math.max(1, ...trend.map(t => t.konten));
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-emerald-500" /> Produksi Konten {perBulan ? "Bulanan" : "Tahunan"}
        <span className="text-[var(--muted)] font-normal text-xs">· konten · views</span>
      </h3>
      <div className={`grid grid-cols-2 sm:grid-cols-4 ${perBulan ? "lg:grid-cols-6" : "lg:grid-cols-8"} gap-2.5`}>
        {trend.map(t => {
          const active = t.konten > 0;
          const intensity = active ? 0.08 + 0.34 * (t.konten / max) : 0;
          return (
            <div key={t.label} className="rounded-xl border border-[var(--border)] p-3"
              style={{ backgroundColor: active ? `rgba(16,185,129,${intensity})` : "transparent" }}>
              <p className="text-[11px] text-[var(--muted)]">{t.label}</p>
              <p className="text-xl font-bold text-[var(--foreground)] tabular-nums mt-0.5">{active ? fmtNum(t.konten) : "—"}</p>
              <p className="text-[10px] text-[var(--muted)] mt-0.5">{active ? `${fmtCompact(t.views)} views` : "—"}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarCard({ title, icon: Icon, rows, suffix, note }: { title: string; icon: React.ElementType; rows: KmBar[]; suffix: string; note?: string }) {
  const top = rows.slice(0, 10);
  const max = Math.max(1, ...top.map(r => r.n));
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2 mb-4"><Icon className="w-4 h-4 text-emerald-500" /> {title}</h3>
      {top.length === 0 ? (
        <p className="text-xs text-[var(--muted)] py-6 text-center">Belum ada data.</p>
      ) : (
        <div className="space-y-2.5">
          {top.map(r => (
            <div key={r.label} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-xs text-[var(--foreground)] truncate" title={r.label}>{r.label}</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--bg-card2)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${(r.n / max) * 100}%` }} />
              </div>
              <span className="w-16 shrink-0 text-right text-xs font-semibold text-[var(--foreground)] tabular-nums">{fmtCompact(r.n)}</span>
            </div>
          ))}
        </div>
      )}
      {note && <p className="text-[10px] text-[var(--muted)] mt-3">{note} · satuan: {suffix}</p>}
    </div>
  );
}

function Selector({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-card)] pl-3 pr-8 py-2 text-sm font-medium text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" />
    </div>
  );
}
