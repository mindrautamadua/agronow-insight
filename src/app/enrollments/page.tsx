"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Search, Users as UsersIcon, X, Loader2, BadgeCheck, Mail, Phone, Building2, BarChart3, Layers } from "lucide-react";
import { fetchEnrollmentClasses, fetchClassMembers, type EnrollmentClass, type ClassMember } from "@/lib/data";
import { fmtDateShort, fmtDate } from "@/lib/utils";
import { ListSkeleton, StatusBadge, EmptyState, Avatar } from "@/components/ui";

const TABS = ["semua", "terjadwal", "berlangsung", "selesai"] as const;
type Tab = (typeof TABS)[number];

export default function EnrollmentsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<EnrollmentClass[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("semua");
  const [detail, setDetail] = useState<EnrollmentClass | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchEnrollmentClasses().then(setRows).finally(() => setLoading(false));
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { semua: rows.length, terjadwal: 0, berlangsung: 0, selesai: 0 };
    rows.forEach(r => { c[r.status] = (c[r.status] ?? 0) + 1; });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r => {
      if (tab !== "semua" && r.status !== tab) return false;
      if (!s) return true;
      return [r.judul, r.kode, r.kategori].some(v => (v ?? "").toLowerCase().includes(s));
    });
  }, [rows, q, tab]);

  // Kartu summary mengikuti scope tabel (pencarian + tab status).
  const cards = useMemo(() => {
    const totalPeserta = filtered.reduce((s, r) => s + (r.peserta ?? 0), 0);
    const kategori = new Set(filtered.map(r => r.kategori).filter(Boolean)).size;
    const avg = filtered.length ? Math.round(totalPeserta / filtered.length) : 0;
    return [
      { label: "Total Kelas", value: filtered.length, sub: tab === "semua" ? "seluruh kelas" : `status ${tab}`, icon: ClipboardList, tone: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
      { label: "Total Peserta", value: totalPeserta, sub: "terdaftar di kelas", icon: UsersIcon, tone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
      { label: "Rata-rata Peserta", value: avg, sub: "per kelas", icon: BarChart3, tone: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
      { label: "Kategori", value: kategori, sub: "kategori berbeda", icon: Layers, tone: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    ];
  }, [filtered, tab]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(c => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${c.tone}`}><Icon className="w-4 h-4" /></div>
                <p className="text-3xl font-bold text-[var(--foreground)] mt-3">{c.value.toLocaleString("id-ID")}</p>
                <p className="text-xs font-semibold text-[var(--foreground)] mt-1">{c.label}</p>
                <p className="text-[11px] text-[var(--muted)] mt-0.5">{c.sub}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="relative flex-1 min-w-[220px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari kelas / training…"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors" />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(s => (
          <button key={s} onClick={() => setTab(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors border ${
              tab === s ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "text-[var(--muted)] border-transparent hover:bg-[var(--bg-card2)]"}`}>
            {s} <span className="text-[var(--muted)]">({counts[s] ?? 0})</span>
          </button>
        ))}
      </div>

      {loading ? <ListSkeleton rows={8} /> : filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Tidak ada kelas" desc="Kelas pelaksanaan training akan tampil di sini." />
      ) : (
        <ClassTable rows={filtered} onOpen={setDetail} />
      )}

      {detail && <MembersModal cls={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function ClassTable({ rows, onOpen }: { rows: EnrollmentClass[]; onOpen: (c: EnrollmentClass) => void }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
      <table className="w-full table-fixed text-sm min-w-[820px]">
        <colgroup>
          <col className="w-[112px]" />
          <col />
          <col className="w-[150px]" />
          <col className="w-[100px]" />
          <col className="w-[168px]" />
          <col className="w-[88px]" />
          <col className="w-[104px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <Th className="pl-8">Kode</Th>
            <Th>Kelas</Th>
            <Th>Kategori</Th>
            <Th>Mode</Th>
            <Th>Jadwal</Th>
            <Th className="!text-right">Peserta</Th>
            <Th className="pr-4">Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card2)]/50 transition-colors align-middle">
              <td className="py-2 pl-8 pr-3 font-mono text-[11px] text-[var(--muted)] whitespace-nowrap">{r.kode}</td>
              <td className="py-2 pr-3 font-medium text-[var(--foreground)] leading-snug break-words">{r.judul}</td>
              <td className="py-2 pr-3 text-xs leading-snug break-words">
                {r.kategori ? <span className="text-emerald-400">{r.kategori}</span> : <span className="text-[var(--muted)]">—</span>}
              </td>
              <td className="py-2 pr-3 whitespace-nowrap">{r.mode ? <StatusBadge status={r.mode} /> : <span className="text-[var(--muted)]">—</span>}</td>
              <td className="py-2 pr-3 text-[var(--muted)] text-xs whitespace-nowrap">{fmtRange(r.tanggal_mulai, r.tanggal_selesai)}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {r.peserta > 0 ? (
                  <button onClick={() => onOpen(r)}
                    className="inline-flex items-center justify-end gap-1 text-emerald-500 hover:text-emerald-400 hover:underline font-medium"
                    title="Lihat daftar peserta">
                    <UsersIcon className="w-3 h-3" />{r.peserta}
                  </button>
                ) : (
                  <span className="inline-flex items-center justify-end gap-1 text-[var(--muted)]"><UsersIcon className="w-3 h-3" />0</span>
                )}
              </td>
              <td className="py-2 pr-4 whitespace-nowrap"><StatusBadge status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MembersModal({ cls, onClose }: { cls: EnrollmentClass; onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    fetchClassMembers(cls.id)
      .then(m => { if (alive) setMembers(m); })
      .catch(e => { if (alive) setError((e as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [cls.id]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return members;
    return members.filter(m => [m.nama, m.nip, m.jabatan, m.unit_kerja, m.email].some(v => (v ?? "").toLowerCase().includes(s)));
  }, [members, q]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-[var(--foreground)] leading-snug">{cls.judul}</h3>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">
              {cls.kode} · {cls.peserta} peserta · {fmtRange(cls.tanggal_mulai, cls.tanggal_selesai)}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari peserta…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card2)] pl-9 pr-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50" />
          </div>
        </div>

        <div className="px-5 py-4 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-[var(--muted)]"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : error ? (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">Tidak ada peserta yang cocok.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {filtered.map((m, i) => (
                <li key={m.id} className="flex items-start gap-3 py-3">
                  <span className="w-5 shrink-0 text-[11px] text-[var(--muted)] tabular-nums text-right pt-1.5">{i + 1}</span>
                  <Avatar nama={m.nama} photo={m.photo} className="w-8 h-8 text-xs mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)] flex items-center gap-1.5">
                      <span className="truncate">{m.nama}</span>
                      {m.verified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-label="Terverifikasi" />}
                    </p>
                    <p className="text-[11px] text-[var(--muted)] truncate mt-0.5">
                      <span className="font-mono">{m.nip ?? "—"}</span>
                      {m.jabatan && <> · {m.jabatan}</>}
                      {m.unit_kerja && <> · {m.unit_kerja}</>}
                    </p>
                    {(m.entitas || m.level) && (
                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        {m.entitas && (
                          <span className="inline-flex items-center gap-1 text-[10px] rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5">
                            <Building2 className="w-3 h-3" />{m.entitas}
                          </span>
                        )}
                        {m.level && (
                          <span className="text-[10px] rounded-md border border-[var(--border)] bg-[var(--bg-card2)] text-[var(--muted)] px-1.5 py-0.5">{m.level}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    {m.phone && (
                      <a href={`tel:${m.phone}`} onClick={e => e.stopPropagation()} title={m.phone}
                        className="text-[var(--muted)] hover:text-emerald-500"><Phone className="w-3.5 h-3.5" /></a>
                    )}
                    {m.email && (
                      <a href={`mailto:${m.email}`} onClick={e => e.stopPropagation()} title={m.email}
                        className="text-[var(--muted)] hover:text-emerald-500"><Mail className="w-3.5 h-3.5" /></a>
                    )}
                    {m.nilai != null && (
                      <span className="text-[11px] tabular-nums text-[var(--foreground)] w-10 text-right">{m.nilai.toFixed(1)}</span>
                    )}
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

// "16 Jun – 21 Jun 2026" / satu tanggal bila tanpa akhir.
function fmtRange(start: string | null, end: string | null): string {
  if (!start) return "—";
  if (!end || end === start) return fmtDate(start);
  return `${fmtDateShort(start)} – ${fmtDate(end)}`;
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`py-2.5 pr-3 font-medium text-left ${className}`}>{children}</th>;
}
