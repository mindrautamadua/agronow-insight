"use client";

import { useEffect, useState } from "react";
import {
  ClipboardCheck, ChevronDown, MapPin, Calendar, Clock, Link2, Check, X,
  AlertTriangle, CheckCircle2, ShieldCheck,
} from "lucide-react";
import { fetchIdpVerif, verifyIdp, type IdpVerifData, type IdpVerifEntry } from "@/lib/data";
import { fmtDate } from "@/lib/utils";
import { Avatar, EmptyState, PageSkeleton } from "@/components/ui";

const STATUS: Record<string, { label: string; cls: string }> = {
  draft:     { label: "Draft",     cls: "text-[var(--muted)] bg-[var(--bg-card2)] border-[var(--border)]" },
  submitted: { label: "Diajukan",  cls: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  pending:   { label: "Diajukan",  cls: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
  approved:  { label: "Disetujui", cls: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  rejected:  { label: "Ditolak",   cls: "text-red-500 bg-red-500/10 border-red-500/20" },
};
const statusMeta = (s: string) => STATUS[s.toLowerCase()] ?? STATUS.draft;
const isPending = (s: string) => ["submitted", "pending"].includes(s.toLowerCase());

export default function IdpVerifikasiPage() {
  const [data, setData] = useState<IdpVerifData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "all">("pending");

  const reload = (f: "pending" | "all") => {
    setLoading(true);
    return fetchIdpVerif(f).then(setData).finally(() => setLoading(false));
  };
  useEffect(() => { reload(filter); }, [filter]);

  if (loading && !data) return <PageSkeleton cards={0} variant="list" />;

  const entries = data?.entries ?? [];

  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-emerald-500" /> Verifikasi IDP
          </h1>
          <p className="text-xs text-[var(--muted)] mt-1">Tinjau & setujui/tolak pengajuan Individual Development Plan karyawan · khusus verifikator</p>
        </div>
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-card2)] p-0.5">
          {(["pending", "all"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                filter === f ? "bg-[var(--bg-card)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
              {f === "pending" ? `Perlu diverifikasi${data ? ` (${data.pendingCount})` : ""}` : "Semua"}
            </button>
          ))}
        </div>
      </div>

      {entries.length === 0 ? (
        <EmptyState icon={ShieldCheck} title={filter === "pending" ? "Tidak ada pengajuan" : "Belum ada IDP"}
          desc={filter === "pending" ? "Semua IDP yang diajukan sudah diverifikasi." : "Belum ada data IDP."} />
      ) : (
        <div className="space-y-3">
          {entries.map(e => <VerifCard key={e.id} e={e} onDone={() => reload(filter)} />)}
        </div>
      )}
    </div>
  );
}

function VerifCard({ e, onDone }: { e: IdpVerifEntry; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<null | "approve" | "reject">(null);
  const [catatan, setCatatan] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const st = statusMeta(e.statusIdp);
  const pending = isPending(e.statusIdp);

  async function act(action: "approve" | "reject") {
    if (action === "reject" && !catatan.trim()) { setErr("Catatan penolakan wajib diisi."); return; }
    setErr(null); setBusy(true);
    try {
      await verifyIdp(e.id, action, catatan.trim() || undefined);
      onDone();
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Gagal memproses.");
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--bg-card2)]/40 transition-colors">
        <Avatar nama={e.member.nama} className="w-10 h-10 text-sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-[var(--foreground)] truncate">{e.member.nama}</p>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${st.cls}`}>{st.label}</span>
          </div>
          <p className="text-[11px] text-[var(--muted)] truncate">{[e.member.nip, e.member.jabatan, e.member.unit].filter(Boolean).join(" · ") || "—"}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs font-semibold text-[var(--foreground)]">Tahun {e.tahun ?? "—"}</p>
          <p className="text-[10px] text-[var(--muted)]">{e.member.entitas ?? "—"}</p>
        </div>
        <ChevronDown className={`w-4 h-4 shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-4 py-3 space-y-3">
          <Detail label="Area Pengembangan" value={e.areaPengembangan} />
          <Detail label="Aspirasi Pengembangan" value={e.aspirasiPengembangan} />
          <Detail label="Rencana Pengembangan" value={e.rencana} />
          <Detail label="Deskripsi Pengembangan" value={e.deskripsiPengembangan} />
          <Detail label="Summary / Hasil" value={e.summary} />

          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--muted)]">
            {e.tglPelaksanaan && <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /> {fmtDate(e.tglPelaksanaan)}{e.jamMulai ? ` · ${e.jamMulai}–${e.jamSelesai ?? ""}` : ""}</span>}
            {e.lokasi && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {e.lokasi}</span>}
            {e.urlDokumentasi && <a href={e.urlDokumentasi} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"><Link2 className="w-3 h-3" /> Dokumentasi</a>}
          </div>

          {/* Hasil verifikasi sebelumnya */}
          {!pending && e.catatanVerifikasi && (
            <div className={`flex items-start gap-2 text-[11px] rounded-lg px-3 py-2 ${e.statusIdp.toLowerCase() === "rejected" ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
              {e.statusIdp.toLowerCase() === "rejected" ? <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 mt-px shrink-0" />}
              <span>{e.catatanVerifikasi}{e.tglVerifikasi ? ` · ${fmtDate(e.tglVerifikasi)}` : ""}</span>
            </div>
          )}

          {/* Aksi verifikasi */}
          {pending && (
            <div className="pt-1 border-t border-[var(--border)]">
              {err && <div className="flex items-center gap-2 text-[12px] text-red-500 bg-red-500/10 rounded-lg px-3 py-2 mt-3"><AlertTriangle className="w-4 h-4 shrink-0" /> {err}</div>}
              {mode ? (
                <div className="space-y-2 mt-3">
                  <textarea autoFocus value={catatan} onChange={ev => setCatatan(ev.target.value)} rows={2}
                    placeholder={mode === "reject" ? "Alasan penolakan (wajib)…" : "Catatan persetujuan (opsional)…"}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card2)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50" />
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => { setMode(null); setErr(null); setCatatan(""); }} disabled={busy} className="px-3 py-1.5 rounded-lg text-sm text-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50">Batal</button>
                    <button onClick={() => act(mode)} disabled={busy}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50 ${mode === "reject" ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}>
                      {mode === "reject" ? <X className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                      {busy ? "Memproses…" : mode === "reject" ? "Konfirmasi Tolak" : "Konfirmasi Setujui"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-2 mt-3">
                  <button onClick={() => { setMode("reject"); setErr(null); }} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium border border-red-500/30 text-red-500 hover:bg-red-500/10"><X className="w-4 h-4" /> Tolak</button>
                  <button onClick={() => { setMode("approve"); setErr(null); }} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-emerald-500 text-white hover:bg-emerald-600"><Check className="w-4 h-4" /> Setujui</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider">{label}</p>
      <p className="text-sm text-[var(--foreground)] whitespace-pre-line mt-0.5">{value}</p>
    </div>
  );
}
