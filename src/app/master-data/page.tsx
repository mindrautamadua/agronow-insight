"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, Building2, MapPin, Factory, Search, AlertTriangle, X, ChevronRight } from "lucide-react";
import {
  fetchMasterData, type MasterDataResponse,
  type MasterEntitas, type MasterRegional, type MasterWorkunit,
} from "@/lib/data";
import { fmtNum } from "@/lib/utils";
import { PageSkeleton, EmptyState } from "@/components/ui";

type Tab = "entitas" | "regional" | "workunit";
type StatusFilter = "all" | "aktif" | "nonaktif";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "entitas",  label: "Entitas",    icon: Building2 },
  { key: "regional", label: "Regional",   icon: MapPin },
  { key: "workunit", label: "Unit Kerja", icon: Factory },
];

const TYPE_TONE: Record<string, string> = {
  "HOLDING":         "bg-violet-500/10 text-violet-500 border-violet-500/20",
  "SUB HOLDING":     "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "SUBSIDIARY":      "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  "SUB-SUBSIDIARY":  "bg-amber-500/10 text-amber-500 border-amber-500/20",
};

function StatusPill({ aktif }: { aktif: boolean }) {
  return (
    <span className={`inline-flex items-center text-[11px] px-2 py-0.5 rounded-md border font-medium ${
      aktif
        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
        : "bg-slate-500/10 text-slate-400 border-slate-500/20"
    }`}>
      {aktif ? "Aktif" : "Nonaktif"}
    </span>
  );
}

function TypeBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-[var(--muted)]">—</span>;
  const tone = TYPE_TONE[type] ?? "bg-slate-500/10 text-slate-400 border-slate-500/20";
  return <span className={`inline-flex text-[10px] px-1.5 py-0.5 rounded border font-semibold ${tone}`}>{type}</span>;
}

const cell = "px-3 py-2 text-xs text-[var(--foreground)]";
const head = "px-3 py-2 text-[11px] font-semibold text-[var(--muted)] text-left uppercase tracking-wide";
// Header sticky di modal: background di <th> (bukan <thead>) agar paint benar
// saat baris di-scroll di belakangnya, dan pakai token SOLID (--bg-card2 itu
// translucent sehingga baris tembus).
const headSticky = `${head} sticky top-0 z-10 bg-[var(--bg-card-solid)] border-b border-[var(--border)]`;

/** Angka jumlah yang bisa diklik untuk drill-down (jika > 0). */
function CountButton({ value, onClick }: { value: number; onClick: () => void }) {
  if (value <= 0) return <span className="text-[var(--muted)] tabular-nums">0</span>;
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 tabular-nums font-medium text-[var(--primary)] hover:underline"
    >
      {fmtNum(value)} <ChevronRight className="w-3 h-3" />
    </button>
  );
}

type Drill =
  | { kind: "regional"; title: string; rows: MasterRegional[] }
  | { kind: "workunit"; title: string; rows: MasterWorkunit[] };

