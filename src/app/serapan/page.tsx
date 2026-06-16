"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Coins, Receipt, Target, BadgePercent, Users, Clock, Building2, Layers, Search, ChevronDown,
} from "lucide-react";
import { fetchSerapan, type SerapanData, type SerapanBar, type SerapanMember } from "@/lib/data";
import { fmtNum, fmtRupiah } from "@/lib/utils";
import { Avatar, PageSkeleton } from "@/components/ui";

// Warna berdasar % serapan (rendah=merah, sedang=amber, baik=emerald).
function tone(pct: number | null) {
  if (pct == null) return { text: "text-[var(--muted)]", bar: "bg-[var(--bg-card2)]" };
  if (pct < 33) return { text: "text-red-600 dark:text-red-400", bar: "bg-gradient-to-r from-red-500 to-rose-500" };
  if (pct < 67) return { text: "text-amber-600 dark:text-amber-400", bar: "bg-gradient-to-r from-amber-500 to-orange-500" };
  return { text: "text-emerald-600 dark:text-emerald-400", bar: "bg-gradient-to-r from-emerald-500 to-blue-500" };
}
const pctStr = (p: number | null) => (p == null ? "—" : `${p.toLocaleString("id-ID")}%`);
// fmtRupiah menampilkan "Gratis" untuk 0 (cocok utk biaya, keliru utk anggaran) →
// di sini 0 = "Rp 0" (tidak ada realisasi/target).
const rp = (v: number) => (v === 0 ? "Rp 0" : fmtRupiah(v));

export default function SerapanPage() {
  const [data, setData] = useState<SerapanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(0);
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchSerapan(year).then(setData).finally(() => setLoading(false));
  }, [year]);

  const members = useMemo(() => {
    const rows = data?.members ?? [];
    const s = q.trim().toLowerCase();
    return s ? rows.filter(m => [m.nama, m.grp ?? "", m.level ?? ""].some(v => v.toLowerCase().includes(s))) : rows;
  }, [data, q]);

  if (loading) return <PageSkeleton cards={6} cardCols="lg:grid-cols-6" variant="chart" />;
  if (!data) return null;

  const { kpi } = data;
  const kpis = [
    { label: "Target Anggaran", value: rp(kpi.target), sub: "alokasi wallet", icon: Target, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
    { label: "Realisasi", value: rp(kpi.realisasi), sub: "terserap", icon: Receipt, tone: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { label: "% Serapan", value: pctStr(kpi.pctRp), sub: "realisasi / target", icon: BadgePercent, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Peserta", value: fmtNum(kpi.peserta), sub: "punya alokasi", icon: Users, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { label: "Realisasi JPL", value: fmtNum(kpi.jplRealisasi), sub: `dari ${fmtNum(kpi.jplTarget)} target`, icon: Clock, tone: "text-teal-500 bg-teal-500/10 border-teal-500/20" },
    { label: "% Serapan JPL", value: pctStr(kpi.pctJpl), sub: "jpl realisasi / target", icon: BadgePercent, tone: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-500" /> Serapan Anggaran
          </h1>
          <p className="text-xs text-[var(--muted)] mt-1">
            Realisasi vs target anggaran &amp; JPL Learning Wallet · {data.year || "—"} · sumber AgroNow Insight
          </p>
        </div>
        <Selector value={String(year)} onChange={v => setYear(Number(v))}
          options={data.years.map(y => ({ value: String(y), label: String(y) }))} />
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

      <div className="grid lg:grid-cols-2 gap-4">
        <SerapanBarCard title="Serapan per Entitas" icon={Building2} rows={data.perEntitas} />
        <SerapanBarCard title="Serapan per Level BOD" icon={Layers} rows={data.perLevel} />
      </div>

      {/* Per peserta */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h3 className="text-sm font-bold text-[var(--foreground)]">Serapan per Peserta</h3>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama / entitas / level…"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors" />
          </div>
          <p className="text-xs text-[var(--muted)] tabular-nums">{members.length} peserta</p>
        </div>

        {members.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-10">Tidak ada data.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {members.map((m, i) => <MemberRow key={`${m.id}-${i}`} m={m} rank={i + 1} />)}
          </ul>
        )}
        <p className="text-[11px] text-[var(--muted)]">Maks 600 peserta teratas (realisasi terbesar). % &gt; 100% = realisasi melebihi target.</p>
      </div>
    </div>
  );
}

function SerapanBarCard({ title, icon: Icon, rows }: { title: string; icon: React.ElementType; rows: SerapanBar[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2 mb-4"><Icon className="w-4 h-4 text-emerald-500" /> {title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--muted)] py-6 text-center">Belum ada data.</p>
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const t = tone(r.pct);
            const fill = Math.min(100, r.pct ?? 0);
            return (
              <div key={r.label}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-xs text-[var(--foreground)] truncate" title={r.label}>{r.label}</span>
                  <span className={`shrink-0 text-xs font-semibold tabular-nums ${t.text}`}>{pctStr(r.pct)}</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--bg-card2)] overflow-hidden">
                  <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${fill}%` }} />
                </div>
                <p className="text-[10px] text-[var(--muted)] mt-0.5 tabular-nums">{rp(r.realisasi)} <span className="opacity-60">/ {rp(r.target)}</span></p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MemberRow({ m, rank }: { m: SerapanMember; rank: number }) {
  const t = tone(m.pct);
  const fill = Math.min(100, m.pct ?? 0);
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="w-6 shrink-0 text-[11px] text-[var(--muted)] tabular-nums text-right">{rank}</span>
      <Avatar nama={m.nama} photo={m.photo} className="w-8 h-8 text-xs" />
      <div className="min-w-0 w-[210px] shrink-0">
        <p className="text-sm font-medium text-[var(--foreground)] truncate" title={m.nama}>{m.nama}</p>
        <p className="text-[11px] text-[var(--muted)] truncate">{[m.grp, m.level].filter(Boolean).join(" · ") || "—"}</p>
      </div>
      <div className="flex-1 min-w-[80px] h-2 rounded-full bg-[var(--bg-card2)] overflow-hidden">
        <div className={`h-full rounded-full ${t.bar}`} style={{ width: `${fill}%` }} />
      </div>
      <span className={`shrink-0 w-12 text-right text-xs font-semibold tabular-nums ${t.text}`}>{pctStr(m.pct)}</span>
      <div className="shrink-0 w-[150px] text-right">
        <p className="text-sm font-bold text-[var(--foreground)] tabular-nums">{rp(m.realisasi)}</p>
        <p className="text-[10px] text-[var(--muted)] tabular-nums">/ {rp(m.target)} target</p>
      </div>
    </li>
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
