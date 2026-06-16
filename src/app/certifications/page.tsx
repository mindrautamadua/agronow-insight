"use client";

import { useEffect, useState } from "react";
import { Award, Search, ChevronLeft, ChevronRight, Building2, BadgeCheck, FileText, Loader2, Clock } from "lucide-react";
import { fetchCertificationsPaged, fetchCertEntitas, fetchCertSummary, type Certification, type CertEntitas, type CertSummary } from "@/lib/data";
import { fmtDate } from "@/lib/utils";
import { StatusBadge, EmptyState, ListSkeleton } from "@/components/ui";

const TABS = [
  { key: "all", label: "Semua" },
  { key: "verified", label: "Terverifikasi" },
  { key: "unverified", label: "Belum" },
] as const;

export default function CertificationsPage() {
  const [rows, setRows] = useState<Certification[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [verified, setVerified] = useState<string>("all");
  const [entitas, setEntitas] = useState<string>("");
  const [sub, setSub] = useState<string>("");
  const [entitasList, setEntitasList] = useState<CertEntitas[]>([]);
  const [summary, setSummary] = useState<CertSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [dq, setDq] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setDq(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { fetchCertEntitas().then(setEntitasList).catch(() => {}); }, []);
  useEffect(() => { fetchCertSummary(dq, verified, entitas, sub).then(setSummary).catch(() => {}); }, [dq, verified, entitas, sub]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCertificationsPaged(dq, page, verified, entitas, sub)
      .then(d => { if (!alive) return; setRows(d.certifications); setTotal(d.total); setPages(d.pages); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [dq, page, verified, entitas, sub]);

  function changeFilter(v: string) { setVerified(v); setPage(1); }
  function changeEntitas(v: string) { setEntitas(v); setSub(""); setPage(1); }
  function changeSub(v: string) { setSub(v); setPage(1); }

  const subs = entitasList.find(e => e.nama === entitas)?.subs ?? [];

  const cards = [
    { label: "Total Sertifikat", value: summary?.total, sub: "berkas terbit", icon: Award, tone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Terverifikasi", value: summary?.verified, sub: "sudah diverifikasi", icon: BadgeCheck, tone: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    { label: "Belum Terverifikasi", value: summary?.unverified, sub: "menunggu verifikasi", icon: Clock, tone: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    { label: "Entitas", value: entitasList.length || undefined, sub: "perusahaan/grup", icon: Building2, tone: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${c.tone}`}><Icon className="w-4 h-4" /></div>
              <p className="text-3xl font-bold text-[var(--foreground)] mt-3">
                {c.value === undefined ? "—" : c.value.toLocaleString("id-ID")}
              </p>
              <p className="text-xs font-semibold text-[var(--foreground)] mt-1">{c.label}</p>
              <p className="text-[11px] text-[var(--muted)] mt-0.5">{c.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari peserta / NIP / sertifikat…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] pl-9 pr-9 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors" />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] animate-spin" />}
        </div>
        <p className="text-xs text-[var(--muted)]">{total.toLocaleString("id-ID")} sertifikat</p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => (
            <button key={t.key} onClick={() => changeFilter(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                verified === t.key ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "text-[var(--muted)] border-transparent hover:bg-[var(--bg-card2)]"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" />
            <select value={entitas} onChange={e => changeEntitas(e.target.value)}
              className="appearance-none rounded-lg border border-[var(--border)] bg-[var(--bg-card)] pl-8 pr-8 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 max-w-[240px]">
              <option value="">Semua entitas</option>
              {entitasList.map(e => (
                <option key={e.nama} value={e.nama}>{e.nama} ({e.total})</option>
              ))}
            </select>
            <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] rotate-90 pointer-events-none" />
          </div>
          {entitas && subs.length > 0 && (
            <div className="relative">
              <select value={sub} onChange={e => changeSub(e.target.value)}
                className="appearance-none rounded-lg border border-[var(--border)] bg-[var(--bg-card)] pl-3 pr-8 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 max-w-[220px]">
                <option value="">Semua sub-entitas</option>
                {subs.map(s => (
                  <option key={s.group} value={s.group}>{s.nama} ({s.total})</option>
                ))}
              </select>
              <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] rotate-90 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <ListSkeleton avatar rows={10} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Award} title="Tidak ada sertifikat" desc={dq ? "Tidak ada yang cocok dengan pencarian." : "Sertifikat peserta akan tampil di sini."} />
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left">
                    {["Peserta", "Sertifikat", "Kategori", "Entitas", "Terbit", "Berkas"].map(h => (
                      <th key={h} className="px-4 py-3 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card2)] transition-colors align-top">
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--foreground)] flex items-center gap-1.5">
                          <span>{r.nama}</span>
                          {r.verified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-label="Terverifikasi" />}
                        </p>
                        <p className="text-[11px] text-[var(--muted)] font-mono">{r.nip ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3 text-[var(--foreground)] max-w-[320px]">
                        <span className="leading-snug">{r.sertifikat}</span>
                      </td>
                      <td className="px-4 py-3 text-emerald-400 text-xs whitespace-nowrap">{r.kategori ?? <span className="text-[var(--muted)]">—</span>}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.entitas ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]"><Building2 className="w-3 h-3" />{r.entitas}</span>
                        ) : <span className="text-[var(--muted)]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-[var(--muted)] whitespace-nowrap">{r.tanggal ? fmtDate(r.tanggal) : "—"}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.berkas ? (
                          <a href={r.berkas} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-500 hover:text-emerald-400 hover:underline text-xs font-medium">
                            <FileText className="w-3.5 h-3.5" /> Lihat
                          </a>
                        ) : <span className="text-[var(--muted)]">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-[var(--muted)]">Halaman {page} dari {pages.toLocaleString("id-ID")}</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1 || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--foreground)] disabled:opacity-40 hover:bg-[var(--bg-card2)] transition-colors">
                <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
              </button>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages || loading}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-xs text-[var(--foreground)] disabled:opacity-40 hover:bg-[var(--bg-card2)] transition-colors">
                Berikutnya <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
