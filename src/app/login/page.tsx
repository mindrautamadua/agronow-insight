"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2, Lock, User as UserIcon, Eye, EyeOff,
  AlertCircle, ArrowRight, GraduationCap, Award, CalendarDays, Sun, Moon,
} from "lucide-react";
import { useTheme } from "@/components/ThemeContext";

const FEATURES = [
  { icon: GraduationCap, title: "Katalog & Enrollment Training", desc: "Kelola program pelatihan dan daftarkan peserta dalam satu tempat." },
  { icon: Award, title: "Sertifikasi", desc: "Catat & pantau sertifikat pelatihan tiap peserta." },
  { icon: CalendarDays, title: "Kalender Training", desc: "Jadwalkan sesi pelatihan dan lihat agenda mendatang." },
];

// ── Constellation "jaringan pembelajaran" (koordinat tetap → SSR-stable) ──
const NODES = [
  { x: 60, y: 120, r: 4 }, { x: 180, y: 80, r: 3 }, { x: 300, y: 140, r: 5 }, { x: 420, y: 90, r: 3 },
  { x: 120, y: 260, r: 3 }, { x: 260, y: 240, r: 4 }, { x: 400, y: 260, r: 3 }, { x: 70, y: 400, r: 3 },
  { x: 210, y: 400, r: 5 }, { x: 350, y: 420, r: 4 }, { x: 450, y: 400, r: 3 }, { x: 150, y: 560, r: 4 },
  { x: 300, y: 580, r: 3 }, { x: 420, y: 560, r: 4 }, { x: 240, y: 690, r: 3 }, { x: 90, y: 690, r: 3 },
];
const LINKS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [2, 5], [3, 6], [4, 5], [5, 6], [4, 7],
  [5, 8], [6, 9], [8, 9], [9, 10], [7, 8], [8, 11], [9, 12], [10, 13], [11, 12],
  [12, 13], [11, 15], [12, 14], [14, 15], [13, 14],
];
// Partikel naik (mote cahaya) — kolom-x & ritme tetap.
const MOTES = [
  { x: 50, dur: 11, delay: 0, r: 2 }, { x: 130, dur: 14, delay: 2.5, r: 1.6 },
  { x: 215, dur: 9, delay: 1, r: 2.4 }, { x: 300, dur: 13, delay: 3.5, r: 1.8 },
  { x: 380, dur: 10, delay: 0.6, r: 2 }, { x: 450, dur: 15, delay: 2, r: 1.6 },
];

