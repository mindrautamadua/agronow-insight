"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GraduationCap, Search, AlertTriangle, Layers, CheckCircle2, Clock,
  X, CalendarDays, Users as UsersIcon, User as UserIcon, Tag, Target,
  ListChecks, ClipboardList, StickyNote,
} from "lucide-react";
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

// Buang entri katalog yang judulnya kembar — sisakan satu saja.
// Yang dipertahankan: prioritas status aktif, lalu paling lengkap datanya.
function dedupeByJudul(courses: Course[]): Course[] {
  const better = (a: Course, b: Course) => {
    const aktif = (c: Course) => (c.status === "aktif" ? 1 : 0);
    if (aktif(a) !== aktif(b)) return aktif(a) > aktif(b) ? a : b;
    return missingFields(a).length <= missingFields(b).length ? a : b;
  };
  const byName = new Map<string, Course>();
  for (const c of courses) {
    const key = c.judul.trim().toLowerCase();
    const existing = byName.get(key);
    byName.set(key, existing ? better(existing, c) : c);
  }
  return Array.from(byName.values());
}

export default function CoursesPage() {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [q, setQ] = useState("");
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [mode, setMode] = useState("");
  const [metodeBelajar, setMetodeBelajar] = useState("");
  const [tahun, setTahun] = useState("");
  const [priceLo, setPriceLo] = useState<number | null>(null);
  const [priceHi, setPriceHi] = useState<number | null>(null);
  const [selected, setSelected] = useState<Course | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchCourses()
      .then(raw => {
        const data = dedupeByJudul(raw);
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
  const metodeBelajarOpts = useMemo(
    () => Array.from(new Set(courses.flatMap(c => c.metode_belajar))).sort(),
    [courses],
  );
  const years = useMemo(
    () => Array.from(new Set(courses.map(c => c.tahun).filter((t): t is number => t != null))).sort((a, b) => b - a),
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
      if (metodeBelajar && !c.metode_belajar.includes(metodeBelajar)) return false;
      if (tahun && String(c.tahun ?? "") !== tahun) return false;
      const biaya = c.biaya ?? 0;
      if (priceLo !== null && biaya < priceLo) return false;
      if (priceHi !== null && biaya > priceHi) return false;
      if (!s) return true;
      return [c.judul, c.kategori].some(v => (v ?? "").toLowerCase().includes(s));
    });
  }, [courses, q, mode, metodeBelajar, tahun, priceLo, priceHi]);

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
        {!loading && years.length > 0 && (
          <select value={tahun} onChange={e => setTahun(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors tabular-nums">
            <option value="">Semua tahun</option>
            {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
          </select>
        )}
        {!loading && modes.length > 0 && (
          <select value={mode} onChange={e => setMode(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors capitalize">
            <option value="">Semua mode</option>
            {modes.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        )}
        {!loading && metodeBelajarOpts.length > 0 && (
          <select value={metodeBelajar} onChange={e => setMetodeBelajar(e.target.value)}
            className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors">
            <option value="">Semua metode pembelajaran</option>
            {metodeBelajarOpts.map(m => <option key={m} value={m}>{m}</option>)}
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
        <CourseTable rows={filtered} onSelect={setSelected} />
      )}

      {selected && <CourseDetailModal course={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CourseTable({ rows, onSelect }: { rows: Course[]; onSelect: (c: Course) => void }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--bg-card)]">
      <table className="w-full table-fixed text-sm min-w-[880px]">
        <colgroup>
          <col />
          <col className="w-[150px]" />
          <col className="w-[64px]" />
          <col className="w-[100px]" />
          <col className="w-[64px]" />
          <col className="w-[64px]" />
          <col className="w-[104px]" />
          <col className="w-[88px]" />
        </colgroup>
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <Th className="pl-8">Judul</Th>
            <Th>Kategori</Th>
            <Th className="!text-right">Tahun</Th>
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
              <tr key={c.id} onClick={() => onSelect(c)} tabIndex={0}
                onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(c); } }}
                role="button" aria-label={`Lihat detail ${c.judul}`}
                className={`border-b border-[var(--border)] last:border-0 transition-colors align-middle cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[var(--primary)]/50 ${
                  incomplete ? "bg-amber-500/[0.06] hover:bg-amber-500/10" : "hover:bg-[var(--bg-card2)]/50"}`}>
                <td className="py-2 pl-8 pr-3 font-medium text-[var(--foreground)] leading-snug break-words">
                  <span className="inline-flex items-start gap-1.5" title={incomplete ? `Belum lengkap: ${missing.join(", ")}` : undefined}>
                    {incomplete && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" aria-label="Data belum lengkap" />}
                    {c.judul}
                  </span>
                </td>
                <td className="py-2 pr-3 text-xs leading-snug break-words">
                  {c.kategori ? <span className="text-emerald-400">{c.kategori}</span> : <Empty />}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-[var(--foreground)]">{c.tahun ?? "—"}</td>
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

// Panel detail satu entri katalog (dibuka saat baris diklik).
function CourseDetailModal({ course: c, onClose }: { course: Course; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const meta: { icon: React.ElementType; label: string; value: React.ReactNode }[] = [
    { icon: CalendarDays, label: "Tahun", value: c.tahun ?? "—" },
    { icon: Clock, label: "JPL (jam)", value: c.durasi_jam != null ? fmtNum(c.durasi_jam) : "—" },
    { icon: CalendarDays, label: "Durasi (hari)", value: c.durasi_hari != null ? fmtNum(c.durasi_hari) : "—" },
    { icon: UsersIcon, label: "Min. peserta", value: c.minimal_peserta != null ? fmtNum(c.minimal_peserta) : "—" },
    { icon: Layers, label: "Level peserta", value: c.level_peserta ?? "—" },
    { icon: UserIcon, label: "PIC", value: c.pic ?? "—" },
    { icon: UsersIcon, label: "Rekomendasi grup", value: c.rekomendasi_grup ?? "—" },
  ];

  const sections: { icon: React.ElementType; label: string; value: string | null }[] = [
    { icon: GraduationCap, label: "Deskripsi", value: c.deskripsi },
    { icon: Target, label: "Sasaran Pembelajaran", value: c.sasaran },
    { icon: ListChecks, label: "Silabus", value: c.silabus },
    { icon: ClipboardList, label: "Penugasan Pasca Pelatihan", value: c.penugasan_pasca },
    { icon: StickyNote, label: "Catatan Peserta", value: c.catatan_peserta },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="h-1.5 shrink-0 bg-[var(--primary)]" />
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[var(--foreground)] leading-snug">{c.judul}</h3>
              <StatusBadge status={c.status} />
              {c.mode && <StatusBadge status={c.mode} />}
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              {c.tahun && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{c.tahun}</span>}
              {c.kategori && <span className="flex items-center gap-1 text-emerald-400"><Tag className="w-3 h-3" />{c.kategori}</span>}
              <span className="font-medium text-[var(--foreground)] tabular-nums">{fmtRupiah(c.biaya)}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {meta.map(m => {
              const Icon = m.icon;
              return (
                <div key={m.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-card2)]/40 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-[var(--muted)] flex items-center gap-1"><Icon className="w-3 h-3" />{m.label}</p>
                  <p className="text-sm font-medium text-[var(--foreground)] mt-1 break-words">{m.value}</p>
                </div>
              );
            })}
          </div>

          {sections.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label}>
                <p className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5 mb-1.5"><Icon className="w-3.5 h-3.5 text-[var(--muted)]" />{s.label}</p>
                {s.value
                  ? <p className="text-sm text-[var(--muted)] leading-relaxed whitespace-pre-line break-words">{s.value}</p>
                  : <p className="text-xs text-amber-500/90 font-medium">belum diisi</p>}
              </div>
            );
          })}

          {c.metode_belajar.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5 mb-1.5"><Layers className="w-3.5 h-3.5 text-[var(--muted)]" />Metode Pembelajaran</p>
              <div className="flex flex-wrap gap-1.5">
                {c.metode_belajar.map(m => (
                  <span key={m} className="text-[11px] rounded-md border border-[var(--primary)]/25 bg-[var(--primary)]/10 px-2 py-0.5 text-[var(--primary)]">{m}</span>
                ))}
              </div>
            </div>
          )}

          {c.kata_kunci && (
            <div>
              <p className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5 mb-1.5"><Tag className="w-3.5 h-3.5 text-[var(--muted)]" />Kata Kunci</p>
              <div className="flex flex-wrap gap-1.5">
                {c.kata_kunci.split(/[,;]+/).map(k => k.trim()).filter(Boolean).map((k, i) => (
                  <span key={i} className="text-[11px] rounded-md border border-[var(--border)] bg-[var(--bg-card2)]/50 px-2 py-0.5 text-[var(--muted)]">{k}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
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