export default function MasterDataPage() {
  const [data, setData] = useState<MasterDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("entitas");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [drill, setDrill] = useState<Drill | null>(null);

  // Drill-down memakai data lengkap (bukan hasil filter pencarian).
  const openEntityRegional = (e: MasterEntitas) => setDrill({
    kind: "regional", title: `Regional · ${e.singkatan ?? e.nama ?? "—"}`,
    rows: (data?.regional ?? []).filter(r => r.entitas_id === e.id),
  });
  const openEntityWorkunit = (e: MasterEntitas) => setDrill({
    kind: "workunit", title: `Unit Kerja · ${e.singkatan ?? e.nama ?? "—"}`,
    rows: (data?.workunit ?? []).filter(w => w.entitas_id === e.id),
  });
  const openRegionalWorkunit = (r: MasterRegional) => setDrill({
    kind: "workunit", title: `Unit Kerja · ${r.nama ?? r.kode ?? "—"}`,
    rows: (data?.workunit ?? []).filter(w => w.regional_id === r.id),
  });

  useEffect(() => {
    fetchMasterData()
      .then(setData)
      .catch(() => setErr("Gagal memuat master data. Pastikan IHCMIS_DB_URL terisi di .env.local lalu restart dev server."))
      .finally(() => setLoading(false));
  }, []);

  const term = q.trim().toLowerCase();
  const passStatus = (aktif: boolean) => status === "all" || (status === "aktif" ? aktif : !aktif);

  const entitas = useMemo<MasterEntitas[]>(() => (data?.entitas ?? []).filter(r =>
    passStatus(r.aktif) &&
    (!term || [r.kode, r.nama, r.singkatan, r.type].some(v => v?.toLowerCase().includes(term)))
  ), [data, term, status]);

  const regional = useMemo<MasterRegional[]>(() => (data?.regional ?? []).filter(r =>
    passStatus(r.aktif) &&
    (!term || [r.kode, r.nama, r.entitas].some(v => v?.toLowerCase().includes(term)))
  ), [data, term, status]);

  const workunit = useMemo<MasterWorkunit[]>(() => (data?.workunit ?? []).filter(r =>
    passStatus(r.aktif) &&
    (!term || [r.kode, r.nama, r.entitas, r.regional_master, r.regional_text, r.plant, r.profit_center].some(v => v?.toLowerCase().includes(term)))
  ), [data, term, status]);

  if (loading && !data) return <PageSkeleton maxW="max-w-[1200px]" cards={3} cardCols="lg:grid-cols-3" variant="list" />;

  if (err || !data) {
    return (
      <div className="p-6 max-w-[1200px] mx-auto">
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--foreground)]">{err ?? "Data tidak tersedia."}</p>
        </div>
      </div>
    );
  }

  const s = data.summary;
  const kpis = [
    { key: "entitas" as Tab,  label: "Entitas",    sum: s.entitas,  icon: Building2, tone: "text-violet-500 bg-violet-500/10 border-violet-500/20" },
    { key: "regional" as Tab, label: "Regional",   sum: s.regional, icon: MapPin,    tone: "text-blue-500 bg-blue-500/10 border-blue-500/20" },
    { key: "workunit" as Tab, label: "Unit Kerja", sum: s.workunit, icon: Factory,   tone: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  ];
  const counts: Record<Tab, number> = { entitas: entitas.length, regional: regional.length, workunit: workunit.length };

  return (
    <div className="p-6 max-w-[1200px] mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)] flex items-center gap-2">
          <Boxes className="w-5 h-5 text-violet-500" /> Manajemen Master Data
        </h1>
        <p className="text-xs text-[var(--muted)] mt-1">
          Entitas, Regional &amp; Unit Kerja korporat · sumber <b>IHCMIS-DEV</b> (read-only)
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {kpis.map(k => {
          const Icon = k.icon;
          const active = tab === k.key;
          return (
            <button
              key={k.key}
              onClick={() => setTab(k.key)}
              className={`text-left rounded-2xl border bg-[var(--bg-card)] p-4 transition-colors ${
                active ? "border-[var(--primary)] ring-1 ring-[var(--primary)]/30" : "border-[var(--border)] hover:border-[var(--border-md)]"
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${k.tone}`}><Icon className="w-4 h-4" /></div>
              <p className="text-2xl font-bold text-[var(--foreground)] mt-2.5 tabular-nums">{fmtNum(k.sum.total)}</p>
              <p className="text-[11px] font-semibold text-[var(--foreground)] mt-0.5">{k.label}</p>
              <p className="text-[10px] text-[var(--muted)]">{fmtNum(k.sum.aktif)} aktif</p>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 border-b border-[var(--border)]">
          <div className="flex gap-1 rounded-lg bg-[var(--bg-card2)] p-1">
            {TABS.map(t => {
              const Icon = t.icon;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    tab === t.key ? "bg-[var(--bg-card)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" /> {t.label}
                </button>
              );
            })}
          </div>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted)]" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Cari kode / nama…"
              className="pl-8 pr-3 py-1.5 w-full sm:w-56 rounded-lg bg-[var(--bg-card2)] border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-[var(--muted)] focus:outline-none focus:border-[var(--primary)]"
            />
          </div>
          <select
            value={status}
            onChange={e => setStatus(e.target.value as StatusFilter)}
            className="py-1.5 px-2.5 rounded-lg bg-[var(--bg-card2)] border border-[var(--border)] text-xs text-[var(--foreground)] focus:outline-none focus:border-[var(--primary)]"
          >
            <option value="all">Semua status</option>
            <option value="aktif">Aktif</option>
            <option value="nonaktif">Nonaktif</option>
          </select>
        </div>

        <div className="px-4 py-2 text-[11px] text-[var(--muted)] border-b border-[var(--border)]">
          Menampilkan <b className="text-[var(--foreground)]">{fmtNum(counts[tab])}</b> data
        </div>

        {/* Tables */}
        <div className="overflow-x-auto">
          {tab === "entitas" && (
            entitas.length === 0
              ? <EmptyState icon={Building2} title="Tidak ada entitas" desc="Sesuaikan pencarian atau filter status." />
              : (
                <table className="w-full">
                  <thead className="bg-[var(--bg-card2)]/50">
                    <tr><th className={head}>Kode</th><th className={head}>Nama Perusahaan</th><th className={head}>Singkatan</th><th className={head}>Tipe</th><th className={`${head} text-right`}>Regional</th><th className={`${head} text-right`}>Unit Kerja</th><th className={head}>Status</th></tr>
                  </thead>
                  <tbody>
                    {entitas.map(r => (
                      <tr key={r.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-card2)]/40">
                        <td className={`${cell} font-mono`}>{r.kode ?? "—"}</td>
                        <td className={`${cell} font-medium`}>{r.nama ?? "—"}</td>
                        <td className={cell}>{r.singkatan ?? "—"}</td>
                        <td className={cell}><TypeBadge type={r.type} /></td>
                        <td className={`${cell} text-right`}><CountButton value={r.regional_count} onClick={() => openEntityRegional(r)} /></td>
                        <td className={`${cell} text-right`}><CountButton value={r.workunit_count} onClick={() => openEntityWorkunit(r)} /></td>
                        <td className={cell}><StatusPill aktif={r.aktif} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
          )}

          {tab === "regional" && (
            regional.length === 0
              ? <EmptyState icon={MapPin} title="Tidak ada regional" desc="Sesuaikan pencarian atau filter status." />
              : (
                <table className="w-full">
                  <thead className="bg-[var(--bg-card2)]/50">
                    <tr><th className={head}>Kode</th><th className={head}>Nama Regional</th><th className={head}>Entitas</th><th className={`${head} text-right`}>Unit Kerja</th><th className={head}>Status</th></tr>
                  </thead>
                  <tbody>
                    {regional.map(r => (
                      <tr key={r.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-card2)]/40">
                        <td className={`${cell} font-mono`}>{r.kode ?? "—"}</td>
                        <td className={`${cell} font-medium`}>{r.nama ?? "—"}</td>
                        <td className={cell}>{r.entitas ?? "—"}</td>
                        <td className={`${cell} text-right`}><CountButton value={r.workunit_count} onClick={() => openRegionalWorkunit(r)} /></td>
                        <td className={cell}><StatusPill aktif={r.aktif} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
          )}

          {tab === "workunit" && (
            workunit.length === 0
              ? <EmptyState icon={Factory} title="Tidak ada unit kerja" desc="Sesuaikan pencarian atau filter status." />
              : (
                <table className="w-full">
                  <thead className="bg-[var(--bg-card2)]/50">
                    <tr><th className={head}>Kode</th><th className={head}>Nama Unit Kerja</th><th className={head}>Entitas</th><th className={head}>Regional</th><th className={head}>Plant</th><th className={head}>Profit Center</th><th className={head}>Status</th></tr>
                  </thead>
                  <tbody>
                    {workunit.map(r => (
                      <tr key={r.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-card2)]/40">
                        <td className={`${cell} font-mono`}>{r.kode ?? "—"}</td>
                        <td className={`${cell} font-medium`}>{r.nama ?? "—"}</td>
                        <td className={cell}>{r.entitas ?? "—"}</td>
                        <td className={cell}>{r.regional_master ?? r.regional_text ?? "—"}</td>
                        <td className={`${cell} font-mono`}>{r.plant ?? "—"}</td>
                        <td className={`${cell} font-mono`}>{r.profit_center ?? "—"}</td>
                        <td className={cell}><StatusPill aktif={r.aktif} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
          )}
        </div>
      </div>

      {drill && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setDrill(null)}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 p-4 border-b border-[var(--border)]">
              <div className="flex items-center gap-2 min-w-0">
                {drill.kind === "regional" ? <MapPin className="w-4 h-4 text-blue-500 shrink-0" /> : <Factory className="w-4 h-4 text-emerald-500 shrink-0" />}
                <h3 className="text-sm font-bold text-[var(--foreground)] truncate">{drill.title}</h3>
                <span className="text-[11px] text-[var(--muted)] shrink-0">· {fmtNum(drill.rows.length)} data</span>
              </div>
              <button onClick={() => setDrill(null)} className="p-1 rounded-lg text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card2)]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-auto">
              {drill.rows.length === 0 ? (
                <EmptyState icon={drill.kind === "regional" ? MapPin : Factory} title="Tidak ada data" />
              ) : drill.kind === "regional" ? (
                <table className="w-full">
                  <thead>
                    <tr><th className={headSticky}>Kode</th><th className={headSticky}>Nama Regional</th><th className={`${headSticky} text-right`}>Unit Kerja</th><th className={headSticky}>Status</th></tr>
                  </thead>
                  <tbody>
                    {drill.rows.map(r => (
                      <tr key={r.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-card2)]/40">
                        <td className={`${cell} font-mono`}>{r.kode ?? "—"}</td>
                        <td className={`${cell} font-medium`}>{r.nama ?? "—"}</td>
                        <td className={`${cell} text-right`}><CountButton value={r.workunit_count} onClick={() => openRegionalWorkunit(r)} /></td>
                        <td className={cell}><StatusPill aktif={r.aktif} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr><th className={headSticky}>Kode</th><th className={headSticky}>Nama Unit Kerja</th><th className={headSticky}>Regional</th><th className={headSticky}>Plant</th><th className={headSticky}>Status</th></tr>
                  </thead>
                  <tbody>
                    {drill.rows.map(w => (
                      <tr key={w.id} className="border-t border-[var(--border)] hover:bg-[var(--bg-card2)]/40">
                        <td className={`${cell} font-mono`}>{w.kode ?? "—"}</td>
                        <td className={`${cell} font-medium`}>{w.nama ?? "—"}</td>
                        <td className={cell}>{w.regional_master ?? w.regional_text ?? "—"}</td>
                        <td className={`${cell} font-mono`}>{w.plant ?? "—"}</td>
                        <td className={cell}><StatusPill aktif={w.aktif} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
