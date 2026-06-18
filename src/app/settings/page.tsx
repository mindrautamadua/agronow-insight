"use client";

import { Database, Palette, Info, Sun, Moon } from "lucide-react";
import { useTheme } from "@/components/ThemeContext";
import { useAuth } from "@/components/AuthContext";
import { roleLabel } from "@/lib/roles";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const { user } = useAuth();

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Tampilan */}
      <Card icon={Palette} title="Tampilan" desc="Preferensi tema antarmuka.">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--foreground)]">Mode {theme === "dark" ? "Gelap" : "Terang"}</p>
            <p className="text-[11px] text-[var(--muted)]">Beralih antara tema terang dan gelap.</p>
          </div>
          <button onClick={toggleTheme}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card2)] text-sm text-[var(--foreground)] hover:border-[var(--border-md)] transition-colors">
            {theme === "dark" ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-blue-400" />}
            {theme === "dark" ? "Terang" : "Gelap"}
          </button>
        </div>
      </Card>

      {/* Akun */}
      <Card icon={Info} title="Akun Aktif" desc="Informasi sesi yang sedang login.">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Row label="Nama" value={user?.nama || "—"} />
          <Row label="Username" value={`@${user?.username ?? "—"}`} />
          <Row label="Role" value={roleLabel(user?.role)} />
        </div>
      </Card>

      {/* Database */}
      <Card icon={Database} title="Database" desc="Penyimpanan data aplikasi.">
        <div className="space-y-2 text-sm">
          <Row label="Engine" value="MySQL" inline />
          <Row label="Konfigurasi" value=".env.local (MYSQL_*)" inline />
          <Row label="Setup / seed" value="npm run db:setup" inline />
        </div>
        <p className="text-[11px] text-[var(--muted)] mt-3 leading-relaxed">
          Skema tabel ada di <code className="px-1 py-0.5 rounded bg-[var(--bg-card2)] text-[var(--foreground)]">db/schema.sql</code>.
          Jalankan <code className="px-1 py-0.5 rounded bg-[var(--bg-card2)] text-[var(--foreground)]">npm run db:setup</code> untuk membuat tabel & mengisi data contoh.
        </p>
      </Card>
    </div>
  );
}

function Card({ icon: Icon, title, desc, children }: { icon: React.ElementType; title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <Icon className="w-4 h-4 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-[var(--foreground)]">{title}</h3>
          <p className="text-[11px] text-[var(--muted)]">{desc}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value, inline }: { label: string; value: string; inline?: boolean }) {
  if (inline) {
    return (
      <div className="flex items-center justify-between">
        <span className="text-[var(--muted)]">{label}</span>
        <span className="text-[var(--foreground)] font-medium">{value}</span>
      </div>
    );
  }
  return (
    <div>
      <p className="text-[11px] text-[var(--muted)]">{label}</p>
      <p className="text-[var(--foreground)] font-medium">{value}</p>
    </div>
  );
}
