"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminRole, type Role } from "@/lib/roles";

export type { Role };
export interface AuthUser { id: string; username: string; nama: string | null; role: Role; scope: string | null }

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  /** True setelah /api/auth/me selesai (berhasil atau gagal) — sebelum itu jangan ambil keputusan otorisasi. */
  ready: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({ user: null, isAdmin: false, ready: false, logout: async () => {} });

/**
 * Validasi sesi via /api/auth/me. Render OPTIMISTIK: konten langsung tampil
 * (proxy.ts sudah memantulkan request tanpa cookie ke /login), validasi berjalan
 * di latar belakang. Hanya bila sesi benar-benar invalid → redirect ke /login.
 * Tidak ada gerbang spinner full-screen, sehingga tidak ada flash/flicker saat
 * SSR → hydrate → fetch pada setiap hard load.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let canceled = false;
    fetch("/api/auth/me")
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (canceled) return;
        if (d?.user) { setUser(d.user as AuthUser); setReady(true); }
        else { setReady(true); router.replace("/login"); }
      })
      .catch(() => { if (!canceled) { setReady(true); router.replace("/login"); } });
    return () => { canceled = true; };
  }, [router]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    setUser(null);
    router.replace("/login");
  }, [router]);

  return <AuthContext.Provider value={{ user, isAdmin: isAdminRole(user?.role), ready, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** True bila user adalah admin (L&D officer). Viewer = read-only. */
export function useIsAdmin() {
  return useContext(AuthContext).isAdmin;
}

/** Bungkus kontrol TULIS (create/save/upload) — hanya dirender untuk admin. */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  return useContext(AuthContext).isAdmin ? <>{children}</> : null;
}
