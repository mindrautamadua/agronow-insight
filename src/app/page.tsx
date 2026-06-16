"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GraduationCap, BookOpen, Clock, Receipt, Users, Wallet,
  Building2, ChevronDown, Sparkles, Layers, BarChart3,
  Search, CheckCircle2, Target, Download, AlertTriangle, X, ChevronRight, ChevronLeft,
} from "lucide-react";
import { fetchDashboard, fetchCapaian, fetchBiaya, fetchDaftar, type DashboardData, type DashMonth, type CapaianData, type JplEmployee, type BiayaData, type BiayaBar, type DaftarData, type DaftarTraining, type DaftarPeserta } from "@/lib/data";
import { fmtRupiah, fmtNum, fmtDate } from "@/lib/utils";
import { PageSkeleton, ListSkeleton, StatCardsSkeleton, ChartSkeleton, Avatar } from "@/components/ui";
import { TrendAreaChart, CompositionDonut, CapaianHistogram, EfficiencyScatter } from "@/components/charts";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const TABS = ["Dashboard", "Capaian JPL", "Biaya", "Daftar Pelatihan"] as const;
type Tab = (typeof TABS)[number];

// Jenis detail (list) yang muncul saat sebuah KPI card di Dashboard diklik.
type KpiKind = "sesi" | "jpl" | "biaya" | "peserta" | "avgjpl" | "biayaPerJpl";

// Permintaan detail — bisa dari KPI card, baris bar-chart (level/kategori), atau sel bulan.
type Detail =
  | { mode: "kpi"; kind: KpiKind }
  | { mode: "level"; level: string }
  | { mode: "kategori"; kategori: string }
  | { mode: "bulan"; bln: number }
  | { mode: "member"; memberId: number; nama: string }
  | { mode: "biaya"; by: "unit" | "penyelenggara" | "level" | "kategori"; label: string };

// Samakan dengan normLevel di /api/dashboard agar filter level cocok dgn label bar.
function normLevel(v: string | null): string {
  const t = (v ?? "").trim();
  if (!t || t === "#N/A" || /unknown/i.test(t)) return "Lainnya";
  return t;
}

