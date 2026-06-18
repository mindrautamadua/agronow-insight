"use client";

// Komponen chart berbasis recharts — theme-aware (light/dark via CSS var) & SSR-safe.
// Dipakai di dashboard L&D: tren bulanan, komposisi (donut), distribusi capaian,
// dan scatter efisiensi biaya vs JPL.

import { useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, BarChart, Bar, ScatterChart, Scatter, ZAxis, LabelList,
} from "recharts";
import { fmtNum, fmtRupiah } from "@/lib/utils";

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
// Palet selaras dengan tone KPI card di dashboard.
const PALETTE = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#14b8a6", "#f43f5e", "#6366f1", "#84cc16"];
const REST_COLOR = "#94a3b8";

type Metric = "jpl" | "sesi" | "biaya" | "peserta";
const METRIC_LABEL: Record<Metric, string> = { jpl: "JPL", sesi: "Program", biaya: "Biaya", peserta: "Peserta" };

const fmtMetric = (m: Metric, v: number) => (m === "biaya" ? fmtRupiah(v) : fmtNum(v));
// Sumbu Y angka ringkas (12 rb / 1,2 jt).
const axisNum = (v: number) =>
  Math.abs(v) >= 1e6 ? `${(v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`
  : Math.abs(v) >= 1e3 ? `${(v / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`
  : String(v);

// ── Tooltip kustom (pakai token tema, bukan putih bawaan recharts) ─────────────
function TipBox({ title, lines }: { title: string; lines: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card-solid)] px-3 py-2 shadow-2xl text-xs">
      <p className="font-semibold text-[var(--foreground)] mb-1 max-w-[220px] truncate">{title}</p>
      <div className="space-y-0.5">
        {lines.map((l, i) => (
          <p key={i} className="flex items-center gap-2 text-[var(--muted)]">
            {l.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: l.color }} />}
            <span>{l.label}</span>
            <span className="ml-auto font-semibold text-[var(--foreground)] tabular-nums">{l.value}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

// ── 1. Tren bulanan — area chart ───────────────────────────────────────────────
export interface TrendPoint { bln: number; jpl: number; sesi: number; biaya: number; peserta: number }

export function TrendAreaChart({ data, metric, onPick }: {
  data: TrendPoint[]; metric: Metric; onPick?: (bln: number) => void;
}) {
  const rows = useMemo(() => data.map(d => ({ ...d, label: BULAN[d.bln - 1] })), [data]);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
          onClick={(s) => {
            const p = (s as { activePayload?: { payload: TrendPoint }[] })?.activePayload?.[0]?.payload;
            if (p && onPick) onPick(p.bln);
          }}
          style={{ cursor: onPick ? "pointer" : "default" }}>
          <defs>
            <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <YAxis width={48} tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickFormatter={axisNum} />
          <Tooltip cursor={{ stroke: "var(--border)" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as TrendPoint;
            return <TipBox title={BULAN[p.bln - 1]} lines={[
              { label: "JPL", value: fmtNum(p.jpl), color: "#10b981" },
              { label: "Program", value: fmtNum(p.sesi), color: "#8b5cf6" },
              { label: "Peserta", value: fmtNum(p.peserta), color: "#3b82f6" },
              { label: "Biaya", value: fmtRupiah(p.biaya), color: "#f59e0b" },
            ]} />;
          }} />
          <Area type="monotone" dataKey={metric} name={METRIC_LABEL[metric]} stroke="#10b981" strokeWidth={2.5}
            fill="url(#trendFill)" dot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "#10b981", stroke: "var(--bg-card)", strokeWidth: 2 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 2. Komposisi — donut chart ─────────────────────────────────────────────────
export function CompositionDonut({ rows, onPick }: {
  rows: { label: string; jpl: number }[]; onPick?: (label: string) => void;
}) {
  const { data, total } = useMemo(() => {
    const sorted = [...rows].filter(r => r.jpl > 0).sort((a, b) => b.jpl - a.jpl);
    const total = sorted.reduce((s, r) => s + r.jpl, 0);
    const top = sorted.slice(0, 6);
    const restSum = sorted.slice(6).reduce((s, r) => s + r.jpl, 0);
    const data = restSum > 0 ? [...top, { label: "Lainnya", jpl: restSum, _rest: true }] : top;
    return { data, total };
  }, [rows]);

  if (data.length === 0 || total === 0)
    return <p className="text-xs text-[var(--muted)] py-10 text-center">Belum ada data.</p>;

  const colorOf = (i: number, rest?: boolean) => (rest ? REST_COLOR : PALETTE[i % PALETTE.length]);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  return (
    <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
      <div className="relative h-44 w-44 shrink-0 mx-auto sm:mx-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="jpl" nameKey="label" cx="50%" cy="50%" innerRadius={48} outerRadius={70}
              paddingAngle={2} stroke="var(--bg-card)" strokeWidth={2}
              onClick={(_, i) => { const d = data[i] as { label: string; _rest?: boolean }; if (onPick && !d._rest) onPick(d.label); }}
              style={{ cursor: onPick ? "pointer" : "default", outline: "none" }}>
              {data.map((d, i) => <Cell key={i} fill={colorOf(i, (d as { _rest?: boolean })._rest)} />)}
            </Pie>
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as { label: string; jpl: number };
              return <TipBox title={d.label} lines={[
                { label: "JPL", value: fmtNum(d.jpl) }, { label: "Porsi", value: `${pct(d.jpl)}%` },
              ]} />;
            }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-lg font-bold text-[var(--foreground)] tabular-nums leading-none">{fmtNum(total)}</span>
          <span className="text-[10px] text-[var(--muted)]">total JPL</span>
        </div>
      </div>

      <ul className="flex-1 min-w-0 space-y-1 self-stretch overflow-y-auto max-h-44">
        {data.map((d, i) => {
          const rest = (d as { _rest?: boolean })._rest;
          const inner = (
            <>
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: colorOf(i, rest) }} />
              <span className="flex-1 min-w-0 truncate text-xs text-[var(--foreground)] text-left" title={d.label}>{d.label}</span>
              <span className="shrink-0 text-xs font-semibold text-[var(--foreground)] tabular-nums">{pct(d.jpl)}%</span>
              <span className="shrink-0 w-16 text-right text-[11px] text-[var(--muted)] tabular-nums">{fmtNum(d.jpl)}</span>
            </>
          );
          return onPick && !rest ? (
            <li key={i}>
              <button type="button" onClick={() => onPick(d.label)}
                className="w-full flex items-center gap-2 rounded-lg -mx-1.5 px-1.5 py-1 transition-colors hover:bg-[var(--bg-card2)]/60">
                {inner}
              </button>
            </li>
          ) : (
            <li key={i} className="flex items-center gap-2 px-1.5 py-1">{inner}</li>
          );
        })}
      </ul>
    </div>
  );
}

