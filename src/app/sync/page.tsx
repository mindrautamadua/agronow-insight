"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Database, Loader2, CheckCircle2, AlertTriangle, ArrowRightLeft, Trash2 } from "lucide-react";
import { fetchSyncStatus, runDataSync, type SyncState, type SyncRun } from "@/lib/data";
import { fmtNum } from "@/lib/utils";
import { useIsAdmin } from "@/components/AuthContext";
import { Spinner } from "@/components/ui";

const fmtTime = (s: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
};

export default function SyncPage() {
  const isAdmin = useIsAdmin();
  const [state, setState] = useState<SyncState[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function reload() {
    return fetchSyncStatus().then(d => { setState(d.state); setRuns(d.runs); }).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function doSync() {
    setSyncing(true); setMsg(null);
    try {
      const r = await runDataSync();
      setMsg({ ok: r.ok, text: `${r.ok ? "Berhasil" : "Selesai dengan peringatan"} — ${fmtNum(r.totalUpsert)} upsert · ${fmtNum(r.totalDelete)} hapus · ${(r.durationMs / 1000).toFixed(1)}s.` });
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSyncing(false);
    }
  }

  if (loading && !runs.length && !state.length) return <Spinner />;

  const last = runs[0];

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-emerald-500" /> Sync Data
          </h1>
          <p className="text-xs text-[var(--muted)] mt-1">Tarik perubahan (baru · edit · hapus) dari MySQL ke Supabase untuk {state.length || "20"} tabel inti. Aman diulang.</p>
        </div>
        {isAdmin ? (
          <button onClick={doSync} disabled={syncing}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:brightness-105 transition-all disabled:opacity-50">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Menyinkronkan…" : "Sync sekarang"}
          </button>
        ) : <span className="text-xs text-[var(--muted)]">Hanya admin yang dapat menjalankan sync.</span>}
      </div>

      {msg && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300"}`}>{msg.text}</div>
      )}

      {/* Ringkasan run terakhir */}
      {last && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Run Terakhir", value: fmtTime(last.started_at), small: true, icon: Database, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
            { label: "Status", value: last.ok ? "OK" : "Peringatan", icon: last.ok ? CheckCircle2 : AlertTriangle, tone: last.ok ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" : "text-amber-500 bg-amber-500/10 border-amber-500/20" },
            { label: "Upsert", value: fmtNum(last.total_upsert), icon: RefreshCw, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
            { label: "Hapus", value: fmtNum(last.total_delete), icon: Trash2, tone: "text-rose-500 bg-rose-500/10 border-rose-500/20" },
          ].map(c => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${c.tone}`}><Icon className="w-4 h-4" /></div>
                <p className={`font-bold text-[var(--foreground)] mt-2.5 tabular-nums ${c.small ? "text-sm" : "text-2xl"}`}>{c.value}</p>
                <p className="text-[11px] font-semibold text-[var(--foreground)] mt-0.5">{c.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Status per tabel */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">Status per Tabel</h3>
        {state.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-6">Belum pernah sync. Klik “Sync sekarang”.</p>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
                  <th className="py-2 px-2">Tabel</th>
                  <th className="py-2 px-2">Mode</th>
                  <th className="py-2 px-2">Watermark</th>
                  <th className="py-2 px-2">Sync Terakhir</th>
                </tr>
              </thead>
              <tbody>
                {state.map(s => (
                  <tr key={s.table_name} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 px-2 font-mono text-[12px] text-[var(--foreground)]">{s.table_name}</td>
                    <td className="py-2 px-2 text-[11px] text-[var(--muted)]">{s.last_watermark ? "incremental" : "full"}</td>
                    <td className="py-2 px-2 text-[11px] text-[var(--muted)] font-mono">{s.last_watermark ? s.last_watermark.slice(0, 16) : "—"}</td>
                    <td className="py-2 px-2 text-[11px] text-[var(--muted)]">{fmtTime(s.last_run)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Riwayat run */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-bold text-[var(--foreground)] mb-3">Riwayat Sync</h3>
        {runs.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-6">Belum ada riwayat.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {runs.map(r => (
              <li key={r.id} className="flex items-center gap-3 py-2.5 text-xs">
                {r.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                <span className="text-[var(--foreground)] w-32 shrink-0">{fmtTime(r.started_at)}</span>
                <span className="text-[var(--muted)]">{fmtNum(r.total_upsert)} upsert · {fmtNum(r.total_delete)} hapus</span>
                <span className="text-[var(--muted)] ml-auto tabular-nums">{r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : "—"}</span>
                {r.error && <span className="text-red-500 truncate max-w-[200px]" title={r.error}>{r.error}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
