"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Clock, BookOpen, ChevronDown, Loader2 } from "lucide-react";
import { fetchJplSearch, type JplSearchData, type JplSearchEmployee } from "@/lib/data";
import { fmtNum } from "@/lib/utils";
import { Avatar, EmptyState } from "@/components/ui";

export default function CariJplPage() {
  const [q, setQ] = useState("");
  const [data, setData] = useState<JplSearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  // Debounce input → panggil API. Query <2 char: kosongkan hasil.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setData(null); setLoading(false); return; }
    const id = ++reqId.current;
    setLoading(true);
    const t = setTimeout(() => {
      fetchJplSearch(term)
        .then(res => { if (id === reqId.current) setData(res); })
        .catch(() => { if (id === reqId.current) setData({ query: term, employees: [] }); })
        .finally(() => { if (id === reqId.current) setLoading(false); });
    }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const employees = data?.employees ?? [];

  return (
    <div className="p-6 max-w-[1100px] mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-500" /> Cari JPL Karyawan
        </h1>
        <p className="text-xs text-[var(--muted)] mt-1">
          Telusuri total jam pelajaran (JPL) seorang karyawan berdasarkan NIK atau nama · lintas entitas &amp; tahun · sumber AgroNow Insight
        </p>
      </div>

      {/* Pencarian */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
        {loading && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)] animate-spin" />}
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Ketik NIK atau nama karyawan…"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] pl-10 pr-10 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50"
        />
      </div>

      {q.trim().length < 2 ? (
        <EmptyState icon={Search} title="Mulai mencari" desc="Masukkan minimal 2 karakter NIK atau nama untuk menampilkan total JPL karyawan." />
      ) : loading && !data ? (
        <p className="text-sm text-[var(--muted)] text-center py-10">Mencari…</p>
      ) : employees.length === 0 ? (
        <EmptyState icon={Search} title="Tidak ditemukan" desc={`Tidak ada karyawan yang cocok dengan "${q.trim()}".`} />
      ) : (
        <div className="space-y-3">
          <p className="text-[11px] text-[var(--muted)]">{fmtNum(employees.length)} karyawan ditemukan{employees.length >= 50 ? " (50 teratas)" : ""}</p>
          {employees.map(e => <EmployeeCard key={e.id} e={e} />)}
        </div>
      )}
    </div>
  );
}

function EmployeeCard({ e }: { e: JplSearchEmployee }) {
  const [open, setOpen] = useState(false);
  const meta = useMemo(() => [e.nip, e.jabatan, e.unit, e.level].filter(Boolean).join(" · ") || "—", [e]);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="group w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--bg-card2)]/40"
      >
        <Avatar nama={e.nama} photo={e.photo} className="w-10 h-10 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--foreground)] truncate" title={e.nama}>{e.nama}</p>
          <p className="text-[11px] text-[var(--muted)] truncate">{meta}</p>
          {e.entitas && <p className="text-[10px] text-[var(--muted)] truncate mt-0.5">{e.entitas}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums leading-none">
            {fmtNum(e.jpl)} <span className="text-[11px] font-normal text-[var(--muted)]">JPL</span>
          </p>
          <p className="text-[10px] text-[var(--muted)] tabular-nums mt-1">{fmtNum(e.sesi)} program</p>
        </div>
        <ChevronDown className={`w-4 h-4 shrink-0 text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-[var(--border)] px-4 py-3 space-y-3">
          {/* Rincian per tahun */}
          {e.perYear.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {e.perYear.map(p => (
                <span key={p.year} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card2)] px-2.5 py-1 text-[11px]">
                  <span className="font-semibold text-[var(--foreground)]">{p.year}</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold tabular-nums">{fmtNum(p.jpl)} JPL</span>
                  <span className="text-[var(--muted)] tabular-nums">· {fmtNum(p.sesi)} program</span>
                </span>
              ))}
            </div>
          )}

          {/* Daftar pelatihan */}
          {e.trainings.length === 0 ? (
            <p className="text-xs text-[var(--muted)] py-2">Belum ada rekam pelatihan.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {e.trainings.map((t, i) => (
                <li key={i} className="flex items-center gap-3 py-2">
                  <div className="w-7 h-7 rounded-lg border border-violet-500/20 bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate" title={t.pelatihan}>{t.pelatihan}</p>
                    <p className="text-[11px] text-[var(--muted)] truncate">
                      {[t.tglMulai, t.penyelenggara, t.kategori].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtNum(t.jpl)} <span className="text-[10px] font-normal text-[var(--muted)]">JPL</span></span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