// ── 3. Distribusi capaian JPL — histogram ──────────────────────────────────────
export function CapaianHistogram({ employees, target }: {
  employees: { jpl: number }[]; target: number;
}) {
  const data = useMemo(() => {
    const half = Math.max(1, Math.round(target / 2));
    const b = [
      { range: "0 JPL", n: 0, color: "#f43f5e" },
      { range: `1–${half}`, n: 0, color: "#f59e0b" },
      { range: `${half + 1}–${target}`, n: 0, color: "#3b82f6" },
      { range: `≥${target}`, n: 0, color: "#10b981" },
    ];
    for (const e of employees) {
      const j = e.jpl;
      if (j <= 0) b[0].n++;
      else if (j <= half) b[1].n++;
      else if (j < target) b[2].n++;
      else b[3].n++;
    }
    return b;
  }, [employees, target]);

  const empty = data.every(d => d.n === 0);
  if (empty) return <p className="text-xs text-[var(--muted)] py-10 text-center">Belum ada data capaian.</p>;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="range" tickLine={false} axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <YAxis width={36} allowDecimals={false} tickLine={false} axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <Tooltip cursor={{ fill: "var(--bg-card2)", opacity: 0.4 }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as { range: string; n: number };
            return <TipBox title={`${d.range} JPL`} lines={[{ label: "Karyawan", value: fmtNum(d.n) }]} />;
          }} />
          <Bar dataKey="n" radius={[6, 6, 0, 0]} maxBarSize={84}>
            {data.map((d, i) => <Cell key={i} fill={d.color} />)}
            <LabelList dataKey="n" position="top" style={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 700 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 4. Efisiensi — scatter biaya vs JPL ────────────────────────────────────────
export function EfficiencyScatter({ trainings }: {
  trainings: { id: string; pelatihan: string; jpl: number; peserta: number; biaya: number }[];
}) {
  const { points, medianRate } = useMemo(() => {
    const points = trainings
      .filter(t => t.jpl > 0 && t.biaya > 0)
      .map(t => ({ x: t.jpl, y: t.biaya, z: Math.max(1, t.peserta), nama: t.pelatihan, rate: t.biaya / t.jpl }));
    const rates = points.map(p => p.rate).sort((a, b) => a - b);
    const medianRate = rates.length ? rates[Math.floor(rates.length / 2)] : 0;
    return { points, medianRate };
  }, [trainings]);

  if (points.length === 0)
    return <p className="text-xs text-[var(--muted)] py-10 text-center">Belum ada pelatihan berbiaya untuk dianalisis.</p>;

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, left: 8, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis type="number" dataKey="x" name="JPL" tickLine={false} axisLine={{ stroke: "var(--border)" }}
            tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={axisNum}
            label={{ value: "JPL", position: "insideBottom", offset: -8, fill: "var(--muted)", fontSize: 11 }} />
          <YAxis type="number" dataKey="y" name="Biaya" width={56} tickLine={false} axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }} tickFormatter={axisNum} />
          <ZAxis type="number" dataKey="z" range={[40, 420]} name="Peserta" />
          <Tooltip cursor={{ strokeDasharray: "3 3", stroke: "var(--border)" }} content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const d = payload[0].payload as { nama: string; x: number; y: number; z: number; rate: number };
            return <TipBox title={d.nama} lines={[
              { label: "JPL", value: fmtNum(d.x) },
              { label: "Biaya", value: fmtRupiah(d.y) },
              { label: "Peserta", value: fmtNum(d.z) },
              { label: "Biaya/JPL", value: fmtRupiah(d.rate) },
            ]} />;
          }} />
          <Scatter data={points} fill="#10b981" fillOpacity={0.55} stroke="#10b981" />
        </ScatterChart>
      </ResponsiveContainer>
      <p className="text-[10px] text-[var(--muted)] text-center mt-1">
        Tiap titik = 1 pelatihan · sumbu-X: JPL · sumbu-Y: biaya · ukuran: jumlah peserta · median biaya/JPL {fmtRupiah(medianRate)}
      </p>
    </div>
  );
}
