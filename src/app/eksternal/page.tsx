"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Users, UserCheck, Moon, ChevronRight, ExternalLink, X } from "lucide-react";
import { fetchEksternal, type EksternalData, type EksTraining } from "@/lib/data";
import { fmtNum } from "@/lib/utils";
import { PageSkeleton, Avatar } from "@/components/ui";

const SEG_TONE: Record<string, string> = { PTPN: "bg-emerald-500", Eksternal: "bg-amber-500", Umum: "bg-slate-400" };

export default function EksternalPage() {
  const [data, setData] = useState<EksternalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const [detail, setDetail] = useState<EksTraining | null>(null);

  useEffect(() => { fetchEksternal().then(setData).finally(() => setLoading(false)); }, []);

  const trainingsBySel = useMemo(
    () => (sel ? (data?.trainings ?? []).filter(t => t.entitas === sel) : []),
    [data, sel]);

  if (loading && !data) return <PageSkeleton maxW="max-w-[1200px]" cards={4} cardCols="lg:grid-cols-4" variant="chart" />;
  if (!data) return null;

  const { kpi } = data;
  const kpis = [
    { label: "Entitas Non-PTPN", value: fmtNum(kpi.terdaftar), sub: "terdaftar di sistem", icon: Building2, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
    { label: "Entitas Aktif", value: fmtNum(kpi.aktif), sub: "pernah ikut pelatihan", icon: UserCheck, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Entitas Dorman", value: fmtNum(kpi.dorman), sub: "terdaftar, 0 aktivitas", icon: Moon, tone: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { label: "Peserta Eksternal", value: fmtNum(kpi.peserta), sub: "karyawan luar PTPN", icon: Users, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  ];

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <ExternalLink className="w-5 h-5 text-emerald-500" /> Penggunaan Eksternal
        </h1>
        <p className="text-xs text-[var(--muted)] mt-1">Seberapa banyak &amp; dalam Agronow dipakai pihak di luar PTPN Group · sumber AgroNow Insight</p>
      </div>

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

      {/* Porsi penggunaan per modul */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-bold text-[var(--foreground)] mb-1">Porsi Penggunaan per Modul</h3>
        <p className="text-[11px] text-[var(--muted)] mb-4 flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> PTPN</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Eksternal</span>
          <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400" /> Umum</span>
        </p>
        <div className="space-y-3">
          {data.summary.map(row => {
            const total = row.PTPN + row.Eksternal + row.Umum || 1;
            const extPct = (row.Eksternal / total) * 100;
            return (
              <div key={row.metric} className="flex items-center gap-3">
                <span className="w-32 shrink-0 text-xs text-[var(--foreground)]">{row.metric}</span>
                <div className="flex-1 h-3 rounded-full overflow-hidden flex bg-[var(--bg-card2)]" title={`PTPN ${fmtNum(row.PTPN)} · Eksternal ${fmtNum(row.Eksternal)} · Umum ${fmtNum(row.Umum)}`}>
                  {(["PTPN", "Eksternal", "Umum"] as const).map(seg => {
                    const w = (row[seg] / total) * 100;
                    return w > 0 ? <div key={seg} className={SEG_TONE[seg]} style={{ width: `${w}%` }} /> : null;
                  })}
                </div>
                <span className="w-28 shrink-0 text-right text-[11px] tabular-nums text-[var(--muted)]">
                  Eks: <b className={extPct > 0 ? "text-amber-500" : ""}>{fmtNum(row.Eksternal)}</b> ({extPct < 0.1 && extPct > 0 ? "<0,1" : extPct.toFixed(1)}%)
                </span>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-[var(--muted)] mt-4 leading-relaxed">
          Pihak luar PTPN praktis hanya menyentuh <b>kehadiran kelas</b> &amp; sebagian kecil sertifikat; modul lanjutan (Wallet, Wishlist, Project Assignment, Evaluasi L3) ≈ 0%.
        </p>
      </div>

      {/* Entitas + drill pelatihan */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">Entitas Non-PTPN ({data.entitas.length})</h3>
          <div className="overflow-y-auto max-h-[460px] -mx-1">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)] sticky top-0 bg-[var(--bg-card)]">
                  <th className="py-2 px-2">Entitas</th>
                  <th className="py-2 px-2 text-right">Karyawan</th>
                  <th className="py-2 px-2 text-right">Peserta</th>
                  <th className="py-2 px-2 text-right">Pelatihan</th>
                </tr>
              </thead>
              <tbody>
                {data.entitas.map(e => {
                  const active = e.peserta > 0;
                  return (
                    <tr key={e.id}
                      onClick={() => active && setSel(sel === e.nama ? null : e.nama)}
                      className={`border-b border-[var(--border)] last:border-0 ${active ? "cursor-pointer hover:bg-[var(--bg-card2)]/60" : "opacity-60"} ${sel === e.nama ? "bg-emerald-500/5" : ""}`}>
                      <td className="py-2 px-2">
                        <span className="text-[var(--foreground)]">{e.nama}</span>
                        {!active && <span className="ml-2 text-[9px] uppercase tracking-wide text-amber-500 border border-amber-500/30 bg-amber-500/10 rounded px-1 py-0.5">dorman</span>}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-[var(--muted)]">{fmtNum(e.members)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-[var(--foreground)] font-medium">{fmtNum(e.peserta)}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-[var(--muted)]">{active ? fmtNum(e.pelatihan) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-3">Klik entitas aktif untuk lihat pelatihan yang diikuti →</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
          <h3 className="text-sm font-bold text-[var(--foreground)] mb-3 flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-emerald-500" /> Pelatihan {sel ? `· ${sel}` : "Diikuti Eksternal"}
          </h3>
          {(sel ? trainingsBySel : data.trainings).length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-10">{sel ? "Tidak ada pelatihan." : "Pilih entitas di kiri, atau lihat semua di sini."}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {(sel ? trainingsBySel : data.trainings).map((t, i) => (
                <li key={i}>
                  <button type="button" onClick={() => setDetail(t)}
                    className="group w-full flex items-start gap-3 py-2.5 text-left rounded-lg -mx-2 px-2 hover:bg-[var(--bg-card2)]/60 transition-colors">
                    <span className="w-5 shrink-0 text-[11px] text-[var(--muted)] tabular-nums text-right pt-0.5">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--foreground)] leading-snug">{t.pelatihan}</p>
                      <p className="text-[11px] text-[var(--muted)] mt-0.5">{!sel && <span className="text-amber-500">{t.entitas} · </span>}{t.tgl ?? "—"}</p>
                    </div>
                    <span className="shrink-0 text-right text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtNum(t.peserta)} <span className="text-[10px] font-normal text-[var(--muted)]">peserta</span></span>
                    <ChevronRight className="w-4 h-4 shrink-0 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {detail && (
        <ParticipantsModal
          training={detail}
          peserta={(data.participants ?? []).filter(p => p.crId === detail.crId && p.entitas === detail.entitas)}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function ParticipantsModal({ training, peserta, onClose }: {
  training: EksTraining; peserta: EksternalData["participants"]; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[var(--foreground)] leading-snug">{training.pelatihan}</h3>
            <p className="text-[11px] text-[var(--muted)] mt-0.5"><span className="text-amber-500">{training.entitas}</span> · {peserta.length} peserta · {training.tgl ?? "—"}</p>
          </div>
          <button onClick={onClose} className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">
          {peserta.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">Tidak ada peserta.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {peserta.map((p, i) => (
                <li key={p.nip ?? i} className="flex items-center gap-3 py-2.5">
                  <span className="w-5 shrink-0 text-[11px] text-[var(--muted)] tabular-nums text-right">{i + 1}</span>
                  <Avatar nama={p.nama} photo={p.photo} className="w-8 h-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate" title={p.nama}>{p.nama}</p>
                    <p className="text-[11px] text-[var(--muted)] truncate">
                      <span className="font-mono">{p.nip ?? "—"}</span>{p.jabatan && <> · {p.jabatan}</>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
