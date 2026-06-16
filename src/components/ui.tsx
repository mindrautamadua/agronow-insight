"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

/**
 * Avatar peserta — foto karyawan (tabel `employee_photos`, sumber IHCMIS) bila
 * tersedia, jatuh ke inisial nama bila kosong/"#"/gagal dimuat.
 * `className` mengatur ukuran & ukuran teks inisial, mis. "w-8 h-8 text-xs".
 */
export function Avatar({ nama, photo, className = "w-8 h-8 text-xs" }: { nama: string; photo?: string | null; className?: string }) {
  const [broken, setBroken] = useState(false);
  const ok = !!photo && photo !== "#" && !broken;
  return (
    <span className={`${className} shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-white font-semibold uppercase`}>
      {ok
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={photo as string} alt="" loading="lazy" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={() => setBroken(true)} />
        : (nama?.charAt(0) || "?")}
    </span>
  );
}

// Pemetaan status → warna pill (selaras palet emerald/blue/amber/red).
const TONES: Record<string, string> = {
  // enrollment / session
  terdaftar:   "bg-blue-500/10 text-blue-400 border-blue-500/20",
  berlangsung: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  terjadwal:   "bg-violet-500/10 text-violet-400 border-violet-500/20",
  selesai:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  batal:       "bg-red-500/10 text-red-400 border-red-500/20",
  // course / employee
  aktif:       "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  arsip:       "bg-slate-500/10 text-slate-400 border-slate-500/20",
  nonaktif:    "bg-slate-500/10 text-slate-400 border-slate-500/20",
  // certification
  berlaku:     "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  kadaluarsa:  "bg-amber-500/10 text-amber-400 border-amber-500/20",
  dicabut:     "bg-red-500/10 text-red-400 border-red-500/20",
  // level
  dasar:       "bg-sky-500/10 text-sky-400 border-sky-500/20",
  menengah:    "bg-violet-500/10 text-violet-400 border-violet-500/20",
  lanjutan:    "bg-rose-500/10 text-rose-400 border-rose-500/20",
  // mode
  online:      "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  offline:     "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
  hybrid:      "bg-teal-500/10 text-teal-400 border-teal-500/20",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONES[status] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20";
  return (
    <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-md border font-medium capitalize ${tone}`}>
      {status}
    </span>
  );
}

export function Spinner() {
  return (
    <div className="h-full flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 text-slate-500 animate-spin" />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 gap-2">
      <div className="w-12 h-12 rounded-2xl bg-[var(--bg-card2)] border border-[var(--border)] flex items-center justify-center">
        <Icon className="w-5 h-5 text-[var(--muted)]" />
      </div>
      <p className="text-sm font-semibold text-[var(--foreground)] mt-1">{title}</p>
      {desc && <p className="text-xs text-[var(--muted)] max-w-sm">{desc}</p>}
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-[var(--bg-card2)] overflow-hidden min-w-[60px]">
        <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${v}%` }} />
      </div>
      <span className="text-[10px] text-[var(--muted)] tabular-nums w-8 text-right">{v}%</span>
    </div>
  );
}

// ── Skeleton (preload placeholder) ───────────────────────────────────────────
/** Blok shimmer dasar. Selalu sertakan kelas rounded-* lewat className. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

const keys = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Grid kartu KPI/stat. */
export function StatCardsSkeleton({ count = 4, cols = "lg:grid-cols-4" }: { count?: number; cols?: string }) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 ${cols} gap-3`}>
      {keys(count).map(i => (
        <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="w-2/3 h-6 rounded-md mt-3" />
          <Skeleton className="w-1/2 h-3 rounded mt-2.5" />
          <Skeleton className="w-1/3 h-2.5 rounded mt-1.5" />
        </div>
      ))}
    </div>
  );
}

/** Tren + 2 bar-card (untuk halaman analitik). */
export function ChartSkeleton() {
  return (
    <>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-3">
        <Skeleton className="w-40 h-4 rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {keys(6).map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {keys(2).map(c => (
          <div key={c} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 space-y-3.5">
            <Skeleton className="w-32 h-4 rounded" />
            {keys(6).map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-24 h-3 rounded shrink-0" />
                <Skeleton className="flex-1 h-2 rounded-full" />
                <Skeleton className="w-12 h-3 rounded shrink-0" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/** Daftar baris (tabel/list). avatar=true untuk list peserta/sertifikat. */
export function ListSkeleton({ rows = 8, avatar = false }: { rows?: number; avatar?: boolean }) {
  const w = ["w-1/2", "w-2/3", "w-3/5", "w-5/12", "w-7/12"];
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden divide-y divide-[var(--border)]">
      {keys(rows).map(i => (
        <div key={i} className="flex items-center gap-3 px-4 py-3">
          {avatar && <Skeleton className="w-9 h-9 rounded-full shrink-0" />}
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className={`h-3.5 rounded ${w[i % w.length]}`} />
            <Skeleton className="h-2.5 w-1/4 rounded" />
          </div>
          <Skeleton className="w-16 h-4 rounded shrink-0 hidden sm:block" />
        </div>
      ))}
    </div>
  );
}

/** Grid kartu (katalog kursus / kartu tabel skema dll). */
export function CardGridSkeleton({ count = 8, cols = "lg:grid-cols-4" }: { count?: number; cols?: string }) {
  return (
    <div className={`grid grid-cols-2 ${cols} gap-4`}>
      {keys(count).map(i => (
        <div key={i} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
            <Skeleton className="flex-1 h-3.5 rounded" />
          </div>
          <Skeleton className="w-full h-2.5 rounded" />
          <Skeleton className="w-3/4 h-2.5 rounded" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="w-16 h-6 rounded-md" />
            <Skeleton className="w-12 h-6 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton penuh satu halaman (hero + opsi tab + kartu + konten). */
export function PageSkeleton({
  maxW = "max-w-[1400px]", cards = 4, cardCols = "lg:grid-cols-4",
  tabs = false, variant = "chart", rows = 6, avatar = false,
}: {
  maxW?: string; cards?: number; cardCols?: string;
  tabs?: boolean; variant?: "chart" | "list" | "cards"; rows?: number; avatar?: boolean;
}) {
  return (
    <div className={`p-6 ${maxW} mx-auto space-y-5`}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-2">
          <Skeleton className="w-52 h-5 rounded-md" />
          <Skeleton className="w-72 h-3 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="w-44 h-9 rounded-xl" />
          <Skeleton className="w-24 h-9 rounded-xl" />
        </div>
      </div>
      {tabs && (
        <div className="flex items-center gap-5 border-b border-[var(--border)] pb-2">
          {keys(4).map(i => <Skeleton key={i} className="w-24 h-4 rounded" />)}
        </div>
      )}
      {cards > 0 && <StatCardsSkeleton count={cards} cols={cardCols} />}
      {variant === "chart" && <ChartSkeleton />}
      {variant === "list" && <ListSkeleton rows={rows} avatar={avatar} />}
      {variant === "cards" && <CardGridSkeleton count={rows} cols={cardCols} />}
    </div>
  );
}
