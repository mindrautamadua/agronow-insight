"use client";

import { useEffect, useMemo, useState } from "react";
import { Sparkles, BookOpen, Users, Flame, Building2, Search, ChevronDown } from "lucide-react";
import { fetchWishlist, type WishlistData } from "@/lib/data";
import { fmtNum } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui";

const SOURCES = [
  { key: "internal", label: "Katalog Internal" },
  { key: "wallet", label: "Learning Wallet (eksternal)" },
] as const;

export default function WishlistPage() {
  const [data, setData] = useState<WishlistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("internal");
  const [year, setYear] = useState(0);
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchWishlist(source, year).then(setData).finally(() => setLoading(false));
  }, [source, year]);

  const top = useMemo(() => {
    const rows = data?.topPelatihan ?? [];
    const s = q.trim().toLowerCase();
    return s ? rows.filter(r => r.label.toLowerCase().includes(s)) : rows;
  }, [data, q]);

  if (loading) return <PageSkeleton cards={4} tabs variant="chart" />;
  if (!data) return null;

  const { kpi } = data;
  const maxPeminat = Math.max(1, ...(data.topPelatihan.slice(0, 1).map(r => r.peminat)));
  const kpis = [
    { label: "Total Permintaan", value: fmtNum(kpi.total), sub: "entri wishlist", icon: Sparkles, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
    { label: "Pelatihan Diminati", value: fmtNum(kpi.pelatihan), sub: "program berbeda", icon: BookOpen, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Peminat", value: fmtNum(kpi.peminat), sub: "karyawan unik", icon: Users, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { label: "Prioritas Tinggi", value: fmtNum(kpi.prioritasTinggi), sub: "prioritas 1–3", icon: Flame, tone: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-500" /> Demand &amp; Wishlist Pelatihan
          </h1>
          <p className="text-xs text-[var(--muted)] mt-1">Pelatihan yang paling diinginkan karyawan — sinyal perencanaan · {data.year || "Semua tahun"} · sumber AgroNow Insight</p>
        </div>
        <Selector value={String(year)} onChange={v => setYear(Number(v))}
          options={[{ value: "0", label: "Semua tahun" }, ...data.years.map(y => ({ value: String(y), label: String(y) }))]} />
      </div>

      {/* Source toggle */}
      <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-card2)] p-0.5">
        {SOURCES.map(s => (
          <button key={s.key} onClick={() => { setSource(s.key); setYear(0); }}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              source === s.key ? "bg-[var(--bg-card)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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

        <div className="grid lg:grid-cols-2 gap-4">
          <CountCard title="Peminat per Entitas" rows={data.perEntitas} />
          <CountCard title="Sebaran Prioritas" rows={data.byPriority} />
        </div>

        {/* Top pelatihan diminati */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-[var(--foreground)]">Pelatihan Paling Diminati</h3>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari pelatihan…"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors" />
            </div>
            <p className="text-xs text-[var(--muted)] tabular-nums">{top.length} pelatihan</p>
          </div>

          {top.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-10">Tidak ada data.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="py-2.5 px-2 w-8">#</th>
                    <th className="py-2.5 px-2">Pelatihan</th>
                    <th className="py-2.5 px-2 w-[260px]">Peminat</th>
                    <th className="py-2.5 px-2 text-right w-28">Prioritas Tinggi</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((r, i) => (
                    <tr key={r.label + i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card2)]/50 align-middle">
                      <td className="py-2.5 px-2 text-[11px] text-[var(--muted)] tabular-nums">{i + 1}</td>
                      <td className="py-2.5 px-2 text-[var(--foreground)] max-w-[460px]"><span className="line-clamp-2 leading-snug">{r.label}</span></td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full bg-[var(--bg-card2)] overflow-hidden min-w-[80px]">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${(r.peminat / maxPeminat) * 100}%` }} />
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-[var(--foreground)] w-10 text-right">{fmtNum(r.peminat)}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-amber-500 font-medium">{r.prioritas > 0 ? fmtNum(r.prioritas) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-[var(--muted)]">Maks 200 pelatihan teratas berdasarkan jumlah peminat (status aktif).</p>
        </div>
      </div>
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

function CountCard({ title, rows }: { title: string; rows: { label: string; n: number }[] }) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-bold text-[var(--foreground)] mb-4">{title}</h3>
      {rows.length === 0 ? <p className="text-xs text-[var(--muted)] py-4 text-center">Belum ada data.</p> : (
        <div className="space-y-2.5">
          {rows.map(r => (
            <div key={r.label} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-xs text-[var(--foreground)] truncate" title={r.label}>{r.label}</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--bg-card2)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${(r.n / max) * 100}%` }} />
              </div>
              <span className="w-12 shrink-0 text-right text-xs font-semibold text-[var(--foreground)] tabular-nums">{fmtNum(r.n)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
