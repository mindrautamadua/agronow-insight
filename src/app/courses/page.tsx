"use client";

import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Search, AlertTriangle, Layers, CheckCircle2, Clock } from "lucide-react";
import { fetchCourses, type Course } from "@/lib/data";
import { fmtRupiah, fmtNum } from "@/lib/utils";
import { CardGridSkeleton, StatusBadge, EmptyState } from "@/components/ui";

// Field yang dianggap wajib lengkap untuk sebuah entri katalog.
const REQUIRED: { label: string; ok: (c: Course) => boolean }[] = [
  { label: "Kategori", ok: c => !!c.kategori },
  { label: "Mode", ok: c => !!c.mode },
  { label: "Jam", ok: c => !!c.durasi_jam },
];

function missingFields(c: Course): string[] {
  return REQUIRED.filter(f => !f.ok(c)).map(f => f.label);
}

export default function CoursesPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [q, setQ] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [mode, setMode] = useState("");
  const [priceLo, setPriceLo] = useState<number | null>(null);
  const [priceHi, setPriceHi] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchCourses()
      .then(data => {
        setCourses(data);
        setPriceLo(0);
        setPriceHi(data.reduce((m, c) => Math.max(m, c.biaya ?? 0), 0));
      })
      .finally(() => setLoading(false));
  }, []);

  const modes = useMemo(
    () => Array.from(new Set(courses.map(c => c.mode).filter((m): m is string => !!m))).sort(),
    [courses],
  );
  const priceMax = useMemo(() => courses.reduce((m, c) => Math.max(m, c.biaya ?? 0), 0), [courses]);
  const priceStep = Math.max(1, Math.round(priceMax / 100));

  // Scope = hasil pencarian + mode + harga (TANPA toggle "belum lengkap").
  // Kartu summary & hitungan dihitung dari sini agar ikut filter/search.
  const scoped = useMemo(() => {
    const s = q.trim().toLowerCase();
    return courses.filter(c => {
      if (mode && c.mode !== mode) return false;
      const biaya = c.biaya ?? 0;
      if (priceLo !== null && biaya < priceLo) return false;
      if (priceHi !== null && biaya > priceHi) return false;
      if (!s) return true;
      return [c.judul, c.kode, c.kategori].some(v => (v ?? "").toLowerCase().includes(s));
    });
  }, [courses, q, mode, priceLo, priceHi]);

  const incompleteTotal = useMemo(() => scoped.filter(c => missingFields(c).length > 0).length, [scoped]);

  const summary = useMemo(() => {
    const aktif = scoped.filter(c => c.status === "aktif").length;
    const totalJam = scoped.reduce((s, c) => s + (c.durasi_jam ?? 0), 0);
    return { total: scoped.length, aktif, arsip: scoped.length - aktif, totalJam };
  }, [scoped]);

  // Toggle "belum lengkap" mempersempit scope untuk tabel saja.
  const filtered = useMemo(
    () => onlyIncomplete ? scoped.filter(c => missingFields(c).length > 0) : scoped,
    [scoped, onlyIncomplete],
  );

  const cards = [
    { label: "Total Program", value: summary.total, sub: "course di katalog", icon: Layers, tone: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Aktif", value: summary.aktif, sub: `${fmtNum(summary.arsip)} diarsipkan`, icon: CheckCircle2, tone: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    { label: "Total JPL", value: summary.totalJam, sub: "jam pelatihan", icon: Clock, tone: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
    { label: "Belum Lengkap", value: incompleteTotal, sub: "data perlu dilengkapi", icon: AlertTriangle, tone: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5">
      {!loading && courses.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map(c => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${c.tone}`}><Icon className="w-4 h-4" /></div>
                <p className="text-3xl font-bold text-[var(--foreground)] tabular-nums mt-3">{fmtNum(c.value)}</p>
                <p className="text-xs font-semibold text-[var(--foreground)] mt-1">{c.label}</p>
                <p className="text-[11px] text-[var(--muted)] mt-0.5">{c.sub}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari training…"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors" />
        </div>
        {!loading && modes.length > 0 && (
          <select value={mode} onChange={e => setMode(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors capitalize">
            <option value="">Semua mode</option>
            {modes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        {!loading && priceMax > 0 && priceLo !== null && priceHi !== null && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 min-w-[220px]">
            <div className="flex items-center justify-between text-[11px] text-[var(--muted)]">
              <span>Biaya</span>
              <span className="tabular-nums font-medium text-[var(--foreground)]">
                {fmtRupiah(priceLo)} – {fmtRupiah(priceHi)}
              </span>
            </div>
            <div className="relative h-4 flex items-center">
              {/* track */}
              <div className="absolute inset-x-0 h-1 rounded-full bg-[var(--border)]" />
              <div className="absolute h-1 rounded-full bg-[var(--primary)]"
                style={{ left: `${(priceLo / priceMax) * 100}%`, right: `${100 - (priceHi / priceMax) * 100}%` }} />
              <input type="range" min={0} max={priceMax} step={priceStep}
                value={priceLo} onChange={e => setPriceLo(Math.min(Number(e.target.value), priceHi))}
                className="range-thumb absolute inset-x-0 w-full appearance-none bg-transparent cursor-pointer" />
              <input type="range" min={0} max={priceMax} step={priceStep}
                value={priceHi} onChange={e => setPriceHi(Math.max(Number(e.target.value), priceLo))}
                className="range-thumb absolute inset-x-0 w-full appearance-none bg-transparent cursor-pointer" />
            </div>
          </div>
        )}
        {!loading && incompleteTotal > 0 && (
          <button onClick={() => setOnlyIncomplete(v => !v)} aria-pressed={onlyIncomplete}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium transition-colors ${
              onlyIncomplete
                ? "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            {incompleteTotal} data belum lengkap
          </button>
        )}
      </div>

      {loading ? <CardGridSkeleton count={8} cols="lg:grid-cols-4" /> : filtered.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Tidak ada training"
          desc={onlyIncomplete ? "Semua data yang cocok sudah lengkap." : "Katalog program pelatihan akan tampil di sini."} />
      ) : (
        <CourseTable rows={filtered} />
      )}
    </div>
  );
}

function CourseTable({ rows }: { rows: Course[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
      <table className="w-full table-fixed text-sm min-w-[820px]">
        <colgroup>
          <col className="w-[112px]" />
          <col />
          <col className="w-[150px]" />
          <col className="w-[100px]" />
          <col className="w-[64px]" />
          <col className="w-[64px]" />
          <col className="w-[104px]" />
          <col className="w-[88px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <Th className="pl-8">Kode</Th>
            <Th>Judul</Th>
            <Th>Kategori</Th>
            <Th>Mode</Th>
            <Th className="!text-right">Jam</Th>
            <Th className="!text-right">Hari</Th>
            <Th className="!text-right">Biaya</Th>
            <Th className="pr-4">Status</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(c => {
            const missing = missingFields(c);
            const incomplete = missing.length > 0;
            return (
              <tr key={c.id}
                className={`border-b border-[var(--border)] last:border-0 transition-colors align-middle ${
                  incomplete ? "bg-amber-500/[0.06] hover:bg-amber-500/10" : "hover:bg-[var(--bg-card2)]/50"}`}>
                <td className="py-2 pl-8 pr-3 font-mono text-[11px] text-[var(--muted)] whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5" title={incomplete ? `Belum lengkap: ${missing.join(", ")}` : undefined}>
                    {incomplete && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" aria-label="Data belum lengkap" />}
                    {c.kode}
                  </span>
                </td>
                <td className="py-2 pr-3 font-medium text-[var(--foreground)] leading-snug break-words">{c.judul}</td>
                <td className="py-2 pr-3 text-xs leading-snug break-words">
                  {c.kategori ? <span className="text-emerald-400">{c.kategori}</span> : <Empty />}
                </td>
                <td className="py-2 pr-3 whitespace-nowrap">{c.mode ? <StatusBadge status={c.mode} /> : <Empty />}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--foreground)]">{c.durasi_jam != null ? fmtNum(c.durasi_jam) : <Empty />}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--foreground)]">{c.durasi_hari != null ? fmtNum(c.durasi_hari) : "—"}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--foreground)] whitespace-nowrap">{fmtRupiah(c.biaya)}</td>
                <td className="py-2 pr-4 whitespace-nowrap"><StatusBadge status={c.status} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Penanda sel yang datanya belum diisi.
function Empty() {
  return <span className="text-amber-500/90 text-xs font-medium">belum diisi</span>;
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`py-2.5 pr-3 font-medium text-left ${className}`}>{children}</th>;
}
