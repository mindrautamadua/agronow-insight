"use client";

import { useEffect, useState } from "react";
import { Image as ImageIcon, RefreshCw, Users, Clock, AlertTriangle, Database, Loader2 } from "lucide-react";
import { fetchPhotoStatus, syncPhotos, type PhotoStatus } from "@/lib/data";
import { fmtNum } from "@/lib/utils";
import { useIsAdmin } from "@/components/AuthContext";
import { Spinner } from "@/components/ui";

export default function PhotosPage() {
  const isAdmin = useIsAdmin();
  const [data, setData] = useState<PhotoStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function reload() {
    return fetchPhotoStatus().then(setData).catch(() => {}).finally(() => setLoading(false));
  }
  useEffect(() => { reload(); }, []);

  async function doSync() {
    setSyncing(true); setMsg(null);
    try {
      const r = await syncPhotos();
      setMsg({ ok: true, text: `Berhasil — ${fmtNum(r.synced)} foto disinkronkan.` });
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setSyncing(false);
    }
  }

  if (loading && !data) return <Spinner />;
  if (!data) return null;

  const fmtTime = (s: string | null) => {
    if (!s) return "—";
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };
  const cards = [
    { label: "Total Foto", value: fmtNum(data.total), sub: "tersimpan di app", icon: ImageIcon, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
    { label: "Terpetakan ke Peserta", value: fmtNum(data.matched), sub: "NIP cocok dengan _member", icon: Users, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Sync Terakhir", value: fmtTime(data.lastSync), sub: "waktu pembaruan", icon: Clock, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20", small: true },
  ];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-emerald-500" /> Sinkronisasi Foto Karyawan
        </h1>
        <p className="text-xs text-[var(--muted)] mt-1">Tarik foto karyawan dari sumber <b>IHCMIS</b> (tabel <code className="px-1 rounded bg-[var(--bg-card2)]">employees</code>) ke aplikasi, dicocokkan via NIP.</p>
      </div>

      {!data.configured && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            <b>IHCMIS_DB_URL</b> belum dikonfigurasi di <code>.env.local</code>. Sync belum bisa dijalankan — isi connection string Supabase IHCMIS-DEV lalu restart dev server.
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${c.tone}`}><Icon className="w-4 h-4" /></div>
              <p className={`font-bold text-[var(--foreground)] mt-2.5 tabular-nums ${c.small ? "text-sm" : "text-2xl"}`}>{c.value}</p>
              <p className="text-[11px] font-semibold text-[var(--foreground)] mt-0.5">{c.label}</p>
              <p className="text-[10px] text-[var(--muted)]">{c.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-[var(--muted)] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">Jalankan Sinkronisasi</p>
            <p className="text-xs text-[var(--muted)] mt-0.5">Ambil semua foto (URL valid) dari IHCMIS-DEV dan perbarui pemetaan NIP→foto. Aman dijalankan berulang.</p>
          </div>
        </div>
        {isAdmin ? (
          <button onClick={doSync} disabled={syncing || !data.configured}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 hover:brightness-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {syncing ? "Menyinkronkan…" : "Sync sekarang"}
          </button>
        ) : (
          <span className="text-xs text-[var(--muted)]">Hanya admin yang dapat menjalankan sync.</span>
        )}
      </div>

      {msg && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300"}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
