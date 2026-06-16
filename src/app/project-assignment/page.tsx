"use client";

import { useEffect, useMemo, useState } from "react";
import { Briefcase, Users, GraduationCap, TrendingUp, CheckCircle2, Search, ChevronDown, ListChecks } from "lucide-react";
import { fetchProjectAssignment, type PaData, type PaBar } from "@/lib/data";
import { fmtNum, fmtDate } from "@/lib/utils";
import { PageSkeleton } from "@/components/ui";

const TABS = [
  { key: "", label: "Semua" },
  { key: "open", label: "Belum mulai" },
  { key: "progress", label: "Berjalan" },
  { key: "draft", label: "Draft" },
  { key: "final", label: "Selesai" },
] as const;

const STATUS_TONE: Record<string, string> = {
  "Belum mulai": "bg-slate-500/10 text-slate-400 border-slate-500/20",
  "Berjalan": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "Draft": "bg-amber-500/10 text-amber-500 border-amber-500/20",
  "Selesai": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
};
const progTone = (v: number) => v >= 100 ? "from-emerald-500 to-emerald-400" : v >= 51 ? "from-blue-500 to-blue-400" : v >= 1 ? "from-amber-500 to-amber-400" : "bg-[var(--bg-card2)]";

export default function ProjectAssignmentPage() {
  const [data, setData] = useState<PaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchProjectAssignment(status).then(setData).finally(() => setLoading(false));
  }, [status]);

  const list = useMemo(() => {
    const rows = data?.list ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r => [r.nama, r.nip ?? "", r.pelatihan, r.problem ?? "", r.atasan ?? ""].some(v => v.toLowerCase().includes(s)));
  }, [data, q]);

  if (loading) return <PageSkeleton cards={5} cardCols="lg:grid-cols-5" tabs variant="chart" />;
  if (!data) return null;

  const { kpi } = data;
  const kpis = [
    { label: "Total Penugasan", value: fmtNum(kpi.total), sub: "project assignment", icon: Briefcase, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
    { label: "Peserta", value: fmtNum(kpi.peserta), sub: "karyawan terlibat", icon: Users, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { label: "Rata-rata Progress", value: `${kpi.avgProgress.toLocaleString("id-ID")}%`, sub: "penyelesaian", icon: TrendingUp, tone: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { label: "Berjalan", value: fmtNum(kpi.berjalan), sub: `${kpi.selesai} selesai`, icon: CheckCircle2, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Pelatihan Asal", value: fmtNum(kpi.pelatihan), sub: "program sumber", icon: GraduationCap, tone: "text-teal-500 bg-teal-500/10 border-teal-500/20" },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-emerald-500" /> Project Assignment
        </h1>
        <p className="text-xs text-[var(--muted)] mt-1">Penugasan proyek pasca-pelatihan (on-the-job / learning 70%) · sumber AgroNow Insight</p>
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

        <div className="grid lg:grid-cols-3 gap-4">
          <CountCard title="Status" rows={data.byStatus} />
          <CountCard title="Tingkat Progress" rows={data.byProgress} />
          <CountCard title="Pelatihan Asal (terbanyak)" rows={data.perPelatihan} />
        </div>

        {data.deliverable.total > 0 && <DeliverableCard d={data.deliverable} />}

        {/* Daftar */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex gap-1.5 flex-wrap">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setStatus(t.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    status === t.key ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "text-[var(--muted)] border-transparent hover:bg-[var(--bg-card2)]"}`}>
                  {t.label}
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari peserta / pelatihan / problem…"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors" />
            </div>
            <p className="text-xs text-[var(--muted)] tabular-nums">{list.length} · maks 300</p>
          </div>

          {list.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-10">Tidak ada penugasan.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                    <th className="py-2.5 px-2">Peserta</th>
                    <th className="py-2.5 px-2">Penugasan</th>
                    <th className="py-2.5 px-2">Pelatihan Asal</th>
                    <th className="py-2.5 px-2 w-[160px]">Progress</th>
                    <th className="py-2.5 px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map(r => (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card2)]/50 align-top">
                      <td className="py-2.5 px-2">
                        <p className="font-medium text-[var(--foreground)] whitespace-nowrap">{r.nama}</p>
                        <p className="text-[11px] text-[var(--muted)]"><span className="font-mono">{r.nip ?? "—"}</span>{r.jabatan && <> · {r.jabatan}</>}</p>
                        {r.atasan && <p className="text-[10px] text-[var(--muted)]">Atasan: {r.atasan}</p>}
                      </td>
                      <td className="py-2.5 px-2 max-w-[320px]">
                        {r.problem ? <p className="text-[var(--foreground)] line-clamp-2 leading-snug">{r.problem}</p> : <span className="text-[var(--muted)]">—</span>}
                        {r.target && <p className="text-[11px] text-[var(--muted)] line-clamp-1 mt-0.5">Target: {r.target}{r.uom ? ` ${r.uom}` : ""}</p>}
                      </td>
                      <td className="py-2.5 px-2 text-[var(--muted)] max-w-[180px]"><span className="line-clamp-2 leading-snug">{r.pelatihan}</span></td>
                      <td className="py-2.5 px-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-card2)] overflow-hidden min-w-[60px]">
                            {r.progress > 0 && <div className={`h-full rounded-full bg-gradient-to-r ${progTone(r.progress)}`} style={{ width: `${r.progress}%` }} />}
                          </div>
                          <span className="text-[11px] tabular-nums text-[var(--foreground)] w-9 text-right">{r.progress}%</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-md border font-medium ${STATUS_TONE[r.status] ?? STATUS_TONE["Belum mulai"]}`}>{r.status}</span>
                        {r.tgl && <p className="text-[10px] text-[var(--muted)] mt-1">{fmtDate(r.tgl)}</p>}
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

function CountCard({ title, rows }: { title: string; rows: PaBar[] }) {
  const max = Math.max(1, ...rows.map(r => r.n));
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-bold text-[var(--foreground)] mb-4">{title}</h3>
      {rows.length === 0 ? <p className="text-xs text-[var(--muted)] py-4 text-center">Belum ada data.</p> : (
        <div className="space-y-2.5">
          {rows.map(r => (
            <div key={r.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-xs text-[var(--foreground)] truncate" title={r.label}>{r.label}</span>
              <div className="flex-1 h-2 rounded-full bg-[var(--bg-card2)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${(r.n / max) * 100}%` }} />
              </div>
              <span className="w-10 shrink-0 text-right text-xs font-semibold text-[var(--foreground)] tabular-nums">{fmtNum(r.n)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliverableCard({ d }: { d: PaData["deliverable"] }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
        <ListChecks className="w-4 h-4 text-emerald-500" /> Deliverable &amp; Outcome
      </h3>
      <p className="text-[11px] text-[var(--muted)] mt-0.5 mb-4">Rincian output penugasan dari {fmtNum(d.paCount)} project assignment</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Deliverable" value={fmtNum(d.total)} sub="total output" />
        <Stat label="Tuntas" value={fmtNum(d.tuntas)} sub={`dari ${fmtNum(d.total)}`} />
        <Stat label="% Tuntas" value={`${d.pctTuntas.toLocaleString("id-ID")}%`} accent />
        <Stat label="Rata-rata Progres" value={`${d.avgProgress.toLocaleString("id-ID")}%`} />
      </div>
      {d.list.length > 0 && (
        <ul className="mt-4 divide-y divide-[var(--border)]">
          {d.list.map((o, i) => (
            <li key={i} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--foreground)] truncate" title={o.program ?? ""}>{o.program || o.deliverable || "Deliverable"}</p>
                <p className="text-[11px] text-[var(--muted)] line-clamp-2 leading-snug">{o.outcome || o.deliverable || "—"}</p>
              </div>
              <div className="shrink-0 w-24 text-right">
                <div className="h-1.5 rounded-full bg-[var(--bg-card2)] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${o.progress}%` }} />
                </div>
                <p className="text-[10px] text-[var(--muted)] tabular-nums mt-0.5">{o.progress}%</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card2)]/50 px-3 py-2.5">
      <p className={`text-xl font-bold tabular-nums ${accent ? "text-emerald-500" : "text-[var(--foreground)]"}`}>{value}</p>
      <p className="text-[11px] font-semibold text-[var(--foreground)] mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-[var(--muted)]">{sub}</p>}
    </div>
  );
}
