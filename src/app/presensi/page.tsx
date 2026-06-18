"use client";

import { useEffect, useMemo, useState } from "react";
import { UserCheck, BookOpen, Users, Percent, Search, ChevronDown, Smartphone, Wifi } from "lucide-react";
import { fetchPresensi, type PresensiData } from "@/lib/data";
import { fmtNum } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui";

const rateTone = (v: number | null) =>
  v == null ? "text-[var(--muted)]" : v >= 90 ? "text-emerald-500" : v >= 75 ? "text-blue-500" : v >= 50 ? "text-amber-500" : "text-red-500";
const rateBar = (v: number | null) =>
  v == null ? "bg-[var(--bg-card2)]" : v >= 90 ? "from-emerald-500 to-emerald-400" : v >= 75 ? "from-blue-500 to-blue-400" : v >= 50 ? "from-amber-500 to-amber-400" : "from-red-500 to-red-400";

export default function PresensiPage() {
  const [data, setData] = useState<PresensiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"hadir" | "rate" | "rateAsc">("hadir");

  useEffect(() => {
    setLoading(true);
    fetchPresensi().then(setData).finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const src = data?.perKelas ?? [];
    const s = q.trim().toLowerCase();
    const f = s ? src.filter(r => r.label.toLowerCase().includes(s)) : src;
    return [...f].sort((a, b) =>
      sort === "hadir" ? b.hadir - a.hadir
      : sort === "rate" ? (b.rate ?? -1) - (a.rate ?? -1)
      : (a.rate ?? 101) - (b.rate ?? 101));
  }, [data, q, sort]);

  if (loading) return <PageSkeleton cards={4} tabs variant="chart" />;
  if (!data) return null;

  const { kpi } = data;
  const kpis = [
    { label: "Kelas Berpresensi", value: fmtNum(kpi.kelas), sub: "punya rekam hadir", icon: BookOpen, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
    { label: "Peserta Hadir", value: fmtNum(kpi.hadir), sub: "karyawan unik", icon: Users, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { label: "Total Check-in", value: fmtNum(kpi.checkin), sub: "rekam presensi", icon: UserCheck, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Rata-rata Kehadiran", value: `${kpi.avgRate.toLocaleString("id-ID")}%`, sub: "hadir / terdaftar", icon: Percent, tone: rateTone(kpi.avgRate) + " bg-emerald-500/10 border-emerald-500/20" },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-emerald-500" /> Kehadiran / Presensi
        </h1>
        <p className="text-xs text-[var(--muted)] mt-1">Tingkat kehadiran peserta per kelas (hadir vs terdaftar) · sumber AgroNow Insight</p>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map(k => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${k.tone}`}><Icon className="w-4 h-4" /></div>
                <p className={`text-2xl font-bold mt-2.5 tabular-nums ${k.label === "Rata-rata Kehadiran" ? rateTone(kpi.avgRate) : "text-[var(--foreground)]"}`}>{k.value}</p>
                <p className="text-[11px] font-semibold text-[var(--foreground)] mt-0.5">{k.label}</p>
                <p className="text-[10px] text-[var(--muted)]">{k.sub}</p>
              </div>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-4">
          <CountCard title="Sebaran Tingkat Kehadiran (kelas)" rows={data.rateBuckets} />
          <CountCard title="Kanal Presensi" rows={data.perChannel} icon={Smartphone} cap />
          <CountCard title="Mode Hadir · Online vs Offline"
            note={`${fmtNum(data.presensiV2.sesi)} program · ${fmtNum(data.presensiV2.peserta)} peserta · 2025–2026`}
            rows={data.presensiV2.modus} icon={Wifi} cap />
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-[var(--foreground)]">Kehadiran per Kelas</h3>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari kelas…"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors" />
            </div>
            <Selector value={sort} onChange={v => setSort(v as "hadir" | "rate" | "rateAsc")}
              options={[{ value: "hadir", label: "Urut: Hadir" }, { value: "rate", label: "Urut: Kehadiran ↓" }, { value: "rateAsc", label: "Kehadiran ↑ (terendah)" }]} />
            <p className="text-xs text-[var(--muted)] tabular-nums">{rows.length} kelas</p>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-10">Tidak ada data presensi.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="py-2.5 px-2 w-8">#</th>
                    <th className="py-2.5 px-2">Kelas</th>
                    <th className="py-2.5 px-2 text-right w-20">Terdaftar</th>
                    <th className="py-2.5 px-2 text-right w-16">Hadir</th>
                    <th className="py-2.5 px-2 w-[200px]">Kehadiran</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.label + i} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card2)]/50 align-middle">
                      <td className="py-2.5 px-2 text-[11px] text-[var(--muted)] tabular-nums">{i + 1}</td>
                      <td className="py-2.5 px-2 text-[var(--foreground)] max-w-[420px]"><span className="line-clamp-2 leading-snug">{r.label}</span></td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-[var(--muted)]">{r.enrolled || "—"}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-[var(--foreground)]">{fmtNum(r.hadir)}</td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-card2)] overflow-hidden min-w-[70px]">
                            {r.rate != null && <div className={`h-full rounded-full bg-gradient-to-r ${rateBar(r.rate)}`} style={{ width: `${r.rate}%` }} />}
                          </div>
                          <span className={`text-xs font-bold tabular-nums w-12 text-right ${rateTone(r.rate)}`}>{r.rate != null ? `${r.rate}%` : "—"}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-[11px] text-[var(--muted)]">Maks 200 kelas (urut jumlah hadir). Kehadiran = peserta hadir ÷ terdaftar (maks 100%).</p>
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

function CountCard({ title, rows, icon: Icon, cap, note }: { title: string; rows: { label: string; n: number }[]; icon?: React.ElementType; cap?: boolean; note?: string }) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <h3 className={`text-sm font-bold text-[var(--foreground)] flex items-center gap-2 ${note ? "mb-1" : "mb-4"}`}>{Icon && <Icon className="w-4 h-4 text-emerald-500" />}{title}</h3>
      {note && <p className="text-[10px] text-[var(--muted)] mb-3">{note}</p>}
      {rows.length === 0 ? <p className="text-xs text-[var(--muted)] py-4 text-center">Belum ada data.</p> : (
        <div className="space-y-2.5">
          {rows.map(r => (
            <div key={r.label} className="flex items-center gap-3">
              <span className={`w-28 shrink-0 text-xs text-[var(--foreground)] truncate ${cap ? "capitalize" : ""}`} title={r.label}>{r.label}</span>
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
