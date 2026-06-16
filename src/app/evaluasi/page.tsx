"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, Users, GraduationCap, BookOpen, Search, ChevronDown, Smile } from "lucide-react";
import { fetchEvaluasi, type EvaluasiData, type EvalBar } from "@/lib/data";
import { fmtNum } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui";

const JENIS = [
  { key: "", label: "Semua" },
  { key: "narasumber", label: "Narasumber" },
  { key: "penyelenggaraan", label: "Penyelenggaraan" },
  { key: "sarana", label: "Sarana" },
] as const;

// Warna skor 0–100.
const scoreTone = (v: number) =>
  v >= 90 ? "text-emerald-500" : v >= 80 ? "text-blue-500" : v >= 70 ? "text-amber-500" : "text-red-500";
const barTone = (v: number) =>
  v >= 90 ? "from-emerald-500 to-emerald-400" : v >= 80 ? "from-blue-500 to-blue-400" : v >= 70 ? "from-amber-500 to-amber-400" : "from-red-500 to-red-400";

export default function EvaluasiPage() {
  const [data, setData] = useState<EvaluasiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [jenis, setJenis] = useState("");
  const [tipe, setTipe] = useState("");
  const [year, setYear] = useState(0);
  const [tab, setTab] = useState<"narasumber" | "pelatihan">("narasumber");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"n" | "avg">("n");

  useEffect(() => {
    setLoading(true);
    fetchEvaluasi(jenis, tipe, year).then(setData).finally(() => setLoading(false));
  }, [jenis, tipe, year]);

  const rows = useMemo(() => {
    const src = tab === "narasumber" ? data?.pengajar ?? [] : data?.pelatihan ?? [];
    const s = q.trim().toLowerCase();
    const filtered = s ? src.filter(r => r.label.toLowerCase().includes(s)) : src;
    return [...filtered].sort((a, b) => sort === "n" ? b.n - a.n : b.avg - a.avg);
  }, [data, tab, q, sort]);

  if (loading) return <PageSkeleton cards={4} tabs variant="chart" />;
  if (!data) return null;

  const { kpi } = data;
  const kpis = [
    { label: "Skor Rata-rata", value: data.kpi.avg.toLocaleString("id-ID"), sub: "skala 0–100", icon: Smile, tone: scoreTone(kpi.avg) + " " + "bg-emerald-500/10 border-emerald-500/20" },
    { label: "Responden", value: fmtNum(kpi.responden), sub: "jawaban survei", icon: Users, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { label: "Pelatihan Dinilai", value: fmtNum(kpi.pelatihan), sub: "kelas", icon: BookOpen, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
    { label: "Narasumber Dinilai", value: fmtNum(kpi.narasumber), sub: "pengajar", icon: GraduationCap, tone: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Star className="w-5 h-5 text-emerald-500" /> Evaluasi &amp; Kepuasan
          </h1>
          <p className="text-xs text-[var(--muted)] mt-1">
            Survei kepuasan pelatihan (NPS, skala 0–100) · {data.year || "Semua tahun"} · sumber AgroNow Insight
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Selector value={tipe} onChange={setTipe} options={[{ value: "", label: "Semua tipe" }, { value: "internal", label: "Internal" }, { value: "eksternal", label: "Eksternal" }]} />
          <Selector value={String(year)} onChange={v => setYear(Number(v))} options={[{ value: "0", label: "Semua tahun" }, ...data.years.map(y => ({ value: String(y), label: String(y) }))]} />
        </div>
      </div>

      {/* Jenis tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {JENIS.map(j => (
          <button key={j.key} onClick={() => setJenis(j.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
              jenis === j.key ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "text-[var(--muted)] border-transparent hover:bg-[var(--bg-card2)]"}`}>
            {j.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {/* KPI */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map(k => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${k.tone}`}><Icon className="w-4 h-4" /></div>
                <p className={`text-2xl font-bold mt-2.5 tabular-nums ${k.label === "Skor Rata-rata" ? scoreTone(kpi.avg) : "text-[var(--foreground)]"}`}>{k.value}</p>
                <p className="text-[11px] font-semibold text-[var(--foreground)] mt-0.5">{k.label}</p>
                <p className="text-[10px] text-[var(--muted)]">{k.sub}</p>
              </div>
            );
          })}
        </div>

        {/* Skor per dimensi + internal/eksternal */}
        <div className="grid lg:grid-cols-2 gap-4">
          <ScoreCard title="Skor per Dimensi" rows={data.perDimensi} />
          <ScoreCard title="Internal vs Eksternal" rows={data.internalEksternal} />
        </div>

        {/* Tabel narasumber / pelatihan */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-card2)] p-0.5">
              {([["narasumber", "Narasumber"], ["pelatihan", "Pelatihan"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setTab(k)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === k ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder={`Cari ${tab}…`}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors" />
            </div>
            <Selector value={sort} onChange={v => setSort(v as "n" | "avg")} options={[{ value: "n", label: "Urut: Responden" }, { value: "avg", label: "Urut: Skor" }]} />
            <p className="text-xs text-[var(--muted)] tabular-nums">{rows.length} {tab}</p>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-10">Tidak ada data evaluasi.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="py-2.5 px-2 w-8">#</th>
                    <th className="py-2.5 px-2">{tab === "narasumber" ? "Narasumber" : "Pelatihan"}</th>
                    <th className="py-2.5 px-2 text-right w-24">Responden</th>
                    <th className="py-2.5 px-2 w-[200px]">Skor</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.label + i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card2)]/50 align-middle">
                      <td className="py-2.5 px-2 text-[11px] text-[var(--muted)] tabular-nums">{i + 1}</td>
                      <td className="py-2.5 px-2 text-[var(--foreground)] max-w-[420px]"><span className="line-clamp-2 leading-snug">{r.label}</span></td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-[var(--muted)]">{fmtNum(r.n)}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-card2)] overflow-hidden min-w-[80px]">
                            <div className={`h-full rounded-full bg-gradient-to-r ${barTone(r.avg)}`} style={{ width: `${r.avg}%` }} />
                          </div>
                          <span className={`text-xs font-bold tabular-nums w-10 text-right ${scoreTone(r.avg)}`}>{r.avg.toLocaleString("id-ID")}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-[var(--muted)]">Hanya menampilkan yang punya ≥5 responden, maks 200 teratas (urut responden).</p>
        </div>
      </div>
    </div>
  );
}

function Selector({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-card)] pl-3 pr-8 py-2 text-sm font-medium text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 max-w-[220px]">
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" />
    </div>
  );
}

function ScoreCard({ title, rows }: { title: string; rows: EvalBar[] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-bold text-[var(--foreground)] mb-4">{title}</h3>
      {rows.length === 0 ? <p className="text-xs text-[var(--muted)] py-4 text-center">Belum ada data.</p> : (
        <div className="space-y-3">
          {rows.map(r => (
            <div key={r.label}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="capitalize text-[var(--foreground)]">{r.label} <span className="text-[var(--muted)]">· {fmtNum(r.n)} responden</span></span>
                <span className={`font-bold tabular-nums ${scoreTone(r.avg)}`}>{r.avg.toLocaleString("id-ID")}</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--bg-card2)] overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${barTone(r.avg)}`} style={{ width: `${r.avg}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
