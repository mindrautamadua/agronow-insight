"use client";

import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Building2, BookOpen, Users, ArrowUp, Search, ChevronDown, ClipboardCheck } from "lucide-react";
import { fetchEfektivitas, type EfektivitasData, type EfekPelatihan } from "@/lib/data";
import { fmtNum } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui";

const gainTone = (v: number) => v >= 25 ? "text-emerald-500" : v >= 10 ? "text-blue-500" : v > 0 ? "text-amber-500" : "text-red-500";

export default function EfektivitasPage() {
  const [data, setData] = useState<EfektivitasData | null>(null);
  const [loading, setLoading] = useState(true);
  const [entitas, setEntitas] = useState(0);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"n" | "gain" | "post">("n");

  useEffect(() => {
    setLoading(true);
    fetchEfektivitas(entitas).then(setData).finally(() => setLoading(false));
  }, [entitas]);

  const rows = useMemo(() => {
    const src = data?.perPelatihan ?? [];
    const s = q.trim().toLowerCase();
    const f = s ? src.filter(r => r.label.toLowerCase().includes(s)) : src;
    return [...f].sort((a, b) => sort === "n" ? b.n - a.n : sort === "gain" ? b.gain - a.gain : b.post - a.post);
  }, [data, q, sort]);

  if (loading) return <PageSkeleton cards={5} cardCols="lg:grid-cols-5" tabs variant="chart" />;
  if (!data) return null;

  const { kpi } = data;
  const kpis = [
    { label: "Pelatihan Dievaluasi", value: fmtNum(kpi.pelatihan), sub: "Kirkpatrick L3", icon: BookOpen, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
    { label: "Peserta", value: fmtNum(kpi.peserta), sub: "pre & post test", icon: Users, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { label: "Rata-rata Pre", value: kpi.pre.toLocaleString("id-ID"), sub: "skala 0–100", icon: TrendingUp, tone: "text-slate-400 bg-slate-500/10 border-slate-500/20" },
    { label: "Rata-rata Post", value: kpi.post.toLocaleString("id-ID"), sub: "skala 0–100", icon: TrendingUp, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Rata-rata Gain", value: `+${kpi.gain.toLocaleString("id-ID")}`, sub: `${kpi.pctNaik}% peserta naik`, icon: ArrowUp, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-500" /> Efektivitas Pelatihan
          </h1>
          <p className="text-xs text-[var(--muted)] mt-1">Evaluasi Kirkpatrick Level 3 — kenaikan nilai pre→post (skala 0–100) · sumber AgroNow Insight</p>
        </div>
        <Selector value={entitas} onChange={setEntitas}
          options={[{ value: 0, label: "Semua entitas" }, ...data.entitasList.map(e => ({ value: e.id, label: e.nama }))]} />
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
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

        {/* Pre vs Post overall + per entitas gain */}
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h3 className="text-sm font-bold text-[var(--foreground)] mb-4">Pre → Post (rata-rata)</h3>
            <PrePostBar pre={kpi.pre} post={kpi.post} />
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h3 className="text-sm font-bold text-[var(--foreground)] mb-4">Gain per Entitas</h3>
            {data.perEntitas.length === 0 ? <p className="text-xs text-[var(--muted)] py-4 text-center">Belum ada data.</p> : (
              <div className="space-y-2.5">
                {data.perEntitas.map(e => (
                  <div key={e.label} className="flex items-center gap-3">
                    <span className="w-32 shrink-0 text-xs text-[var(--foreground)] truncate" title={e.label}>{e.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-[var(--bg-card2)] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${Math.min(100, e.gain * 2)}%` }} />
                    </div>
                    <span className={`w-12 shrink-0 text-right text-xs font-bold tabular-nums ${gainTone(e.gain)}`}>+{e.gain}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Tindak lanjut L3 — penilaian oleh atasan */}
        {data.l3Atasan.penilaian > 0 && (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-emerald-500" /> Tindak Lanjut L3 — Penilaian oleh Atasan
            </h3>
            <p className="text-[11px] text-[var(--muted)] mt-0.5 mb-4">Perubahan perilaku pasca-pelatihan dinilai atasan langsung (Kirkpatrick Level 3)</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <L3Stat label="Penilaian" value={fmtNum(data.l3Atasan.penilaian)} sub={`${fmtNum(data.l3Atasan.kelas)} kelas`} />
              <L3Stat label="Peserta Dinilai" value={fmtNum(data.l3Atasan.dinilai)} sub="oleh atasan" />
              <L3Stat label="Tuntas" value={fmtNum(data.l3Atasan.tuntas)} sub={`dari ${fmtNum(data.l3Atasan.penilaian)}`} />
              <L3Stat label="% Tuntas" value={`${data.l3Atasan.pctTuntas.toLocaleString("id-ID")}%`} sub={`rata-rata progres ${data.l3Atasan.avgProgress}%`} accent />
            </div>
            <div className="mt-3 h-2 rounded-full bg-[var(--bg-card2)] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${Math.min(100, data.l3Atasan.pctTuntas)}%` }} />
            </div>
          </div>
        )}

        {/* Per pelatihan */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-[var(--foreground)]">Efektivitas per Pelatihan</h3>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari pelatihan…"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors" />
            </div>
            <Selector value={sort} onChange={v => setSort(v as "n" | "gain" | "post")} text
              options={[{ value: "n", label: "Urut: Peserta" }, { value: "gain", label: "Urut: Gain" }, { value: "post", label: "Urut: Post" }]} />
            <p className="text-xs text-[var(--muted)] tabular-nums">{rows.length} pelatihan</p>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-10">Tidak ada data.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="py-2.5 px-2 w-8">#</th>
                    <th className="py-2.5 px-2">Pelatihan</th>
                    <th className="py-2.5 px-2 text-right w-20">Peserta</th>
                    <th className="py-2.5 px-2 w-[220px]">Pre → Post</th>
                    <th className="py-2.5 px-2 text-right w-16">Gain</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.label + i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card2)]/50 align-middle">
                      <td className="py-2.5 px-2 text-[11px] text-[var(--muted)] tabular-nums">{i + 1}</td>
                      <td className="py-2.5 px-2 text-[var(--foreground)] max-w-[420px]"><span className="line-clamp-2 leading-snug">{r.label}</span></td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-[var(--muted)]">{fmtNum(r.n)}</td>
                      <td className="py-2.5 px-2"><PrePostBar pre={r.pre} post={r.post} compact /></td>
                      <td className={`py-2.5 px-2 text-right text-xs font-bold tabular-nums ${gainTone(r.gain)}`}>+{r.gain}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-[var(--muted)]">Hanya pelatihan dengan ≥5 peserta dievaluasi, maks 200.</p>
        </div>
      </div>
    </div>
  );
}

function L3Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card2)]/50 px-3 py-2.5">
      <p className={`text-xl font-bold tabular-nums ${accent ? "text-emerald-500" : "text-[var(--foreground)]"}`}>{value}</p>
      <p className="text-[11px] font-semibold text-[var(--foreground)] mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-[var(--muted)]">{sub}</p>}
    </div>
  );
}

function PrePostBar({ pre, post, compact }: { pre: number; post: number; compact?: boolean }) {
  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <div className="flex items-center gap-2">
        {!compact && <span className="w-9 text-[11px] text-[var(--muted)]">Pre</span>}
        <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-card2)] overflow-hidden">
          <div className="h-full rounded-full bg-slate-400/70" style={{ width: `${pre}%` }} />
        </div>
        <span className="w-9 text-right text-[11px] tabular-nums text-[var(--muted)]">{pre}</span>
      </div>
      <div className="flex items-center gap-2">
        {!compact && <span className="w-9 text-[11px] text-[var(--muted)]">Post</span>}
        <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-card2)] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${post}%` }} />
        </div>
        <span className="w-9 text-right text-[11px] tabular-nums font-medium text-emerald-500">{post}</span>
      </div>
    </div>
  );
}

function Selector({ value, onChange, options, text }: {
  value: number | string; onChange: (v: never) => void; options: { value: number | string; label: string }[]; text?: boolean;
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange((text ? e.target.value : Number(e.target.value)) as never)}
        className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-card)] pl-3 pr-8 py-2 text-sm font-medium text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 max-w-[260px]">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" />
    </div>
  );
}
