"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, MapPin, User as UserIcon, Users as UsersIcon, ChevronLeft, ChevronRight, ChevronDown, Search, X, BadgeCheck, Loader2 } from "lucide-react";
import { fetchCalendar, fetchClassMembers, type TrainingSession, type ClassMember } from "@/lib/data";
import { fmtDate } from "@/lib/utils";
import { Avatar, Skeleton, StatusBadge, EmptyState } from "@/components/ui";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

// Palet warna kartu event (di-assign stabil per kategori → tampilan warna-warni).
const PALETTE = [
  { bg: "bg-blue-500/10",    border: "border-blue-500/30",    text: "text-blue-600 dark:text-blue-400",       accent: "bg-blue-500" },
  { bg: "bg-violet-500/10",  border: "border-violet-500/30",  text: "text-violet-600 dark:text-violet-400",   accent: "bg-violet-500" },
  { bg: "bg-pink-500/10",    border: "border-pink-500/30",    text: "text-pink-600 dark:text-pink-400",       accent: "bg-pink-500" },
  { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-600 dark:text-emerald-400", accent: "bg-emerald-500" },
  { bg: "bg-amber-500/10",   border: "border-amber-500/30",   text: "text-amber-600 dark:text-amber-400",     accent: "bg-amber-500" },
  { bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    text: "text-cyan-600 dark:text-cyan-400",        accent: "bg-cyan-500" },
];
function colorFor(key: string) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
const STATUS_DOT: Record<string, string> = {
  terjadwal: "bg-blue-500", berlangsung: "bg-amber-500", selesai: "bg-emerald-500", batal: "bg-red-500",
};

const FILTERS = [
  { k: "", label: "Semua events" },
  { k: "terjadwal", label: "Terjadwal" },
  { k: "berlangsung", label: "Berlangsung" },
  { k: "selesai", label: "Selesai" },
] as const;

function startOfWeek(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Senin sbg awal minggu
  return x;
}

// Map yyyy-mm-dd → sesi yang berlangsung pada hari itu (termasuk rentang mulai–selesai).
function buildByDay(sessions: TrainingSession[]) {
  const map = new Map<string, TrainingSession[]>();
  for (const s of sessions) {
    const start = s.tanggal_mulai.slice(0, 10);
    const end = (s.tanggal_selesai || s.tanggal_mulai).slice(0, 10);
    const d = new Date(start + "T00:00:00"), last = new Date(end + "T00:00:00");
    while (d <= last) {
      const key = ymd(d);
      (map.get(key) ?? map.set(key, []).get(key)!).push(s);
      d.setDate(d.getDate() + 1);
    }
  }
  return map;
}

export default function CalendarPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TrainingSession[]>([]);
  const [view, setView] = useState<"week" | "month" | "list">("week");
  const [status, setStatus] = useState<string>("");
  const [q, setQ] = useState("");
  const [detail, setDetail] = useState<TrainingSession | null>(null);
  const todayYmd = new Date().toISOString().slice(0, 10);
  const [cursor, setCursor] = useState(() => new Date(todayYmd + "T00:00:00"));

  useEffect(() => { setLoading(true); fetchCalendar().then(setRows).finally(() => setLoading(false)); }, []);

  // Sekali setelah data masuk: bila minggu "hari ini" kosong, lompat ke sesi terdekat
  // (utamakan yang akan datang) supaya tampilan awal tidak kosong.
  const [picked, setPicked] = useState(false);
  useEffect(() => {
    if (picked || loading || rows.length === 0) return;
    const ws = startOfWeek(new Date(todayYmd + "T00:00:00")), we = new Date(ws);
    we.setDate(we.getDate() + 6);
    const inWeek = rows.some(s => { const d = s.tanggal_mulai.slice(0, 10); return d >= ymd(ws) && d <= ymd(we); });
    if (!inWeek) {
      const up = rows.filter(s => s.tanggal_mulai.slice(0, 10) >= todayYmd).sort((a, b) => a.tanggal_mulai.localeCompare(b.tanggal_mulai))[0];
      const target = up ?? [...rows].sort((a, b) => b.tanggal_mulai.localeCompare(a.tanggal_mulai))[0];
      if (target) setCursor(new Date(target.tanggal_mulai.slice(0, 10) + "T00:00:00"));
    }
    setPicked(true);
  }, [picked, loading, rows, todayYmd]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter(r => {
      if (status && r.status !== status) return false;
      if (!s) return true;
      return [r.judul, r.course_judul, r.kategori, r.lokasi].some(v => (v ?? "").toLowerCase().includes(s));
    });
  }, [rows, status, q]);

  const byDay = useMemo(() => buildByDay(filtered), [filtered]);

  const step = (dir: number) =>
    setCursor(c => view === "month"
      ? new Date(c.getFullYear(), c.getMonth() + dir, 1)
      : (() => { const d = new Date(c); d.setDate(d.getDate() + dir * 7); return d; })());
  const goToday = () => setCursor(new Date(todayYmd + "T00:00:00"));

  const monday = startOfWeek(cursor);
  const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6);
  const title = cursor.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
  const range = view === "month"
    ? `1 – ${new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()} ${cursor.toLocaleDateString("id-ID", { month: "short", year: "numeric" })}`
    : `${fmtDate(monday)} – ${fmtDate(sunday)}`;
  const tdy = new Date(todayYmd + "T00:00:00");

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-4">
      {/* Pills filter status */}
      <div className="inline-flex rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-1">
        {FILTERS.map(f => (
          <button key={f.k} onClick={() => setStatus(f.k)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              status === f.k ? "bg-[var(--bg-card2)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0 rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] px-3 py-1 text-center leading-tight">
            <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--muted)]">{tdy.toLocaleDateString("id-ID", { month: "short" })}</p>
            <p className="text-lg font-bold text-[var(--foreground)] tabular-nums -mt-0.5">{tdy.getDate()}</p>
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--foreground)] capitalize leading-tight">{title}</h2>
            <p className="text-[11px] text-[var(--muted)] capitalize">{range}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari pelatihan…"
              className="w-44 rounded-lg border border-[var(--border)] bg-[var(--bg-card2)] pl-8 pr-3 py-1.5 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50" />
          </div>
          <div className="inline-flex items-center rounded-lg border border-[var(--border)] overflow-hidden">
            <button onClick={() => step(-1)} className="px-2 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card2)] transition-colors"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={goToday} className="px-3 py-1.5 text-xs font-medium text-[var(--foreground)] border-x border-[var(--border)] hover:bg-[var(--bg-card2)] transition-colors">Hari ini</button>
            <button onClick={() => step(1)} className="px-2 py-1.5 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card2)] transition-colors"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="relative">
            <select value={view} onChange={e => setView(e.target.value as typeof view)}
              className="appearance-none rounded-lg border border-[var(--border)] bg-[var(--bg-card)] pl-3 pr-8 py-1.5 text-xs font-medium text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50">
              <option value="week">Tampilan minggu</option>
              <option value="month">Tampilan bulan</option>
              <option value="list">Daftar</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-3">
          <div className="grid grid-cols-7 gap-2">{Array.from({ length: 21 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarDays} title="Belum ada jadwal" desc="Jadwalkan sesi pelatihan untuk training di katalog." />
      ) : view === "week" ? (
        <WeekView monday={monday} byDay={byDay} todayYmd={todayYmd} onOpen={setDetail} />
      ) : view === "month" ? (
        <MonthView cursor={cursor} byDay={byDay} todayYmd={todayYmd} onPickDay={d => { setCursor(d); setView("week"); }} />
      ) : (
        <ListView sessions={filtered} todayYmd={todayYmd} onOpen={setDetail} />
      )}

      {detail && <SessionModal s={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function EventCard({ s, onOpen }: { s: TrainingSession; onOpen?: (s: TrainingSession) => void }) {
  const c = colorFor(s.kategori || s.course_judul || String(s.id));
  const sub = s.kategori || s.lokasi || s.course_judul || null;
  return (
    <button type="button" onClick={() => onOpen?.(s)}
      className={`relative w-full text-left rounded-lg border ${c.border} ${c.bg} pl-3 pr-2 py-1.5 overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40`}
      title={s.judul || s.course_judul || undefined}>
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${c.accent}`} />
      <span className={`absolute right-1.5 top-1.5 w-1.5 h-1.5 rounded-full ${STATUS_DOT[s.status] ?? "bg-slate-400"}`} title={s.status} />
      <p className={`text-[11px] font-semibold leading-tight truncate pr-3 ${c.text}`}>{s.judul || s.course_judul || "Sesi"}</p>
      {sub && <p className="text-[10px] text-[var(--muted)] truncate mt-0.5">{sub}</p>}
      <p className="text-[10px] text-[var(--muted)] mt-0.5 flex items-center gap-1"><UsersIcon className="w-2.5 h-2.5 shrink-0" />{s.terdaftar ?? 0} peserta</p>
    </button>
  );
}

function WeekView({ monday, byDay, todayYmd, onOpen }: { monday: Date; byDay: Map<string, TrainingSession[]>; todayYmd: string; onOpen?: (s: TrainingSession) => void }) {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(d.getDate() + i); return d; });
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[840px]">
          {/* Header hari */}
          <div className="grid grid-cols-7 border-b border-[var(--border)]">
            {days.map(d => {
              const isToday = ymd(d) === todayYmd;
              return (
                <div key={ymd(d)} className="px-2 py-2.5 text-center border-r border-[var(--border)] last:border-r-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{WEEKDAYS[(d.getDay() + 6) % 7]}</p>
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-semibold mt-1 tabular-nums ${
                    isToday ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--foreground)]"}`}>{d.getDate()}</span>
                </div>
              );
            })}
          </div>
          {/* Kolom hari */}
          <div className="grid grid-cols-7 max-h-[58vh] overflow-y-auto">
            {days.map(d => {
              const key = ymd(d); const list = byDay.get(key) ?? []; const isToday = key === todayYmd;
              return (
                <div key={key} className={`min-h-[440px] border-r border-[var(--border)] last:border-r-0 p-1.5 space-y-1.5 ${isToday ? "bg-[var(--primary)]/[0.04]" : ""}`}>
                  {list.map((s, i) => <EventCard key={`${s.id}-${i}`} s={s} onOpen={onOpen} />)}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthView({ cursor, byDay, todayYmd, onPickDay }: { cursor: Date; byDay: Map<string, TrainingSession[]>; todayYmd: string; onPickDay: (d: Date) => void }) {
  const y = cursor.getFullYear(), m = cursor.getMonth();
  const offset = (new Date(y, m, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => new Date(y, m, 1 - offset + i));
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[var(--border)]">
        {WEEKDAYS.map(w => <div key={w} className="px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const key = ymd(cell); const inMonth = cell.getMonth() === m; const isToday = key === todayYmd;
          const list = byDay.get(key) ?? [];
          return (
            <button key={i} onClick={() => onPickDay(cell)}
              className={`min-h-[96px] border-b border-r border-[var(--border)] p-1.5 text-left align-top transition-colors [&:nth-child(7n)]:border-r-0 ${
                inMonth ? "hover:bg-[var(--bg-card2)]/50" : "bg-[var(--bg-card2)]/40"}`}>
              <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs tabular-nums ${
                isToday ? "bg-[var(--foreground)] text-[var(--background)] font-bold" : inMonth ? "text-[var(--foreground)]" : "text-[var(--muted)]"}`}>{cell.getDate()}</span>
              <div className="mt-1 space-y-1">
                {list.slice(0, 2).map((s, j) => {
                  const c = colorFor(s.kategori || s.course_judul || String(s.id));
                  return (
                    <div key={`${s.id}-${j}`} className={`truncate rounded border ${c.border} ${c.bg} ${c.text} px-1 py-0.5 text-[10px] leading-tight font-medium`}>
                      {s.judul || s.course_judul}
                    </div>
                  );
                })}
                {list.length > 2 && <p className="text-[10px] text-[var(--muted)] pl-1">+{list.length - 2} lagi</p>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ sessions, todayYmd, onOpen }: { sessions: TrainingSession[]; todayYmd: string; onOpen?: (s: TrainingSession) => void }) {
  const { upcoming, past } = useMemo(() => {
    const up: TrainingSession[] = [], pa: TrainingSession[] = [];
    for (const s of sessions) (s.tanggal_mulai >= todayYmd ? up : pa).push(s);
    up.sort((a, b) => a.tanggal_mulai.localeCompare(b.tanggal_mulai));
    pa.sort((a, b) => b.tanggal_mulai.localeCompare(a.tanggal_mulai));
    return { upcoming: up, past: pa };
  }, [sessions, todayYmd]);
  return (
    <div className="space-y-6">
      <Section title="Mendatang" sessions={upcoming} empty="Tidak ada jadwal mendatang." onOpen={onOpen} />
      <Section title="Terlaksana" sessions={past} empty="Belum ada riwayat." muted onOpen={onOpen} />
    </div>
  );
}

function SessionCard({ s, muted, onOpen }: { s: TrainingSession; muted?: boolean; onOpen?: (s: TrainingSession) => void }) {
  const c = colorFor(s.kategori || s.course_judul || String(s.id));
  const d = new Date(s.tanggal_mulai);
  return (
    <button type="button" onClick={() => onOpen?.(s)}
      className={`relative w-full text-left rounded-2xl border ${c.border} ${c.bg} p-5 overflow-hidden cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/40 ${muted ? "opacity-90" : ""}`}>
      <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${c.accent}`} />
      <div className="flex items-start gap-4 pl-1">
        <div className="w-14 shrink-0 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] py-2 text-center">
          <p className={`text-[10px] uppercase font-semibold ${c.text}`}>{d.toLocaleDateString("id-ID", { month: "short" })}</p>
          <p className="text-2xl font-bold text-[var(--foreground)] leading-none tabular-nums">{d.getDate()}</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--foreground)] leading-snug">{s.judul || s.course_judul}</h3>
            <StatusBadge status={s.status} />
          </div>
          <p className="text-[11px] text-[var(--muted)] mt-0.5">{s.kategori ?? s.course_judul}</p>
          <div className="mt-3 space-y-1.5">
            <p className="text-[11px] text-[var(--muted)] flex items-center gap-1.5"><MapPin className="w-3 h-3 shrink-0" />{s.lokasi ?? "—"}</p>
            <p className="text-[11px] text-[var(--muted)] flex items-center gap-1.5"><UserIcon className="w-3 h-3 shrink-0" />{s.instruktur ?? "—"}</p>
            <p className="text-[11px] text-[var(--muted)] flex items-center gap-1.5"><UsersIcon className="w-3 h-3 shrink-0" />{s.terdaftar ?? 0}{s.kuota ? ` / ${s.kuota}` : ""} peserta</p>
          </div>
          {s.tanggal_selesai && s.tanggal_selesai !== s.tanggal_mulai && (
            <p className="text-[10px] text-[var(--muted)] mt-2">s.d. {fmtDate(s.tanggal_selesai)}</p>
          )}
        </div>
      </div>
    </button>
  );
}

function Section({ title, sessions, empty, muted, onOpen }: { title: string; sessions: TrainingSession[]; empty: string; muted?: boolean; onOpen?: (s: TrainingSession) => void }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wider mb-3">{title}</h2>
      {sessions.length === 0 ? (
        <p className="text-xs text-[var(--muted)] py-4">{empty}</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map(s => <SessionCard key={s.id} s={s} muted={muted} onOpen={onOpen} />)}
        </div>
      )}
    </div>
  );
}

function SessionModal({ s, onClose }: { s: TrainingSession; onClose: () => void }) {
  const [members, setMembers] = useState<ClassMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const c = colorFor(s.kategori || s.course_judul || String(s.id));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    let alive = true; setLoading(true); setError(null);
    fetchClassMembers(s.id)
      .then(m => { if (alive) setMembers(m); })
      .catch(e => { if (alive) setError((e as Error).message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [s.id]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return members;
    return members.filter(m => [m.nama, m.nip, m.jabatan, m.unit_kerja].some(v => (v ?? "").toLowerCase().includes(t)));
  }, [members, q]);

  const tgl = s.tanggal_selesai && s.tanggal_selesai !== s.tanggal_mulai
    ? `${fmtDate(s.tanggal_mulai)} – ${fmtDate(s.tanggal_selesai)}` : fmtDate(s.tanggal_mulai);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className={`h-1.5 shrink-0 ${c.accent}`} />
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[var(--foreground)] leading-snug">{s.judul || s.course_judul || "Sesi"}</h3>
              <StatusBadge status={s.status} />
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{tgl}</span>
              {s.kategori && <span className={`font-medium ${c.text}`}>{s.kategori}</span>}
              {s.lokasi && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{s.lokasi}</span>}
              {s.instruktur && <span className="flex items-center gap-1"><UserIcon className="w-3 h-3" />{s.instruktur}</span>}
              <span className="flex items-center gap-1"><UsersIcon className="w-3 h-3" />{s.terdaftar ?? 0}{s.kuota ? ` / ${s.kuota}` : ""} peserta</span>
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
            <p className="text-sm text-[var(--muted)] text-center py-8">{members.length === 0 ? "Belum ada peserta terdaftar." : "Tidak ada peserta yang cocok."}</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {filtered.map((m, i) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-6 shrink-0 text-[11px] text-[var(--muted)] tabular-nums text-right">{i + 1}</span>
                  <Avatar nama={m.nama} className="w-8 h-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate flex items-center gap-1.5">
                      <span className="truncate">{m.nama}</span>
                      {m.verified && <BadgeCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" aria-label="Terverifikasi" />}
                    </p>
                    <p className="text-[11px] text-[var(--muted)] truncate">
                      {[m.nip, m.jabatan, m.unit_kerja].filter(Boolean).join(" · ") || "—"}
                    </p>
                  </div>
                  {m.level && <span className="hidden sm:inline-flex shrink-0 text-[10px] font-medium rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5">{m.level}</span>}
                  {m.nilai != null && <span className="shrink-0 text-xs font-semibold text-[var(--foreground)] tabular-nums w-10 text-right">{m.nilai}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