type Metric = "jpl" | "sesi" | "biaya" | "peserta";
const METRICS: { key: Metric; label: string }[] = [
  { key: "jpl", label: "JPL" }, { key: "sesi", label: "Sesi" },
  { key: "biaya", label: "Biaya" }, { key: "peserta", label: "Peserta" },
];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [entitas, setEntitas] = useState<number | undefined>();
  const [year, setYear] = useState<number | undefined>();
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [metric, setMetric] = useState<Metric>("jpl");
  const [capaian, setCapaian] = useState<CapaianData | null>(null);
  const [capLoading, setCapLoading] = useState(false);
  const [biaya, setBiaya] = useState<BiayaData | null>(null);
  const [biayaLoading, setBiayaLoading] = useState(false);
  const [daftar, setDaftar] = useState<DaftarData | null>(null);
  const [daftarLoading, setDaftarLoading] = useState(false);
  // Detail (modal) — pakai data daftar pelatihan (lazy, dishare lintas card/chart).
  const [detailReq, setDetailReq] = useState<Detail | null>(null);
  const [detailData, setDetailData] = useState<DaftarData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchDashboard(entitas, year)
      .then(d => { setData(d); setEntitas(d.entitas?.id); setYear(d.year); })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entitas, year]);

  // Capaian JPL di-fetch terpisah (lazy) saat tab-nya dibuka.
  useEffect(() => {
    if (tab !== "Capaian JPL" || !entitas || !year) return;
    setCapLoading(true);
    fetchCapaian(entitas, year).then(setCapaian).finally(() => setCapLoading(false));
  }, [tab, entitas, year]);

  // Rincian Biaya — lazy, saat tab Biaya dibuka.
  useEffect(() => {
    if (tab !== "Biaya" || !entitas || !year) return;
    setBiayaLoading(true);
    fetchBiaya(entitas, year).then(setBiaya).finally(() => setBiayaLoading(false));
  }, [tab, entitas, year]);

  // Daftar Pelatihan — lazy, saat tab-nya dibuka.
  useEffect(() => {
    if (tab !== "Daftar Pelatihan" || !entitas || !year) return;
    setDaftarLoading(true);
    fetchDaftar(entitas, year).then(setDaftar).finally(() => setDaftarLoading(false));
  }, [tab, entitas, year]);

  // Cache detail di-reset saat ganti entitas/tahun (data tak lagi relevan).
  useEffect(() => { setDetailData(null); }, [entitas, year]);

  // Detail — lazy, di-fetch sekali saat elemen pertama diklik.
  useEffect(() => {
    if (!detailReq || detailData || !entitas || !year) return;
    setDetailLoading(true);
    fetchDaftar(entitas, year).then(setDetailData).finally(() => setDetailLoading(false));
  }, [detailReq, detailData, entitas, year]);

  if (loading) return <PageSkeleton maxW="max-w-[1400px]" cards={6} cardCols="lg:grid-cols-6" tabs variant="chart" />;
  if (!data) return null;

  const { kpi } = data;
  const kpis: { label: string; value: string; sub: string; icon: React.ElementType; tone: string; kind: KpiKind }[] = [
    { label: "Sesi", value: fmtNum(kpi.sesi), sub: "kelas terlaksana", icon: BookOpen, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20", kind: "sesi" },
    { label: "Total JPL", value: fmtNum(kpi.jpl), sub: "jam terselenggara", icon: Clock, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20", kind: "jpl" },
    { label: "Total Biaya", value: fmtRupiah(kpi.biaya), sub: "realisasi", icon: Receipt, tone: "text-amber-500 bg-amber-500/10 border-amber-500/20", kind: "biaya" },
    { label: "Peserta", value: fmtNum(kpi.peserta), sub: "karyawan unik", icon: Users, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20", kind: "peserta" },
    { label: "Rata-rata JPL/sesi", value: kpi.avgJplSesi.toLocaleString("id-ID"), sub: "durasi kelas", icon: GraduationCap, tone: "text-teal-500 bg-teal-500/10 border-teal-500/20", kind: "avgjpl" },
    { label: "Biaya / JPL", value: fmtRupiah(kpi.biayaPerJpl), sub: "efisiensi", icon: Wallet, tone: "text-rose-500 bg-rose-500/10 border-rose-500/20", kind: "biayaPerJpl" },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Hero */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-emerald-500" /> Learning &amp; Development
          </h1>
          <p className="text-xs text-[var(--muted)] mt-1">
            Realisasi pelatihan &amp; JPL (jam pelatihan) · {data.entitas?.nama ?? "—"} · {data.year} · sumber AgroNow Insight
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Selector icon={Building2} value={entitas} onChange={v => setEntitas(Number(v))}
            options={data.entitasList.map(e => ({ value: e.id, label: e.nama }))} />
          <Selector value={year} onChange={v => setYear(Number(v))}
            options={data.years.map(y => ({ value: y, label: String(y) }))} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--border)] overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t ? "border-emerald-500 text-emerald-500" : "border-transparent text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Capaian JPL" ? (
        capLoading && !capaian ? <ListSkeleton rows={8} avatar /> : <CapaianView data={capaian} loading={capLoading} onPick={(memberId, nama) => setDetailReq({ mode: "member", memberId, nama })} />
      ) : tab === "Biaya" ? (
        biayaLoading && !biaya ? <div className="space-y-5"><StatCardsSkeleton count={4} /><ChartSkeleton /></div> : <BiayaView data={biaya} loading={biayaLoading} onPick={(by, label) => setDetailReq({ mode: "biaya", by, label })} />
      ) : tab === "Daftar Pelatihan" ? (
        daftarLoading && !daftar ? <ListSkeleton rows={10} /> : <DaftarView data={daftar} loading={daftarLoading} tahun={data.year} />
      ) : (
        <div className="space-y-5">
          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {kpis.map(k => {
              const Icon = k.icon;
              return (
                <button key={k.label} type="button" onClick={() => setDetailReq({ mode: "kpi", kind: k.kind })}
                  className="group text-left rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 transition-colors hover:border-[var(--primary)]/40 hover:bg-[var(--bg-card2)]/40 outline-none focus-visible:border-[var(--primary)]/60">
                  <div className="flex items-center justify-between">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${k.tone}`}><Icon className="w-4 h-4" /></div>
                    <ChevronRight className="w-4 h-4 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-2xl font-bold text-[var(--foreground)] mt-2.5 tabular-nums">{k.value}</p>
                  <p className="text-[11px] font-semibold text-[var(--foreground)] mt-0.5">{k.label}</p>
                  <p className="text-[10px] text-[var(--muted)]">{k.sub}</p>
                </button>
              );
            })}
          </div>

          <MonthlyTrend monthly={data.monthly} metric={metric} setMetric={setMetric}
            onPick={bln => setDetailReq({ mode: "bulan", bln })} />

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2 mb-4"><Layers className="w-4 h-4 text-emerald-500" /> Komposisi JPL per Level BOD</h3>
              <CompositionDonut rows={data.perLevel} onPick={l => setDetailReq({ mode: "level", level: l })} />
            </div>
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
              <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2 mb-4"><BookOpen className="w-4 h-4 text-emerald-500" /> Komposisi JPL per Kategori</h3>
              <CompositionDonut rows={data.perKategori} onPick={l => setDetailReq({ mode: "kategori", kategori: l })} />
            </div>
          </div>

          {data.perDivisi.length > 0 && (
            <BarCard title="JPL per Divisi" icon={Building2} rows={data.perDivisi} />
          )}
        </div>
      )}

      {detailReq && (
        <DetailModal req={detailReq} data={detailData} loading={detailLoading} onClose={() => setDetailReq(null)} />
      )}
    </div>
  );
}

function Selector({ icon: Icon, value, onChange, options }: {
  icon?: React.ElementType; value: number | undefined;
  onChange: (v: string) => void; options: { value: number; label: string }[];
}) {
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-500 pointer-events-none" />}
      <select value={value ?? ""} onChange={e => onChange(e.target.value)}
        className={`appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-card)] ${Icon ? "pl-8" : "pl-3"} pr-8 py-2 text-sm font-medium text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 max-w-[280px]`}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" />
    </div>
  );
}

function MonthlyTrend({ monthly, metric, setMetric, onPick }: { monthly: DashMonth[]; metric: Metric; setMetric: (m: Metric) => void; onPick?: (bln: number) => void }) {
  const insights = useMemo(() => buildInsights(monthly), [monthly]);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
          <Clock className="w-4 h-4 text-emerald-500" /> Tren Bulanan
          <span className="text-[var(--muted)] font-normal text-xs">· klik titik untuk rincian</span>
        </h3>
        <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-card2)] p-0.5">
          {METRICS.map(m => (
            <button key={m.key} onClick={() => setMetric(m.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                metric === m.key ? "bg-[var(--bg-card)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <TrendAreaChart data={monthly} metric={metric} onPick={onPick} />

      {insights.length > 0 && (
        <div className="mt-5 pt-4 border-t border-[var(--border)]">
          <p className="text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" /> Insight
          </p>
          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {insights.map((t, i) => (
              <p key={i} className="text-xs text-[var(--muted)] flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500/60 mt-1.5 shrink-0" />{t}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function buildInsights(monthly: DashMonth[]): string[] {
  const active = monthly.filter(m => m.sesi > 0 || m.jpl > 0);
  if (!active.length) return [];
  const out: string[] = [];
  const totalJpl = active.reduce((s, m) => s + m.jpl, 0);
  const peak = [...active].sort((a, b) => b.jpl - a.jpl)[0];
  out.push(`Puncak JPL di ${BULAN[peak.bln - 1]} — ${fmtNum(peak.jpl)} jam (${peak.sesi} kelas)`);

  const top2 = [...active].sort((a, b) => b.jpl - a.jpl).slice(0, 2);
  if (totalJpl > 0 && active.length > 2) {
    const pct = Math.round((top2.reduce((s, m) => s + m.jpl, 0) / totalJpl) * 100);
    out.push(`${pct}% JPL terkonsentrasi di ${top2.map(m => BULAN[m.bln - 1]).join(" & ")}`);
  }
  out.push(`${active.length} bulan aktif · ${12 - active.length} bulan belum ada kegiatan`);

  const mostClass = [...active].sort((a, b) => b.sesi - a.sesi)[0];
  out.push(`Terbanyak kelas di ${BULAN[mostClass.bln - 1]} — ${mostClass.sesi} sesi`);

  const withRate = active.filter(m => m.jpl > 0).map(m => ({ ...m, rate: m.biaya / m.jpl }));
  if (withRate.length) {
    const hi = [...withRate].sort((a, b) => b.rate - a.rate)[0];
    const lo = [...withRate].sort((a, b) => a.rate - b.rate)[0];
    out.push(`Termahal per jam: ${BULAN[hi.bln - 1]} (${fmtRupiah(hi.rate)}/JPL) · Teririt: ${BULAN[lo.bln - 1]} (${fmtRupiah(lo.rate)}/JPL)`);
  }
  return out;
}

function BarCard({ title, icon: Icon, rows, onPick }: { title: string; icon: React.ElementType; rows: { label: string; jpl: number }[]; onPick?: (label: string) => void }) {
  const max = Math.max(1, ...rows.map(r => r.jpl));
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2 mb-4"><Icon className="w-4 h-4 text-emerald-500" /> {title}</h3>
      {rows.length === 0 ? (
        <p className="text-xs text-[var(--muted)] py-6 text-center">Belum ada data.</p>
      ) : (
        <div className="space-y-1">
          {rows.map(r => {
            const inner = (
              <>
                <span className="w-28 shrink-0 text-xs text-[var(--foreground)] truncate text-left" title={r.label}>{r.label}</span>
                <div className="flex-1 h-2 rounded-full bg-[var(--bg-card2)] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${(r.jpl / max) * 100}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-xs font-semibold text-[var(--foreground)] tabular-nums">{fmtNum(r.jpl)} jpl</span>
              </>
            );
            return onPick ? (
              <button key={r.label} type="button" onClick={() => onPick(r.label)}
                className="w-full flex items-center gap-3 rounded-lg -mx-1.5 px-1.5 py-1 transition-colors hover:bg-[var(--bg-card2)]/60">
                {inner}
              </button>
            ) : (
              <div key={r.label} className="flex items-center gap-3 py-1">{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CapaianView({ data, loading, onPick }: { data: CapaianData | null; loading: boolean; onPick?: (memberId: number, nama: string) => void }) {
  const [q, setQ] = useState("");
  const [includeZero, setIncludeZero] = useState(false);

  const target = data?.target ?? 40;
  const base = useMemo(() => data?.employees ?? [], [data]);
  const pool = useMemo(() => includeZero ? base : base.filter(e => e.jpl > 0), [base, includeZero]);

  const stats = useMemo(() => {
    const total = pool.length;
    const capai = pool.filter(e => e.jpl >= target).length;
    const sumJpl = pool.reduce((s, e) => s + e.jpl, 0);
    return { total, capai, belum: total - capai, avg: total ? Math.round((sumJpl / total) * 10) / 10 : 0 };
  }, [pool, target]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return pool;
    return pool.filter(e => [e.nama, e.nip, e.jabatan].some(v => (v ?? "").toLowerCase().includes(s)));
  }, [pool, q]);

  const pct = (n: number) => stats.total ? Math.round((n / stats.total) * 100) : 0;
  const cards = [
    { label: "Total karyawan", value: stats.total.toLocaleString("id-ID"), sub: "punya rekam pelatihan", icon: Users, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { label: `Capai ≥${target} JPL`, value: stats.capai.toLocaleString("id-ID"), sub: `${pct(stats.capai)}% dari total`, icon: CheckCircle2, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Belum capai", value: stats.belum.toLocaleString("id-ID"), sub: `${pct(stats.belum)}% dari total`, icon: Target, tone: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { label: "Rata-rata JPL", value: stats.avg.toLocaleString("id-ID"), sub: `target ${target}`, icon: Clock, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
  ];

  return (
    <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${c.tone}`}><Icon className="w-4 h-4" /></div>
              <p className="text-2xl font-bold text-[var(--foreground)] mt-2.5 tabular-nums">{c.value}</p>
              <p className="text-[11px] font-semibold text-[var(--foreground)] mt-0.5">{c.label}</p>
              <p className="text-[10px] text-[var(--muted)]">{c.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
        <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2 mb-1"><BarChart3 className="w-4 h-4 text-emerald-500" /> Distribusi Capaian JPL</h3>
        <p className="text-[11px] text-[var(--muted)] mb-3">Sebaran jumlah karyawan per rentang JPL · target {target} JPL/tahun</p>
        <CapaianHistogram employees={pool} target={target} />
      </div>

      <div className="flex items-center justify-end">
        <button onClick={() => setIncludeZero(v => !v)} aria-pressed={includeZero}
          className="inline-flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
          <span className={`relative w-9 h-5 rounded-full transition-colors ${includeZero ? "bg-emerald-500" : "bg-[var(--bg-card2)] border border-[var(--border)]"}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${includeZero ? "left-[18px]" : "left-0.5"}`} />
          </span>
          Termasuk 0 JPL
        </button>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari karyawan / NIP / jabatan…"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors" />
          </div>
          <p className="text-xs text-[var(--muted)]">{filtered.length} / {stats.total} · target {target} JPL/tahun</p>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-10">Tidak ada data capaian.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map((e, i) => <CapaianRow key={e.id} e={e} rank={i + 1} target={target} onPick={onPick} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function CapaianRow({ e, rank, target, onPick }: { e: JplEmployee; rank: number; target: number; onPick?: (memberId: number, nama: string) => void }) {
  const done = e.jpl >= target;
  const pct = Math.min(100, target ? (e.jpl / target) * 100 : 0);
  return (
    <li>
      <button type="button" onClick={() => onPick?.(e.id, e.nama)} disabled={!onPick}
        className="group w-full flex items-center gap-3 py-2.5 text-left rounded-lg -mx-2 px-2 transition-colors hover:bg-[var(--bg-card2)]/60 cursor-pointer disabled:cursor-default">
        <span className="w-6 shrink-0 text-xs text-[var(--muted)] tabular-nums text-right">{rank}</span>
        <Avatar nama={e.nama} photo={e.photo} className="w-8 h-8 text-xs" />
        <div className="min-w-0 w-[200px] shrink-0">
          <p className="text-sm font-medium text-[var(--foreground)] truncate" title={e.nama}>{e.nama}</p>
          {e.jabatan && <p className="text-[11px] text-[var(--muted)] truncate" title={e.jabatan}>{e.jabatan}</p>}
        </div>
        {e.level && (
          <span className="hidden sm:inline-flex shrink-0 text-[10px] font-medium rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5">{e.level}</span>
        )}
        <div className="flex-1 min-w-[80px] h-2.5 rounded-full bg-[var(--bg-card2)] overflow-hidden">
          <div className={`h-full rounded-full ${done ? "bg-gradient-to-r from-emerald-500 to-emerald-400" : "bg-gradient-to-r from-amber-400 to-amber-500"}`} style={{ width: `${pct}%` }} />
        </div>
        <div className="shrink-0 text-right w-[78px]">
          <p className="text-sm tabular-nums"><span className="font-bold text-[var(--foreground)]">{fmtNum(e.jpl)}</span><span className="text-[11px] text-[var(--muted)]"> / {target} JPL</span></p>
          {done && <p className="text-[10px] text-emerald-500 font-medium">✓ Tercapai</p>}
        </div>
        <span className="shrink-0 w-12 text-right text-[11px] text-[var(--muted)] tabular-nums">{e.sesi} sesi</span>
        <ChevronRight className="w-4 h-4 shrink-0 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </li>
  );
}

function BiayaView({ data, loading, onPick }: { data: BiayaData | null; loading: boolean; onPick?: (by: "unit" | "penyelenggara" | "level" | "kategori", label: string) => void }) {
  if (!data) return null;
  const { kpi } = data;
  const cards = [
    { label: "Total Biaya", value: fmtRupiah(kpi.totalBiaya), sub: "realisasi", icon: Wallet, tone: "text-amber-500 bg-amber-500/10 border-amber-500/20" },
    { label: "Biaya / JPL", value: fmtRupiah(kpi.biayaPerJpl), sub: "efisiensi per jam", icon: Clock, tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
    { label: "Biaya / Peserta", value: fmtRupiah(kpi.biayaPerPeserta), sub: "per karyawan", icon: Users, tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { label: "Sesi berbiaya", value: fmtNum(kpi.sesiBerbiaya), sub: `${fmtNum(kpi.sesiTanpaBiaya)} tanpa biaya`, icon: BookOpen, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
  ];
  return (
    <div className={`space-y-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${c.tone}`}><Icon className="w-4 h-4" /></div>
              <p className="text-2xl font-bold text-[var(--foreground)] mt-2.5 tabular-nums">{c.value}</p>
              <p className="text-[11px] font-semibold text-[var(--foreground)] mt-0.5">{c.label}</p>
              <p className="text-[10px] text-[var(--muted)]">{c.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <BiayaBarCard title="Biaya per Unit Kerja" icon={Building2} rows={data.perUnit} onPick={onPick ? l => onPick("unit", l) : undefined} />
        <BiayaBarCard title="Biaya per Penyelenggara" icon={GraduationCap} rows={data.perPenyelenggara} onPick={onPick ? l => onPick("penyelenggara", l) : undefined} />
        <BiayaBarCard title="Biaya per Level BOD" icon={Layers} rows={data.perLevel} onPick={onPick ? l => onPick("level", l) : undefined} />
        <BiayaBarCard title="Biaya per Kategori" icon={BookOpen} rows={data.perKategori} onPick={onPick ? l => onPick("kategori", l) : undefined} />
      </div>
    </div>
  );
}

function BiayaBarCard({ title, icon: Icon, rows, onPick }: { title: string; icon: React.ElementType; rows: BiayaBar[]; onPick?: (label: string) => void }) {
  const top = rows.slice(0, 8);
  const max = Math.max(1, ...top.map(r => r.biaya));
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2 mb-4"><Icon className="w-4 h-4 text-emerald-500" /> {title}</h3>
      {top.length === 0 ? (
        <p className="text-xs text-[var(--muted)] py-6 text-center">Belum ada data.</p>
      ) : (
        <div className="space-y-1.5">
          {top.map(r => {
            const inner = (
              <>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-xs text-[var(--foreground)] truncate text-left" title={r.label}>{r.label}</span>
                  <span className="shrink-0 text-xs font-semibold text-[var(--foreground)] tabular-nums">{fmtRupiah(r.biaya)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--bg-card2)] overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${(r.biaya / max) * 100}%` }} />
                </div>
              </>
            );
            return onPick ? (
              <button key={r.label} type="button" onClick={() => onPick(r.label)}
                className="w-full text-left rounded-lg -mx-1.5 px-1.5 py-1.5 transition-colors hover:bg-[var(--bg-card2)]/60">
                {inner}
              </button>
            ) : (
              <div key={r.label} className="py-1.5">{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Daftar Pelatihan ──────────────────────────────────────────────────────────
const rupiahFull = (n: number) => (n > 0 ? `Rp ${n.toLocaleString("id-ID")}` : "—");
const tglRange = (a: string | null, b: string | null) => {
  if (!a) return "—";
  const start = fmtDate(a);
  return !b || b === a ? start : `${start} – ${fmtDate(b)}`;
};
const csvCell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
function downloadCSV(filename: string, rows: (string | number | null)[][]) {
  const body = rows.map(r => r.map(csvCell).join(",")).join("\r\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Detail (modal) — dari KPI card, baris bar-chart, atau sel bulan ────────────
const KIND_META: Record<KpiKind, { title: string; icon: React.ElementType }> = {
  sesi:        { title: "Daftar Sesi / Kelas", icon: BookOpen },
  jpl:         { title: "JPL per Pelatihan", icon: Clock },
  biaya:       { title: "Biaya per Pelatihan", icon: Receipt },
  peserta:     { title: "Peserta (karyawan unik)", icon: Users },
  avgjpl:      { title: "JPL per Sesi", icon: GraduationCap },
  biayaPerJpl: { title: "Biaya per JPL", icon: Wallet },
};

// Item yang dipilih untuk detail level-2 (peserta sebuah pelatihan / pelatihan seorang peserta).
type SelItem = { type: "training"; t: DaftarTraining } | { type: "peserta"; memberId: number };

function DetailModal({ req, data, loading, onClose }: { req: Detail; data: DaftarData | null; loading: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<SelItem | null>(null);

  // Reset pilihan saat ganti permintaan detail (klik card/chart lain).
  useEffect(() => { setSel(null); }, [req]);

  // Escape: mundur dari detail item dulu, baru tutup modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { if (sel) setSel(null); else onClose(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, sel]);

  // Subjek list (peserta vs pelatihan), metrik (biaya untuk drill tab Biaya).
  const showBiaya = req.mode === "biaya";
  const isPeserta = req.mode === "level" || (req.mode === "kpi" && req.kind === "peserta")
    || (showBiaya && (req.by === "unit" || req.by === "level"));
  const valueKind: KpiKind = req.mode === "kpi" ? req.kind : showBiaya ? "biaya" : "jpl";

  const { title, Icon } = useMemo(() => {
    if (req.mode === "kpi") { const m = KIND_META[req.kind]; return { title: m.title, Icon: m.icon }; }
    if (req.mode === "level") return { title: `Peserta · Level ${req.level}`, Icon: Layers };
    if (req.mode === "kategori") return { title: `Pelatihan · ${req.kategori}`, Icon: BookOpen };
    if (req.mode === "biaya") return {
      title: `Biaya · ${req.label}`,
      Icon: req.by === "unit" ? Building2 : req.by === "penyelenggara" ? GraduationCap : req.by === "level" ? Layers : BookOpen,
    };
    if (req.mode === "member") return { title: req.nama, Icon: Users };
    return { title: `Pelatihan · ${BULAN[req.bln - 1]}`, Icon: Clock };
  }, [req]);

  // Peserta unik — filter level bila perlu, dedupe per member, akumulasi JPL & sesi.
  const pesertaAgg = useMemo(() => {
    if (!isPeserta || !data) return [];
    const base =
      req.mode === "level" ? data.peserta.filter(p => normLevel(p.level) === req.level)
      : req.mode === "biaya" && req.by === "level" ? data.peserta.filter(p => normLevel(p.level) === req.label)
      : req.mode === "biaya" && req.by === "unit" ? data.peserta.filter(p => (p.unit ?? "Lainnya") === req.label)
      : data.peserta;
    const m = new Map<number, { memberId: number; nama: string; nip: string | null; unit: string | null; level: string | null; jpl: number; sesi: number; biaya: number; photo: string | null }>();
    for (const p of base) {
      const cur = m.get(p.memberId);
      if (cur) { cur.jpl += p.jpl; cur.sesi += 1; cur.biaya += p.biaya; }
      else m.set(p.memberId, { memberId: p.memberId, nama: p.nama, nip: p.nip, unit: p.unit, level: p.level, jpl: p.jpl, sesi: 1, biaya: p.biaya, photo: p.photo ?? null });
    }
    return [...m.values()].sort((a, b) => showBiaya ? (b.biaya - a.biaya || a.nama.localeCompare(b.nama)) : (b.jpl - a.jpl || a.nama.localeCompare(b.nama)));
  }, [isPeserta, data, req, showBiaya]);

  // Pelatihan — filter kategori/bulan bila perlu, lalu sort sesuai valueKind.
  const trainings = useMemo(() => {
    if (isPeserta || !data) return [];
    let arr = data.trainings;
    if (req.mode === "kategori") arr = arr.filter(t => (t.kategori ?? "Lainnya") === req.kategori);
    else if (req.mode === "bulan") arr = arr.filter(t => !!t.tglMulai && Number(t.tglMulai.slice(5, 7)) === req.bln);
    else if (req.mode === "biaya" && req.by === "penyelenggara") arr = arr.filter(t => t.penyelenggara === req.label);
    else if (req.mode === "biaya" && req.by === "kategori") arr = arr.filter(t => (t.kategori ?? "—") === req.label);
    arr = [...arr];
    if (valueKind === "sesi") arr.sort((a, b) => (b.tglMulai ?? "").localeCompare(a.tglMulai ?? ""));
    else if (valueKind === "biaya") arr.sort((a, b) => b.biaya - a.biaya);
    else if (valueKind === "biayaPerJpl") arr.sort((a, b) => (b.jpl ? b.biaya / b.jpl : 0) - (a.jpl ? a.biaya / a.jpl : 0));
    else arr.sort((a, b) => b.jpl - a.jpl); // jpl, avgjpl
    return arr;
  }, [isPeserta, data, req, valueKind]);

  const s = q.trim().toLowerCase();
  const fTrain = useMemo(() => trainings.filter(t => !s || [t.pelatihan, t.penyelenggara, t.kategori ?? ""].some(v => v.toLowerCase().includes(s))), [trainings, s]);
  const fPeserta = useMemo(() => pesertaAgg.filter(p => !s || [p.nama, p.nip ?? "", p.unit ?? "", p.level ?? ""].some(v => v.toLowerCase().includes(s))), [pesertaAgg, s]);

  const trainValue = (t: DaftarTraining): { text: string; tone: string } => {
    if (valueKind === "sesi") return { text: `${fmtNum(t.peserta)} peserta`, tone: "text-blue-600 dark:text-blue-400" };
    if (valueKind === "biaya") return { text: rupiahFull(t.biaya), tone: "text-amber-600 dark:text-amber-400" };
    if (valueKind === "biayaPerJpl") return { text: t.jpl ? `${fmtRupiah(t.biaya / t.jpl)}/JPL` : "—", tone: "text-rose-600 dark:text-rose-400" };
    return { text: `${fmtNum(t.jpl)} JPL`, tone: "text-emerald-600 dark:text-emerald-400" };
  };

  const summary = (() => {
    if (isPeserta) return showBiaya
      ? `${fmtNum(fPeserta.length)} peserta · total ${rupiahFull(fPeserta.reduce((a, p) => a + p.biaya, 0))}`
      : `${fmtNum(fPeserta.length)} peserta · total ${fmtNum(fPeserta.reduce((a, p) => a + p.jpl, 0))} JPL`;
    if (valueKind === "biaya") return `${fTrain.length} pelatihan · total ${rupiahFull(fTrain.reduce((a, t) => a + t.biaya, 0))}`;
    if (valueKind === "biayaPerJpl") {
      const b = fTrain.reduce((a, t) => a + t.biaya, 0), j = fTrain.reduce((a, t) => a + t.jpl, 0);
      return `${fTrain.length} pelatihan · rata-rata ${j ? fmtRupiah(b / j) : "—"}/JPL`;
    }
    if (valueKind === "sesi") return `${fTrain.length} sesi · ${fmtNum(fTrain.reduce((a, t) => a + t.peserta, 0))} kehadiran`;
    return `${fTrain.length} pelatihan · total ${fmtNum(fTrain.reduce((a, t) => a + t.jpl, 0))} JPL`;
  })();

  const count = isPeserta ? fPeserta.length : fTrain.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {req.mode === "member" ? (
          data ? (
            <ItemDetail sel={{ type: "peserta", memberId: req.memberId }} data={data} onBack={onClose} onClose={onClose} />
          ) : (
            <>
              <DetailHead onBack={onClose} onClose={onClose} title={req.nama} subtitle={loading ? "memuat…" : "—"} avatar />
              <div className="px-5 py-5"><ListSkeleton rows={6} /></div>
            </>
          )
        ) : sel ? (
          <ItemDetail sel={sel} data={data} onBack={() => setSel(null)} onClose={onClose} />
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
              <div className="min-w-0 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-[var(--foreground)] leading-snug">{title}</h3>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">{loading && !data ? "memuat…" : summary}</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"><X className="w-4 h-4" /></button>
            </div>

            <div className="px-5 pt-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                <input value={q} onChange={e => setQ(e.target.value)} placeholder={isPeserta ? "Cari peserta / unit…" : "Cari pelatihan / penyelenggara…"}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-card2)] pl-9 pr-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50" />
              </div>
            </div>

            <div className="px-5 py-4 overflow-y-auto">
              {loading && !data ? (
                <ListSkeleton rows={6} />
              ) : count === 0 ? (
                <p className="text-sm text-[var(--muted)] text-center py-8">Tidak ada data.</p>
              ) : isPeserta ? (
                <ul className="divide-y divide-[var(--border)]">
                  {fPeserta.map((p, i) => (
                    <li key={p.memberId}>
                      <button type="button" onClick={() => setSel({ type: "peserta", memberId: p.memberId })}
                        className="group w-full flex items-center gap-3 py-2.5 text-left rounded-lg -mx-2 px-2 transition-colors hover:bg-[var(--bg-card2)]/60">
                        <span className="w-6 shrink-0 text-[11px] text-[var(--muted)] tabular-nums text-right">{i + 1}</span>
                        <Avatar nama={p.nama} photo={p.photo} className="w-8 h-8 text-xs" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-[var(--foreground)] truncate" title={p.nama}>{p.nama}</p>
                          <p className="text-[11px] text-[var(--muted)] truncate">{[p.nip, p.unit, p.level].filter(Boolean).join(" · ") || "—"}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          {showBiaya ? (
                            <>
                              <p className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">{rupiahFull(p.biaya)}</p>
                              <p className="text-[10px] text-[var(--muted)] tabular-nums">{p.sesi} sesi · {fmtNum(p.jpl)} JPL</p>
                            </>
                          ) : (
                            <>
                              <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtNum(p.jpl)} <span className="text-[10px] font-normal text-[var(--muted)]">JPL</span></p>
                              <p className="text-[10px] text-[var(--muted)] tabular-nums">{p.sesi} sesi</p>
                            </>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 shrink-0 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {fTrain.map((t, i) => {
                    const v = trainValue(t);
                    return (
                      <li key={t.id}>
                        <button type="button" onClick={() => setSel({ type: "training", t })}
                          className="group w-full flex items-center gap-3 py-2.5 text-left rounded-lg -mx-2 px-2 transition-colors hover:bg-[var(--bg-card2)]/60">
                          <span className="w-6 shrink-0 text-[11px] text-[var(--muted)] tabular-nums text-right">{i + 1}</span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-[var(--foreground)] truncate flex items-center gap-1.5">
                              <span className="truncate" title={t.pelatihan}>{t.pelatihan}</span>
                              {t.flags.length > 0 && <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" aria-label="data janggal" />}
                            </p>
                            <p className="text-[11px] text-[var(--muted)] truncate">
                              {tglRange(t.tglMulai, t.tglSelesai)}{t.kategori ? ` · ${t.kategori}` : ""} · {t.penyelenggara}
                            </p>
                          </div>
                          <span className={`shrink-0 text-sm font-bold tabular-nums ${v.tone}`}>{v.text}</span>
                          <ChevronRight className="w-4 h-4 shrink-0 text-[var(--muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Header detail level-2 (tombol kembali + judul + tutup).
function DetailHead({ onBack, onClose, title, subtitle, avatar }: { onBack: () => void; onClose: () => void; title: string; subtitle: string; avatar?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
      <div className="min-w-0 flex items-center gap-2.5">
        <button onClick={onBack} className="p-1 -ml-1 text-[var(--muted)] hover:text-[var(--foreground)] shrink-0" aria-label="Kembali"><ChevronLeft className="w-4 h-4" /></button>
        {avatar
          ? <span className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center text-white text-sm font-semibold uppercase">{title.charAt(0)}</span>
          : <div className="w-9 h-9 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0"><BookOpen className="w-4 h-4" /></div>}
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--foreground)] leading-snug truncate" title={title}>{title}</h3>
          <p className="text-[11px] text-[var(--muted)] mt-0.5 truncate">{subtitle}</p>
        </div>
      </div>
      <button onClick={onClose} className="p-1 text-[var(--muted)] hover:text-[var(--foreground)] shrink-0"><X className="w-4 h-4" /></button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card2)]/50 px-3 py-2">
      <p className="text-[10px] text-[var(--muted)]">{label}</p>
      <p className="text-sm font-bold text-[var(--foreground)] tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function ItemDetail({ sel, data, onBack, onClose }: { sel: SelItem; data: DaftarData | null; onBack: () => void; onClose: () => void }) {
  const peserta = data?.peserta ?? [];

  if (sel.type === "training") {
    const t = sel.t;
    const rows = peserta
      .filter(p => p.pelatihan === t.pelatihan && p.tglMulai === t.tglMulai && p.tglSelesai === t.tglSelesai)
      .sort((a, b) => b.jpl - a.jpl || a.nama.localeCompare(b.nama));
    const sub = [tglRange(t.tglMulai, t.tglSelesai), t.kategori, t.penyelenggara].filter(Boolean).join(" · ");
    return (
      <>
        <DetailHead onBack={onBack} onClose={onClose} title={t.pelatihan} subtitle={sub} />
        <div className="px-5 pt-4 grid grid-cols-3 gap-2">
          <Stat label="JPL" value={fmtNum(t.jpl)} />
          <Stat label="Peserta" value={fmtNum(t.peserta)} />
          <Stat label="Total Biaya" value={rupiahFull(t.biaya)} />
        </div>
        {t.flags.length > 0 && (
          <div className="px-5 pt-3 flex flex-wrap gap-1.5">
            {t.flags.map(f => (
              <span key={f} className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium px-1.5 py-0.5">
                <AlertTriangle className="w-3 h-3" /> {f}
              </span>
            ))}
          </div>
        )}
        <p className="px-5 pt-4 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">Daftar peserta</p>
        <div className="px-5 pb-4 pt-1 overflow-y-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-[var(--muted)] text-center py-8">Tidak ada peserta.</p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {rows.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-6 shrink-0 text-[11px] text-[var(--muted)] tabular-nums text-right">{i + 1}</span>
                  <Avatar nama={p.nama} photo={p.photo} className="w-8 h-8 text-xs" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--foreground)] truncate" title={p.nama}>{p.nama}</p>
                    <p className="text-[11px] text-[var(--muted)] truncate">{[p.nip, p.unit, p.level].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtNum(p.jpl)} <span className="text-[10px] font-normal text-[var(--muted)]">JPL</span></p>
                    {p.biaya > 0 && <p className="text-[10px] text-[var(--muted)] tabular-nums">{rupiahFull(p.biaya)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </>
    );
  }

  // Detail peserta — daftar pelatihan yang diikuti.
  const rows = peserta.filter(p => p.memberId === sel.memberId)
    .sort((a, b) => (b.tglMulai ?? "").localeCompare(a.tglMulai ?? ""));
  const first = rows[0];
  const nama = first?.nama ?? `Member #${sel.memberId}`;
  const sub = first ? ([first.nip, first.unit, first.level].filter(Boolean).join(" · ") || "—") : "—";
  const totalJpl = rows.reduce((a, p) => a + p.jpl, 0);
  const totalBiaya = rows.reduce((a, p) => a + p.biaya, 0);
  return (
    <>
      <DetailHead onBack={onBack} onClose={onClose} title={nama} subtitle={sub} avatar />
      <div className="px-5 pt-4 grid grid-cols-3 gap-2">
        <Stat label="Total JPL" value={fmtNum(totalJpl)} />
        <Stat label="Sesi" value={fmtNum(rows.length)} />
        <Stat label="Total Biaya" value={rupiahFull(totalBiaya)} />
      </div>
      <p className="px-5 pt-4 text-[11px] font-semibold text-[var(--muted)] uppercase tracking-wider">Pelatihan diikuti</p>
      <div className="px-5 pb-4 pt-1 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-8">Tidak ada pelatihan.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {rows.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <span className="w-6 shrink-0 text-[11px] text-[var(--muted)] tabular-nums text-right">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--foreground)] truncate" title={p.pelatihan}>{p.pelatihan}</p>
                  <p className="text-[11px] text-[var(--muted)] truncate">
                    {tglRange(p.tglMulai, p.tglSelesai)}{p.kategori ? ` · ${p.kategori}` : ""} · {p.penyelenggara}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{fmtNum(p.jpl)} JPL</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function DaftarView({ data, loading, tahun }: { data: DaftarData | null; loading: boolean; tahun: number }) {
  const [mode, setMode] = useState<"pelatihan" | "peserta">("pelatihan");
  const [q, setQ] = useState("");
  const [kategori, setKategori] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  const trainings = useMemo(() => data?.trainings ?? [], [data]);
  const peserta = useMemo(() => data?.peserta ?? [], [data]);
  const flaggedCount = useMemo(() => trainings.filter(t => t.flags.length > 0).length, [trainings]);

  const ft = useMemo(() => {
    const s = q.trim().toLowerCase();
    return trainings.filter(t =>
      (!kategori || t.kategori === kategori) &&
      (!onlyFlagged || t.flags.length > 0) &&
      (!s || [t.pelatihan, t.penyelenggara].some(v => v.toLowerCase().includes(s))));
  }, [trainings, q, kategori, onlyFlagged]);

  const fp = useMemo(() => {
    const s = q.trim().toLowerCase();
    return peserta.filter(p =>
      (!kategori || p.kategori === kategori) &&
      (!s || [p.nama, p.nip ?? "", p.pelatihan, p.penyelenggara].some(v => v.toLowerCase().includes(s))));
  }, [peserta, q, kategori]);

  const exportCSV = () => {
    if (mode === "pelatihan") {
      downloadCSV(`daftar-pelatihan-${tahun}.csv`, [
        ["Pelatihan", "Tanggal Mulai", "Tanggal Selesai", "Penyelenggara", "Kategori", "JPL", "Peserta", "Total Biaya", "Catatan"],
        ...ft.map(t => [t.pelatihan, t.tglMulai, t.tglSelesai, t.penyelenggara, t.kategori, t.jpl, t.peserta, t.biaya, t.flags.join("; ")]),
      ]);
    } else {
      downloadCSV(`daftar-peserta-${tahun}.csv`, [
        ["Peserta", "NIP", "Unit Kerja", "Level", "Pelatihan", "Tanggal Mulai", "Tanggal Selesai", "Penyelenggara", "Kategori", "JPL", "Biaya"],
        ...fp.map(p => [p.nama, p.nip, p.unit, p.level, p.pelatihan, p.tglMulai, p.tglSelesai, p.penyelenggara, p.kategori, p.jpl, p.biaya]),
      ]);
    }
  };

  const count = mode === "pelatihan" ? ft.length : fp.length;

  return (
    <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5 space-y-4">
        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--bg-card2)] p-0.5">
            {([["pelatihan", "Per Pelatihan"], ["peserta", "Per Peserta"]] as const).map(([k, label]) => (
              <button key={k} onClick={() => setMode(k)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  mode === k ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "text-[var(--muted)] hover:text-[var(--foreground)]"}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari pelatihan / penyelenggara…"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] pl-9 pr-3 py-2.5 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 transition-colors" />
          </div>

          <div className="relative">
            <select value={kategori} onChange={e => setKategori(e.target.value)}
              className="appearance-none rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] pl-3 pr-8 py-2.5 text-sm font-medium text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50 max-w-[200px]">
              <option value="">Semua kategori</option>
              {(data?.categories ?? []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)] pointer-events-none" />
          </div>

          <p className="text-xs text-[var(--muted)] tabular-nums">{count} {mode === "pelatihan" ? "pelatihan" : "peserta"}</p>

          <button onClick={exportCSV} disabled={count === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card2)] px-3 py-2.5 text-xs font-medium text-[var(--foreground)] hover:border-[var(--primary)]/50 transition-colors disabled:opacity-50">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        {/* Banner data janggal — hanya di tampilan per pelatihan */}
        {mode === "pelatihan" && flaggedCount > 0 && (
          <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-3">
            <p className="text-sm font-medium text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
              <span><b>{flaggedCount}</b> pelatihan dengan data janggal (biaya/JPL/tanggal) — kemungkinan salah input.</span>
            </p>
            <button onClick={() => setOnlyFlagged(v => !v)}
              className="text-xs font-semibold text-amber-400 underline underline-offset-2 hover:text-amber-500 whitespace-nowrap">
              {onlyFlagged ? "Tampilkan semua" : "Lihat yang ditandai"}
            </button>
          </div>
        )}

        {/* Tabel */}
        {count === 0 ? (
          <p className="text-sm text-[var(--muted)] text-center py-10">Tidak ada data pelatihan.</p>
        ) : mode === "pelatihan" ? (
          <DaftarPelatihanTable rows={ft} />
        ) : (
          <DaftarPesertaTable rows={fp} />
        )}
      </div>

      {mode === "pelatihan" && ft.length > 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 sm:p-5">
          <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2 mb-1"><BarChart3 className="w-4 h-4 text-emerald-500" /> Efisiensi Biaya vs JPL</h3>
          <p className="text-[11px] text-[var(--muted)] mb-2">Deteksi pelatihan mahal dengan jam relatif sedikit — mengikuti filter di atas</p>
          <EfficiencyScatter trainings={ft} />
        </div>
      )}
    </div>
  );
}

function DaftarPelatihanTable({ rows }: { rows: DaftarTraining[] }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
            <th className="py-2.5 px-2 font-semibold">Pelatihan</th>
            <th className="py-2.5 px-2 font-semibold">Tanggal</th>
            <th className="py-2.5 px-2 font-semibold">Penyelenggara</th>
            <th className="py-2.5 px-2 font-semibold">Kategori</th>
            <th className="py-2.5 px-2 font-semibold text-right">JPL</th>
            <th className="py-2.5 px-2 font-semibold text-right">Peserta</th>
            <th className="py-2.5 px-2 font-semibold text-right">Total Biaya</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(t => (
            <tr key={t.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card2)]/60 transition-colors">
              <td className="py-3 px-2 max-w-[280px]">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[var(--foreground)] truncate" title={t.pelatihan}>{t.pelatihan}</span>
                  {t.flags.length > 0 && (
                    <span title={t.flags.join(" · ")} className="shrink-0 inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-medium px-1.5 py-0.5">
                      <AlertTriangle className="w-3 h-3" /> {t.flags.length}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 px-2 text-[var(--muted)] whitespace-nowrap">{tglRange(t.tglMulai, t.tglSelesai)}</td>
              <td className="py-3 px-2 text-[var(--foreground)] max-w-[180px] truncate" title={t.penyelenggara}>{t.penyelenggara}</td>
              <td className="py-3 px-2 text-[var(--muted)] whitespace-nowrap">{t.kategori ?? "—"}</td>
              <td className="py-3 px-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{t.jpl || "—"}</td>
              <td className="py-3 px-2 text-right tabular-nums text-blue-600 dark:text-blue-400 font-medium">{fmtNum(t.peserta)}</td>
              <td className="py-3 px-2 text-right tabular-nums text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">{rupiahFull(t.biaya)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DaftarPesertaTable({ rows }: { rows: DaftarPeserta[] }) {
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] border-b border-[var(--border)]">
            <th className="py-2.5 px-2 font-semibold">Peserta</th>
            <th className="py-2.5 px-2 font-semibold">Unit Kerja</th>
            <th className="py-2.5 px-2 font-semibold">Pelatihan</th>
            <th className="py-2.5 px-2 font-semibold">Tanggal</th>
            <th className="py-2.5 px-2 font-semibold">Kategori</th>
            <th className="py-2.5 px-2 font-semibold text-right">JPL</th>
            <th className="py-2.5 px-2 font-semibold text-right">Biaya</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(p => (
            <tr key={p.id} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-card2)]/60 transition-colors">
              <td className="py-3 px-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar nama={p.nama} photo={p.photo} className="w-7 h-7 text-[11px]" />
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--foreground)] truncate max-w-[160px]" title={p.nama}>{p.nama}</p>
                    {p.nip && <p className="text-[11px] text-[var(--muted)] tabular-nums">{p.nip}</p>}
                  </div>
                </div>
              </td>
              <td className="py-3 px-2 text-[var(--muted)] max-w-[160px] truncate" title={p.unit ?? "—"}>{p.unit ?? "—"}</td>
              <td className="py-3 px-2 text-[var(--foreground)] max-w-[220px] truncate" title={p.pelatihan}>{p.pelatihan}</td>
              <td className="py-3 px-2 text-[var(--muted)] whitespace-nowrap">{tglRange(p.tglMulai, p.tglSelesai)}</td>
              <td className="py-3 px-2 text-[var(--muted)] whitespace-nowrap">{p.kategori ?? "—"}</td>
              <td className="py-3 px-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{p.jpl || "—"}</td>
              <td className="py-3 px-2 text-right tabular-nums text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">{rupiahFull(p.biaya)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
