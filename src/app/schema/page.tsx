"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Database, KeyRound, Link2, Table2, AlertTriangle, Hash, GitBranch, Asterisk,
  Search, Crosshair, ArrowRight, Info, CheckCircle2,
} from "lucide-react";
import { PageSkeleton } from "@/components/ui";
import { cn, fmtNum } from "@/lib/utils";

interface Column {
  name: string; type: string; nullable: boolean; isPk: boolean; isUnique: boolean;
  isFk: boolean; inferredFk: boolean; refTable: string | null; refColumn: string | null; comment: string | null;
}
interface TableInfo { name: string; comment: string | null; description: string | null; used: boolean; rows: number; columns: Column[] }
interface Relationship { table: string; column: string; refTable: string; refColumn: string; onDelete: string | null; inferred: boolean }
interface SchemaData { database: string; hasRealForeignKeys: boolean; tables: TableInfo[]; relationships: Relationship[] }

type Rect = { x: number; y: number; w: number; h: number; cx: number; cy: number };
const NEIGHBOR_CAP = 14;

export default function SchemaPage() {
  const [data, setData] = useState<SchemaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tableFilter, setTableFilter] = useState<"all" | "used" | "unusedNonEmpty" | "empty">("all");
  const [focus, setFocus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/schema", { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then((d: SchemaData) => {
        setData(d);
        // Fokus awal: tabel dengan relasi keluar terbanyak (junction yang menarik).
        const out = new Map<string, number>();
        for (const r of d.relationships) out.set(r.table, (out.get(r.table) ?? 0) + 1);
        let best = d.tables[0]?.name ?? null;
        let bestN = -1;
        for (const [t, n] of out) if (n > bestN) { best = t; bestN = n; }
        setFocus(best);
      })
      .catch(() => setErr("Gagal membaca skema. Pastikan koneksi MySQL di .env.local benar."))
      .finally(() => setLoading(false));
  }, []);

  const byName = useMemo(() => new Map((data?.tables ?? []).map(t => [t.name, t])), [data]);
  const relCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data?.relationships ?? []) {
      m.set(r.table, (m.get(r.table) ?? 0) + 1);
      m.set(r.refTable, (m.get(r.refTable) ?? 0) + 1);
    }
    return m;
  }, [data]);

  if (loading) return <PageSkeleton maxW="max-w-[1400px]" cards={0} variant="cards" rows={12} cardCols="lg:grid-cols-4" />;
  if (err || !data) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Tidak dapat membaca skema</p>
            <p className="text-xs text-[var(--muted)] mt-1">{err}</p>
          </div>
        </div>
      </div>
    );
  }

  const totalCols = data.tables.reduce((s, t) => s + t.columns.length, 0);
  const emptyCount = data.tables.filter(t => t.rows === 0).length;
  const usedCount = data.tables.filter(t => t.used).length;
  const unusedNonEmptyCount = data.tables.filter(t => !t.used && t.rows > 0).length;
  const toggleFilter = (f: typeof tableFilter) => setTableFilter(c => (c === f ? "all" : f));
  const filtered = data.tables.filter(t => {
    if (q.trim() && !t.name.toLowerCase().includes(q.trim().toLowerCase())) return false;
    if (tableFilter === "used") return t.used;
    if (tableFilter === "unusedNonEmpty") return !t.used && t.rows > 0;
    if (tableFilter === "empty") return t.rows === 0;
    return true;
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header strip */}
      <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-br from-emerald-500/10 via-[var(--bg-card)] to-blue-500/10 p-5 flex items-center gap-4 flex-wrap">
        <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <Database className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">MySQL · {data.database || "—"}</p>
          <h2 className="text-base font-bold text-[var(--foreground)]">Skema & Relasi Database</h2>
        </div>
        <div className="flex gap-2 ml-auto flex-wrap">
          <Stat icon={Table2} label="Tabel" value={data.tables.length} />
          <Stat icon={CheckCircle2} label="Dipakai" value={usedCount} />
          <Stat icon={Hash} label="Kolom" value={totalCols} />
          <Stat icon={Link2} label="Relasi" value={data.relationships.length} />
        </div>
      </div>

      {/* Catatan relasi tersimpul */}
      {!data.hasRealForeignKeys && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-4 py-2.5 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-[12px] text-[var(--muted)] leading-relaxed">
            Database ini tidak mendefinisikan <span className="font-semibold text-[var(--foreground)]">foreign key</span> eksplisit.
            Relasi di bawah <span className="font-semibold text-[var(--foreground)]">disimpulkan dari pola nama kolom</span> (mis. <code className="px-1 rounded bg-[var(--bg-card2)]">id_member</code> → <code className="px-1 rounded bg-[var(--bg-card2)]">_member</code>) — bersifat indikatif, bukan constraint nyata.
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-[11px] text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Dipakai aplikasi</span>
        <span className="inline-flex items-center gap-1.5"><KeyRound className="w-3.5 h-3.5 text-amber-400" /> Primary Key</span>
        <span className="inline-flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5 text-violet-400" /> Relasi tersimpul</span>
        <span className="inline-flex items-center gap-1.5"><Asterisk className="w-3.5 h-3.5 text-blue-400" /> Unique</span>
        <span className="ml-auto italic">Klik tabel untuk menjadikannya fokus diagram.</span>
      </div>

      {/* Diagram fokus */}
      {focus && byName.has(focus) && (
        <FocusDiagram data={data} byName={byName} focus={focus} setFocus={setFocus} />
      )}

      {/* Pencarian + daftar tabel */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2"><Table2 className="w-4 h-4 text-emerald-400" /> Semua Tabel <span className="text-[var(--muted)] font-normal">({filtered.length})</span></h3>
          <div className="flex items-center gap-2 flex-wrap">
            {usedCount > 0 && (
              <button onClick={() => toggleFilter("used")} aria-pressed={tableFilter === "used"}
                className={cn("inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                  tableFilter === "used" ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                           : "border-[var(--border)] bg-[var(--bg-card2)] text-[var(--muted)] hover:text-[var(--foreground)]")}>
                <CheckCircle2 className="w-3.5 h-3.5" /> {usedCount} dipakai
              </button>
            )}
            {unusedNonEmptyCount > 0 && (
              <button onClick={() => toggleFilter("unusedNonEmpty")} aria-pressed={tableFilter === "unusedNonEmpty"}
                title="Tabel berisi data tapi belum dipakai fitur aplikasi"
                className={cn("inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                  tableFilter === "unusedNonEmpty" ? "border-violet-500/40 bg-violet-500/15 text-violet-600 dark:text-violet-400"
                           : "border-[var(--border)] bg-[var(--bg-card2)] text-[var(--muted)] hover:text-[var(--foreground)]")}>
                <Database className="w-3.5 h-3.5" /> {unusedNonEmptyCount} belum dipakai (ada isi)
              </button>
            )}
            {emptyCount > 0 && (
              <button onClick={() => toggleFilter("empty")} aria-pressed={tableFilter === "empty"}
                className={cn("inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                  tableFilter === "empty" ? "border-red-500/40 bg-red-500/15 text-red-600 dark:text-red-400"
                            : "border-[var(--border)] bg-[var(--bg-card2)] text-[var(--muted)] hover:text-[var(--foreground)]")}>
                <AlertTriangle className="w-3.5 h-3.5" /> {emptyCount} tabel kosong
              </button>
            )}
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari tabel…"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] pl-9 pr-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50" />
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {filtered.map(t => {
            const active = t.name === focus;
            const tier = t.rows === 0 ? "empty" : t.rows < 10 ? "low" : "ok";
            return (
              <button key={t.name} onClick={() => { setFocus(t.name); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className={cn("text-left rounded-xl border px-3 py-2.5 transition-all",
                  active ? "border-emerald-500/50 bg-emerald-500/10"
                    : tier === "empty" ? "border-red-500/30 bg-red-500/[0.05] hover:border-red-500/50"
                    : tier === "low" ? "border-amber-500/30 bg-amber-500/[0.05] hover:border-amber-500/50"
                    : "border-[var(--border)] bg-[var(--bg-card2)] hover:border-[var(--border-md)]")}>
                <div className="flex items-center gap-1.5">
                  <Table2 className={cn("w-3.5 h-3.5 shrink-0",
                    active ? "text-emerald-400" : tier === "empty" ? "text-red-500" : tier === "low" ? "text-amber-500" : "text-[var(--muted)]")} />
                  <span className="font-mono text-[12px] font-semibold text-[var(--foreground)] truncate">{t.name}</span>
                  {t.used && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-500" aria-label="Dipakai di aplikasi" />}
                  {tier === "empty" && (
                    <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-red-600 dark:text-red-400 bg-red-500/15 border border-red-500/30 rounded px-1.5 py-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" /> Kosong
                    </span>
                  )}
                  {tier === "low" && (
                    <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5">
                      <AlertTriangle className="w-2.5 h-2.5" /> Minim
                    </span>
                  )}
                </div>
                {t.description && (
                  <p className="mt-1 text-[11px] text-[var(--muted)] leading-snug line-clamp-2">{t.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[var(--muted)]">
                  <span>{t.columns.length} kolom</span>
                  <span>·</span>
                  <span className={cn(tier === "empty" && "text-red-600 dark:text-red-400 font-medium", tier === "low" && "text-amber-600 dark:text-amber-400 font-medium")}>
                    {tier === "empty" ? "0 baris" : `~${fmtNum(t.rows)} baris`}
                  </span>
                  {(relCount.get(t.name) ?? 0) > 0 && <><span>·</span><span className="text-violet-400">{relCount.get(t.name)} relasi</span></>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FocusDiagram({ data, byName, focus, setFocus }: {
  data: SchemaData; byName: Map<string, TableInfo>; focus: string; setFocus: (n: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [rects, setRects] = useState<Record<string, Rect>>({});
  const [size, setSize] = useState({ w: 0, h: 0 });

  // Relasi yang menyentuh fokus + tetangga (dibatasi).
  const { visible, edges, totalNeighbors } = useMemo(() => {
    const neigh = new Set<string>();
    const focusEdges: Relationship[] = [];
    for (const r of data.relationships) {
      if (r.table === focus) { neigh.add(r.refTable); focusEdges.push(r); }
      else if (r.refTable === focus) { neigh.add(r.table); focusEdges.push(r); }
    }
    neigh.delete(focus);
    const all = [...neigh];
    const shown = all.slice(0, NEIGHBOR_CAP);
    const vis = new Set<string>([focus, ...shown]);
    const e = data.relationships.filter(r => vis.has(r.table) && vis.has(r.refTable));
    return { visible: vis, edges: e, totalNeighbors: all.length };
  }, [data, focus]);

  const measure = useCallback(() => {
    const cont = containerRef.current;
    if (!cont) return;
    const base = cont.getBoundingClientRect();
    const next: Record<string, Rect> = {};
    cardRefs.current.forEach((el, name) => {
      const r = el.getBoundingClientRect();
      const x = r.left - base.left, y = r.top - base.top;
      next[name] = { x, y, w: r.width, h: r.height, cx: x + r.width / 2, cy: y + r.height / 2 };
    });
    setRects(next);
    setSize({ w: cont.scrollWidth, h: cont.scrollHeight });
  }, []);

  useLayoutEffect(() => {
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    cardRefs.current.forEach(el => ro.observe(el));
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); };
  }, [measure, focus, visible]); // re-measure saat fokus/tetangga berubah

  function edgePath(s: Rect, t: Rect) {
    const ltr = s.cx <= t.cx;
    const sx = ltr ? s.x + s.w : s.x, tx = ltr ? t.x : t.x + t.w, dir = ltr ? 1 : -1;
    const c = Math.max(40, Math.abs(tx - sx) / 2);
    return `M ${sx} ${s.cy} C ${sx + dir * c} ${s.cy}, ${tx - dir * c} ${t.cy}, ${tx} ${t.cy}`;
  }

  // Urutkan: fokus dulu, lalu tetangga.
  const order = [focus, ...[...visible].filter(n => n !== focus)];

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <Crosshair className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-bold text-[var(--foreground)]">Diagram Relasi — <span className="font-mono text-emerald-400">{focus}</span></h3>
        <span className="text-[11px] text-[var(--muted)]">
          {edges.length} relasi · {Math.min(totalNeighbors, NEIGHBOR_CAP)}/{totalNeighbors} tabel terkait
          {totalNeighbors > NEIGHBOR_CAP && " (dibatasi)"}
        </span>
      </div>
      {totalNeighbors === 0 && (
        <p className="text-[12px] text-[var(--muted)] py-6 text-center">Tidak ada relasi tersimpul untuk tabel ini.</p>
      )}

      <div ref={containerRef} className="relative mt-3">
        <svg className="absolute inset-0 pointer-events-none z-0" width={size.w} height={size.h}>
          <defs>
            <marker id="erd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0,0 L10,5 L0,10 z" fill="#8b5cf6" />
            </marker>
          </defs>
          {edges.map((r, i) => {
            const s = rects[r.table], t = rects[r.refTable];
            if (!s || !t) return null;
            return (
              <path key={i} d={edgePath(s, t)} fill="none" stroke="#8b5cf6"
                strokeWidth={1.4} strokeOpacity={0.5} strokeDasharray={r.inferred ? "5 4" : undefined}
                markerEnd="url(#erd-arrow)" />
            );
          })}
        </svg>

        <div className="relative z-10 flex flex-wrap gap-x-10 gap-y-7 justify-center">
          {order.map(name => {
            const t = byName.get(name);
            if (!t) return null;
            const isFocus = name === focus;
            // Hanya kolom relasional + PK (kartu ringkas).
            const relCols = t.columns.filter(c => c.isPk || c.isFk || c.inferredFk);
            const cols = relCols.length ? relCols : t.columns.slice(0, 4);
            return (
              <div key={name}
                ref={el => { if (el) cardRefs.current.set(name, el); else cardRefs.current.delete(name); }}
                onClick={() => !isFocus && setFocus(name)}
                className={cn("w-[230px] rounded-xl border bg-[var(--bg-card)] overflow-hidden transition-all shadow-sm",
                  isFocus ? "border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/20"
                          : "border-[var(--border)] hover:border-violet-500/40 cursor-pointer")}>
                <div className={cn("px-3.5 py-2.5 border-b border-[var(--border)] flex items-center gap-2",
                  isFocus ? "bg-emerald-500/10" : "bg-[var(--bg-card2)]")}>
                  <Table2 className={cn("w-3.5 h-3.5 shrink-0", isFocus ? "text-emerald-400" : "text-violet-400")} />
                  <span className="text-[12px] font-bold text-[var(--foreground)] font-mono truncate">{name}</span>
                  <span className="ml-auto text-[10px] text-[var(--muted)] bg-[var(--bg-card)] px-1.5 py-0.5 rounded tabular-nums shrink-0">~{fmtNum(t.rows)}</span>
                </div>
                {t.description && (
                  <p className="px-3.5 py-2 text-[10.5px] text-[var(--muted)] leading-snug border-b border-[var(--border)] bg-[var(--bg-card)]">{t.description}</p>
                )}
                <div className="divide-y divide-[var(--border)]">
                  {cols.map(c => (
                    <div key={c.name} className="px-3.5 py-1.5 flex items-center gap-2 text-[11.5px]" title={c.refTable ? `→ ${c.refTable}.${c.refColumn}` : c.type}>
                      <span className="shrink-0 w-4 flex justify-center">
                        {c.isPk ? <KeyRound className="w-3 h-3 text-amber-400" />
                          : (c.isFk || c.inferredFk) ? <Link2 className="w-3 h-3 text-violet-400" />
                          : c.isUnique ? <Asterisk className="w-3 h-3 text-blue-400" />
                          : <span className="w-1.5 h-1.5 rounded-full bg-[var(--muted)]/40" />}
                      </span>
                      <span className="font-mono truncate text-[var(--foreground)]">{c.name}</span>
                      {c.refTable && <span className="ml-auto text-[9px] text-violet-400 font-mono truncate max-w-[80px]" title={`${c.refTable}.${c.refColumn}`}>→{c.refTable.replace(/^_/, "")}</span>}
                    </div>
                  ))}
                  {relCols.length > 0 && t.columns.length > relCols.length && (
                    <div className="px-3.5 py-1 text-[10px] text-[var(--muted)] italic">+{t.columns.length - relCols.length} kolom lain</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5">
      <Icon className="w-4 h-4 text-emerald-400" />
      <div className="leading-none">
        <p className="text-sm font-bold text-[var(--foreground)] tabular-nums">{fmtNum(value)}</p>
        <p className="text-[10px] text-[var(--muted)]">{label}</p>
      </div>
    </div>
  );
}
