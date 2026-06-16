"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Wallet, Building2, ChevronDown, Search, FileText, CheckCircle2, Clock, XCircle, Receipt, Layers,
} from "lucide-react";
import { fetchWallet, type WalletData, type WalletBar } from "@/lib/data";
import { fmtRupiah, fmtNum } from "@/lib/utils";
import { PageSkeleton, EmptyState } from "@/components/ui";

const STATUS_TONE: Record<string, string> = {
  "Disetujui": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  "Dalam proses": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "Draft": "bg-slate-500/10 text-slate-400 border-slate-500/20",
  "Ditolak": "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function WalletPage() {
  const [data, setData] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [entitas, setEntitas] = useState(0);
  const [year, setYear] = useState(0);
  const [first, setFirst] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchWallet(entitas, year)
      .then(d => { setData(d); if (first) { setYear(d.year); setFirst(false); } })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitas, year]);

  const list = useMemo(() => {
    const rows = data?.list ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => [r.nama, r.nip ?? "", r.pelatihan, r.penyelenggara ?? "", r.entitas ?? ""].some(v => v.toLowerCase().includes(s)));
  }, [data, q]);

  if (loading) return <PageSkeleton maxW="max-w-[1400px]" cards={5} cardCols="lg:grid-cols-5" tabs variant="chart" />;
  if (!data) return null;

  const { kpi } = data;
  const kpis = [
    { label: "Total Pengajuan", value: fmtNum(kpi.total), sub: "seluruh status", icon: FileText, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
    { label: "Total Nilai", value: fmtRupiah(kpi.nilai), sub: "diajukan", icon: Receipt, tone: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { label: "Disetujui", value: fmtNum(kpi.disetujui), sub: fmtRupiah(kpi.nilaiDisetujui), icon: CheckCircle2, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Dalam Proses", value: fmtNum(kpi.proses), sub: "menunggu approval", icon: Clock, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { label: "Ditolak", value: fmtNum(kpi.ditolak), sub: "tidak disetujui", icon: XCircle, tone: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-500" /> Learning Wallet
          </h1>
          <p className="text-xs text-[var(--muted)] mt-1">
            Pengajuan &amp; anggaran pelatihan eksternal · {data.entitas ? (data.entitasList.find(e => e.id === data.entitas)?.nama ?? "—") : "Semua entitas"} · {data.year || "Semua tahun"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Selector icon={Building2} value={entitas} onChange={setEntitas}
            options={[{ value: 0, label: "Semua entitas" }, ...data.entitasList.map(e => ({ value: e.id, label: e.nama }))]} />
          <Selector value={year} onChange={setYear}
            options={[{ value: 0, label: "Semua tahun" }, ...data.years.map(y => ({ value: y, label: String(y) }))]} />
        </div>
      </div>

      <div className="space-y-5">
        {/* KPI */}
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

        {/* Pipeline + per entitas */}
        <div className="grid lg:grid-cols-2 gap-4">
          <BarCard title="Status Pengajuan" icon={CheckCircle2} rows={data.pipeline} money />
          <BarCard title={data.entitas ? "Penyelenggara (nilai)" : "Per Entitas (nilai)"} icon={Building2}
            rows={data.entitas ? data.perPenyelenggara : data.perEntitas} money />
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <BarCard title="Per Penyelenggara (nilai)" icon={Layers} rows={data.perPenyelenggara} money />
          <BarCard title="Per Level Karyawan (nilai)" icon={Layers} rows={data.perLevel} money />
        </div>

        {/* Daftar pengajuan */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-sm font-bold text-[var(--foreground)]">Daftar Pengajuan</h3>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari peserta / pelatihan / penyelenggara…"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors" />
            </div>
            <p className="text-xs text-[var(--muted)] tabular-nums">{list.length} baris · 200 terbaru</p>
          </div>

          {list.length === 0 ? (
            <EmptyState icon={Wallet} title="Tidak ada pengajuan" desc="Pengajuan Learning Wallet akan tampil di sini." />
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="py-2.5 px-2">Peserta</th>
                    <th className="py-2.5 px-2">Pelatihan</th>
                    <th className="py-2.5 px-2">Penyelenggara</th>
                    <th className="py-2.5 px-2 text-right">Nilai</th>
                    <th className="py-2.5 px-2">Tgl</th>
                    <th className="py-2.5 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(r => (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card2)]/50 align-top">
                      <td className="py-2.5 px-2">
                        <p className="font-medium text-[var(--foreground)]">{r.nama}</p>
                        <p className="text-[11px] text-[var(--muted)]">
                          <span className="font-mono">{r.nip ?? "—"}</span>{r.entitas && <> · {r.entitas}</>}{r.level && <> · {r.level}</>}
                        </p>
                      </td>
                      <td className="py-2.5 px-2 text-[var(--foreground)] max-w-[280px]"><span className="line-clamp-2 leading-snug">{r.pelatihan}</span></td>
                      <td className="py-2.5 px-2 text-[var(--muted)] max-w-[160px]"><span className="line-clamp-2 leading-snug">{r.penyelenggara ?? "—"}</span></td>
                      <td className="py-2.5 px-2 text-right tabular-nums text-[var(--foreground)] whitespace-nowrap">{fmtRupiah(r.harga)}</td>
                      <td className="py-2.5 px-2 text-[var(--muted)] whitespace-nowrap">{r.tgl ?? "—"}</td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-md border font-medium ${STATUS_TONE[r.status] ?? STATUS_TONE.Draft}`}>{r.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Selector({ icon: Icon, value, onChange, options }: {
  icon?: React.ElementType; value: number; onChange: (v: number) => void; options: { value: number; label: string }[];
}) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500 pointer-events-none" />}
      <select value={value} onChange={e => onChange(Number(e.target.value))}
        className={`appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-card)] ${Icon ? "pl-8" : "pl-3"} pr-8 py-2 text-sm font-medium text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 max-w-[280px]`}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" />
    </div>
  );
}

function BarCard({ title, icon: Icon, rows, money }: { title: string; icon: React.ElementType; rows: WalletBar[]; money?: boolean }) {
  const max = Math.max(1, ...rows.map(r => r.nilai));
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2 mb-4"><Icon className="w-4 h-4 text-emerald-500" /> {title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--muted)] py-6 text-center">Belum ada data.</p>
      ) : (
        <div className="space-y-2.5">
          {rows.map(r => (
            <div key={r.label} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-xs text-[var(--foreground)] truncate" title={r.label}>{r.label}</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--bg-card2)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${(r.nilai / max) * 100}%` }} />
              </div>
              <span className="shrink-0 text-right text-xs font-semibold text-[var(--foreground)] tabular-nums whitespace-nowrap">
                {money ? fmtRupiah(r.nilai) : fmtNum(r.nilai)} <span className="text-[var(--muted)] font-normal">· {fmtNum(r.n)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
