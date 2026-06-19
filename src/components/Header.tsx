"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, ChevronDown, Sun, Moon, LogOut, Users } from "lucide-react";
import { useTheme } from "./ThemeContext";
import { useAuth } from "./AuthContext";
import { isAdminRole, roleLabel as fmtRole } from "@/lib/roles";

const PAGE_TITLES: Record<string, { title: string; desc: string }> = {
  "/":               { title: "Dashboard",        desc: "Ringkasan program Learning & Development" },
  "/eksternal":      { title: "Penggunaan Eksternal", desc: "Pemakaian Agronow oleh pihak di luar PTPN Group" },
  "/courses":        { title: "Katalog Training", desc: "Daftar program & kursus pelatihan" },
  "/enrollments":    { title: "Enrollment",       desc: "Pendaftaran peserta & progres pelatihan" },
  "/calendar":       { title: "Kalender Training", desc: "Jadwal program pelatihan mendatang & terlaksana" },
  "/wallet":         { title: "Learning Wallet",  desc: "Pengajuan & anggaran pelatihan eksternal per entitas" },
  "/serapan":        { title: "Serapan Anggaran", desc: "Realisasi vs target anggaran & JPL Learning Wallet" },
  "/km":             { title: "Knowledge Management", desc: "Konten pembelajaran & portal pengetahuan — produksi & engagement" },
  "/evaluasi":       { title: "Evaluasi & Kepuasan", desc: "Skor kepuasan pelatihan (NPS) per narasumber & program" },
  "/project-assignment": { title: "Project Assignment", desc: "Penugasan proyek pasca-pelatihan (on-the-job / 70%)" },
  "/efektivitas":    { title: "Efektivitas Pelatihan", desc: "Kenaikan nilai pre→post (Kirkpatrick Level 3)" },
  "/wishlist":       { title: "Demand & Wishlist", desc: "Pelatihan paling diinginkan karyawan — sinyal perencanaan" },
  "/presensi":       { title: "Kehadiran / Presensi", desc: "Tingkat kehadiran peserta per kelas (hadir vs terdaftar)" },
  "/employees":      { title: "Peserta",          desc: "Karyawan PTPN Group yang mengikuti program L&D" },
  "/cari-jpl":       { title: "Cari JPL Karyawan", desc: "Total jam pelajaran (JPL) per karyawan by NIK atau nama" },
  "/idp-verifikasi": { title: "Verifikasi IDP",    desc: "Tinjau & setujui/tolak pengajuan IDP karyawan" },
  "/certifications": { title: "Sertifikasi",      desc: "Sertifikat peserta pelatihan" },
  "/master-data":    { title: "Manajemen Master Data", desc: "Entitas, Regional & Unit Kerja korporat — sumber IHCMIS-DEV (read-only)" },
  "/schema":         { title: "Skema Database",   desc: "Hubungan antar tabel (ERD) — introspeksi langsung dari Supabase Postgres" },
  "/photos":         { title: "Sync Foto Karyawan", desc: "Tarik foto karyawan dari IHCMIS ke aplikasi (cocok via NIP)" },
  "/users":          { title: "Manajemen User",   desc: "Kelola akun login & hak akses aplikasi" },
  "/settings":       { title: "Settings",         desc: "Konfigurasi sistem & preferensi" },
};

export function Header() {
  const pathname = usePathname();
  const page = PAGE_TITLES[pathname] ?? { title: "Agronow L&D", desc: "" };
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  const displayName = user?.nama || user?.username || "—";
  const roleLabel = fmtRole(user?.role);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-16 flex items-center justify-between px-6 gap-4
                       bg-[var(--bg-card)]
                       border-b border-[var(--border)] sticky top-0 z-20">
      <div className="flex-1 min-w-0">
        <h1 className="text-sm font-semibold text-[var(--foreground)] leading-tight">{page.title}</h1>
        {page.desc && <p className="text-[11px] text-[var(--muted)] mt-0.5 truncate">{page.desc}</p>}
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="p-2 text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card2)] rounded-lg transition-all"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <div ref={userRef} className="relative pl-3 ml-1 border-l border-[var(--border)]">
          <button
            onClick={() => setUserOpen(v => !v)}
            className="flex items-center gap-2.5 cursor-pointer hover:bg-[var(--bg-card2)] p-2 rounded-lg transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-blue-600
                            flex items-center justify-center shrink-0 text-white text-xs font-semibold uppercase">
              {displayName !== "—" ? displayName.charAt(0) : <User className="w-3.5 h-3.5" />}
            </div>
            <div className="hidden md:block text-left max-w-[140px]">
              <p className="text-xs font-semibold text-[var(--foreground)] leading-tight truncate">{displayName}</p>
              <p className="text-[10px] text-[var(--muted)]">{roleLabel}</p>
            </div>
            <ChevronDown className="w-3 h-3 text-[var(--muted)] hidden md:block" />
          </button>

          {userOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-[var(--bg-card-solid)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--border)]">
                <p className="text-xs font-semibold text-[var(--foreground)] truncate">{displayName}</p>
                <p className="text-[10px] text-[var(--muted)] truncate">@{user?.username ?? "—"} · {roleLabel}</p>
              </div>
              <div className="p-1.5">
                {isAdminRole(user?.role) && (
                  <Link
                    href="/users"
                    onClick={() => setUserOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] text-[var(--muted)] hover:bg-[var(--bg-card2)] hover:text-[var(--foreground)] transition-colors"
                  >
                    <Users className="w-3.5 h-3.5" /> Manajemen User
                  </Link>
                )}
                <button
                  onClick={() => { setUserOpen(false); logout(); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" /> Keluar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