export default function LoginPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Login gagal.");
        setLoading(false);
        return;
      }
      router.replace("/");
    } catch {
      setError("Tidak dapat menghubungi server.");
      setLoading(false);
    }
  }

  const lineColor = isLight ? "rgba(13,148,136,0.45)" : "rgba(45,212,191,0.40)";
  const nodeColor = isLight ? "#0d9488" : "#5eead4";
  const moteColor = isLight ? "#10b981" : "#6ee7b7";

  return (
    <div className={`relative min-h-screen w-full overflow-hidden ${isLight ? "bg-[#f4f7fb] text-slate-900" : "bg-[#070b15] text-white"}`}>
      <button
        onClick={toggleTheme}
        title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
        aria-label="Toggle theme"
        className={`absolute top-5 right-5 z-20 p-2 rounded-lg transition-all backdrop-blur-md ${
          isLight
            ? "bg-white/70 border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-white shadow-sm"
            : "bg-white/[0.04] border border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.08]"
        }`}
      >
        {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
      </button>

      {/* ── Latar: glow brand + jaringan pembelajaran bergerak + mote naik ── */}
      {/* Brand glow washes (statis, lembut) */}
      <div aria-hidden className="pointer-events-none absolute inset-0"
        style={{
          background: isLight
            ? "radial-gradient(58% 48% at 10% 6%, rgba(16,185,129,0.16), transparent 60%), radial-gradient(52% 48% at 92% 26%, rgba(37,99,235,0.13), transparent 62%)"
            : "radial-gradient(58% 48% at 10% 6%, rgba(16,185,129,0.22), transparent 60%), radial-gradient(52% 48% at 92% 26%, rgba(37,99,235,0.20), transparent 62%)",
        }} />

      {/* Constellation network + rising motes (SVG full-bleed, slice agar lingkaran tetap bulat) */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 w-full h-full"
        viewBox="0 0 500 760" preserveAspectRatio="xMidYMid slice"
        style={{
          maskImage: "radial-gradient(ellipse 100% 90% at 50% 40%, black 30%, transparent 92%)",
          WebkitMaskImage: "radial-gradient(ellipse 100% 90% at 50% 40%, black 30%, transparent 92%)",
        }}>
        {/* Links berkelip */}
        {LINKS.map(([a, b], i) => (
          <motion.line key={`l-${i}`}
            x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y}
            stroke={lineColor} strokeWidth={1}
            initial={{ opacity: 0.08 }}
            animate={{ opacity: [0.06, 0.3, 0.06] }}
            transition={{ duration: 4 + (i % 5), repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
          />
        ))}
        {/* Nodes berdenyut */}
        {NODES.map((n, i) => (
          <motion.circle key={`n-${i}`} cx={n.x} cy={n.y} fill={nodeColor}
            initial={{ opacity: 0.3, r: n.r }}
            animate={{ opacity: [0.35, 0.95, 0.35], r: [n.r, n.r + 1.2, n.r] }}
            transition={{ duration: 3 + (i % 4), repeat: Infinity, ease: "easeInOut", delay: i * 0.2 }}
          />
        ))}
        {/* Mote cahaya naik */}
        {MOTES.map((m, i) => (
          <motion.circle key={`m-${i}`} cx={m.x} r={m.r} fill={moteColor}
            initial={{ cy: 800, opacity: 0 }}
            animate={{ cy: [800, -40], opacity: [0, 0.8, 0.8, 0] }}
            transition={{ duration: m.dur, repeat: Infinity, ease: "linear", delay: m.delay }}
          />
        ))}
      </svg>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[1.05fr_0.95fr]">
        {/* Brand panel */}
        <div className={`relative hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r ${isLight ? "border-slate-200/70" : "border-white/5"}`}>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex items-center gap-3.5">
            <div className={`rounded-2xl overflow-hidden ring-1 ${isLight ? "shadow-md shadow-slate-300/40 ring-slate-200" : "shadow-lg shadow-black/30 ring-white/10"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/agronow-icon.png" alt="Agronow Insight" className="h-12 w-12 object-cover" />
            </div>
            <div>
              <p className="text-base font-bold tracking-tight">Agronow Insight</p>
              <p className={`text-[11px] -mt-0.5 ${isLight ? "text-slate-500" : "text-slate-400"}`}>Platform Pembelajaran & Pengembangan SDM</p>
            </div>
          </motion.div>

          <div className="max-w-md">
            <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}
              className="text-4xl xl:text-5xl font-bold leading-[1.1] tracking-tight">
              <span className={`bg-gradient-to-r bg-clip-text text-transparent ${isLight ? "from-slate-900 via-slate-800 to-slate-500" : "from-white via-slate-100 to-slate-400"}`}>Kembangkan</span>
              <br />
              <span className={`bg-gradient-to-r bg-clip-text text-transparent ${isLight ? "from-emerald-600 via-teal-600 to-blue-600" : "from-emerald-300 via-teal-200 to-blue-300"}`}>kompetensi tim Anda</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.12 }}
              className={`mt-4 text-sm leading-relaxed ${isLight ? "text-slate-600" : "text-slate-400"}`}>
              Dari katalog training hingga sertifikasi — rencanakan, jadwalkan, dan pantau pengembangan SDM dalam satu platform.
            </motion.p>

            <div className="mt-9 space-y-3">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <motion.div key={f.title}
                    initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.2 + i * 0.08 }}
                    className={`flex items-start gap-3.5 rounded-2xl border backdrop-blur-sm p-3.5 transition-colors ${
                      isLight ? "border-slate-200/70 bg-white/70 hover:bg-white shadow-sm shadow-slate-200/40" : "border-white/[0.07] bg-white/[0.025] hover:bg-white/[0.05]"
                    }`}>
                    <div className={`w-9 h-9 rounded-xl bg-gradient-to-br border flex items-center justify-center shrink-0 ${isLight ? "from-emerald-500/15 to-blue-500/15 border-slate-200" : "from-emerald-500/20 to-blue-500/20 border-white/10"}`}>
                      <Icon className={`w-4 h-4 ${isLight ? "text-emerald-600" : "text-emerald-300"}`} />
                    </div>
                    <div>
                      <p className={`text-[13px] font-semibold ${isLight ? "text-slate-900" : "text-slate-100"}`}>{f.title}</p>
                      <p className={`text-[11px] mt-0.5 leading-snug ${isLight ? "text-slate-500" : "text-slate-400"}`}>{f.desc}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}
            className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-500"}`}>
            Learning & Development — Agronow Insight
          </motion.p>
        </div>

        {/* Form panel */}
        <div className="flex items-center justify-center px-5 py-10 sm:px-8">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }} className="w-full max-w-[380px]">
            <div className="lg:hidden flex flex-col items-center mb-8">
              <div className={`rounded-2xl overflow-hidden mb-3 ${isLight ? "shadow-md shadow-slate-300/40 ring-1 ring-slate-200" : "shadow-lg shadow-black/40"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/agronow-icon.png" alt="Agronow Insight" className="h-14 w-14 object-cover" />
              </div>
              <p className="text-lg font-bold">Agronow Insight</p>
              <p className={`text-[11px] ${isLight ? "text-slate-500" : "text-slate-400"}`}>Learning & Development Platform</p>
            </div>

            <div className="relative">
              <div aria-hidden className={`absolute -inset-[1px] rounded-3xl bg-gradient-to-br opacity-60 blur-[6px] ${isLight ? "from-emerald-400/30 via-blue-400/20 to-teal-400/30" : "from-emerald-500/40 via-blue-500/30 to-teal-500/40"}`} />
              <div className={`relative rounded-3xl border backdrop-blur-2xl p-7 ${
                isLight ? "border-slate-200/80 bg-white/85 shadow-[0_20px_70px_-20px_rgba(15,23,42,0.18)]" : "border-white/10 bg-[#0a1020]/80 shadow-[0_20px_70px_-20px_rgba(0,0,0,0.8)]"
              }`}>
                <div className="mb-6">
                  <h2 className="text-xl font-bold tracking-tight">Selamat datang 👋</h2>
                  <p className={`text-[12px] mt-1 ${isLight ? "text-slate-500" : "text-slate-400"}`}>Masuk untuk mengelola program L&amp;D.</p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                  {error && (
                    <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                      className={`flex items-start gap-2 p-3 rounded-xl text-[12px] border ${isLight ? "bg-red-50 border-red-200 text-red-700" : "bg-red-500/10 border-red-500/25 text-red-300"}`}>
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
                    </motion.div>
                  )}

                  <div>
                    <label className={`text-[11px] font-medium mb-1.5 block ${isLight ? "text-slate-600" : "text-slate-400"}`}>Username</label>
                    <div className="group relative">
                      <UserIcon className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isLight ? "text-slate-400 group-focus-within:text-emerald-600" : "text-slate-500 group-focus-within:text-emerald-400"}`} />
                      <input value={username} onChange={e => setUsername(e.target.value)} autoFocus autoComplete="username"
                        className={`w-full rounded-xl border pl-10 pr-3 py-3 text-sm outline-none transition-all ${
                          isLight ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15" : "border-white/10 bg-white/[0.03] text-white placeholder:text-slate-600 focus:border-emerald-400/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-emerald-500/20"
                        }`} placeholder="username" />
                    </div>
                  </div>

                  <div>
                    <label className={`text-[11px] font-medium mb-1.5 block ${isLight ? "text-slate-600" : "text-slate-400"}`}>Password</label>
                    <div className="group relative">
                      <Lock className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${isLight ? "text-slate-400 group-focus-within:text-emerald-600" : "text-slate-500 group-focus-within:text-emerald-400"}`} />
                      <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password"
                        className={`w-full rounded-xl border pl-10 pr-10 py-3 text-sm outline-none transition-all ${
                          isLight ? "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-emerald-500/60 focus:ring-2 focus:ring-emerald-500/15" : "border-white/10 bg-white/[0.03] text-white placeholder:text-slate-600 focus:border-emerald-400/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-emerald-500/20"
                        }`} placeholder="••••••••" />
                      <button type="button" onClick={() => setShowPw(v => !v)} tabIndex={-1}
                        className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${isLight ? "text-slate-400 hover:text-slate-700" : "text-slate-500 hover:text-slate-300"}`}>
                        {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={loading || !username || !password}
                    className={`group relative w-full overflow-hidden rounded-xl bg-gradient-to-r py-3 text-sm font-semibold text-white transition-all hover:brightness-[1.06] disabled:cursor-not-allowed ${
                      isLight ? "from-emerald-600 to-blue-700 shadow-lg shadow-blue-700/25 hover:shadow-blue-700/40 ring-1 ring-blue-700/20 disabled:opacity-70 disabled:shadow-md" : "from-emerald-500 to-blue-600 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 disabled:opacity-40 disabled:shadow-none"
                    }`}>
                    <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                    <span className="relative flex items-center justify-center gap-2">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Masuk <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" /></>}
                    </span>
                  </button>
                </form>
              </div>
            </div>

            <p className={`text-[11px] text-center mt-6 ${isLight ? "text-slate-500" : "text-slate-500"}`}>
              Akun default: <span className="font-semibold">admin / admin123</span> — ubah setelah masuk.
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
