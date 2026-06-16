"use client";

import { useEffect, useState } from "react";
import { Users, Search, ChevronLeft, ChevronRight, Building2, Mail, Phone, Loader2, UserCheck, UserX } from "lucide-react";
import { fetchEmployeesPaged, fetchEmployeeEntitas, fetchEmployeeSummary, type Employee, type EntitasNode, type EmployeeSummary } from "@/lib/data";
import { fmtDate } from "@/lib/utils";
import { StatusBadge, EmptyState, ListSkeleton, Avatar } from "@/components/ui";

const TABS = [
  { key: "all", label: "Semua" },
  { key: "aktif", label: "Aktif" },
  { key: "nonaktif", label: "Nonaktif" },
] as const;

export default function EmployeesPage() {
  const [rows, setRows] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [entitas, setEntitas] = useState<string>("");
  const [sub, setSub] = useState<string>("");
  const [entitasList, setEntitasList] = useState<EntitasNode[]>([]);
  const [summary, setSummary] = useState<EmployeeSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Debounce input pencarian → reset ke halaman 1.
  const [dq, setDq] = useState("");
  useEffect(() => {
    const t = setTimeout(() => { setDq(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { fetchEmployeeEntitas().then(setEntitasList).catch(() => {}); }, []);
  useEffect(() => {
    let alive = true;
    fetchEmployeeSummary(dq, status, entitas, sub).then(s => { if (alive) setSummary(s); }).catch(() => {});
    return () => { alive = false; };
  }, [dq, status, entitas, sub]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchEmployeesPaged(dq, page, status, entitas, sub)
      .then(d => { if (!alive) return; setRows(d.employees); setTotal(d.total); setPages(d.pages); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [dq, page, status, entitas, sub]);

  function changeStatus(s: string) { setStatus(s); setPage(1); }
  function changeEntitas(v: string) { setEntitas(v); setSub(""); setPage(1); }
  function changeSub(v: string) { setSub(v); setPage(1); }

  const subs = entitasList.find(e => e.nama === entitas)?.subs ?? [];

  const cards = [
    { label: "Total Peserta", value: summary?.total, sub: "karyawan PTPN Group", icon: Users, tone: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
    { label: "Aktif", value: summary?.aktif, sub: "status aktif", icon: UserCheck, tone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Nonaktif", value: summary?.nonaktif, sub: "diblokir/keluar", icon: UserX, tone: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
    { label: "Entitas", value: entitasList.length || undefined, sub: "perusahaan/grup", icon: Building2, tone: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
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
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari peserta / NIP / email…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] pl-9 pr-9 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors" />
          {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] animate-spin" />}
        </div>
        <p className="text-xs text-[var(--muted)]">{total.toLocaleString("id-ID")} peserta</p>
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(t => (
            <button key={t.key} onClick={() => changeStatus(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                status === t.key ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "text-[var(--muted)] border-transparent hover:bg-[var(--bg-card2)]"}`}>
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
                <option key={e.nama} value={e.nama}>{e.nama} ({e.total.toLocaleString("id-ID")})</option>
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
                  <option key={s.group} value={s.group}>{s.nama} ({s.total.toLocaleString("id-ID")})</option>
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
        <EmptyState icon={Users} title="Tidak ada peserta" desc={dq ? "Tidak ada yang cocok dengan pencarian." : "Data peserta akan tampil di sini."} />
      ) : (
        <>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left">
                    {["NIP", "Nama", "Jabatan", "Entitas", "Level", "Masuk", "Status"].map(h => (
                      <th key={h} className="px-4 py-3 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card2)] transition-colors align-top">
                      <td className="px-4 py-3 font-mono text-[11px] text-[var(--muted)] whitespace-nowrap">{r.nip}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar nama={r.nama} photo={r.photo} className="w-7 h-7 text-xs" />
                          <div className="min-w-0">
                            <p className="font-medium text-[var(--foreground)]">{r.nama}</p>
                            <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                              {r.email && <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 hover:text-emerald-500 truncate max-w-[200px]"><Mail className="w-3 h-3 shrink-0" />{r.email}</a>}
                              {r.phone && <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1 hover:text-emerald-500"><Phone className="w-3 h-3" />{r.phone}</a>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--foreground)] max-w-[220px]">
                        {r.jabatan ?? <span className="text-[var(--muted)]">—</span>}
                        {r.departemen && <p className="text-[11px] text-[var(--muted)]">{r.departemen}</p>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.entitas ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500"><Building2 className="w-3 h-3" />{r.entitas}</span>
                        ) : <span className="text-[var(--muted)]">—</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.level ? <StatusBadge status={r.level} /> : <span className="text-[var(--muted)]">—</span>}</td>
                      <td className="px-4 py-3 text-[var(--muted)] whitespace-nowrap">{r.tanggal_masuk ? fmtDate(r.tanggal_masuk) : "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
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
