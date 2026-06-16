"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SidebarProvider, useSidebar } from "./SidebarContext";
import { ThemeProvider } from "./ThemeContext";
import { AuthProvider, useAuth } from "./AuthContext";
import { Sidebar, isAdminOnlyPath } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";

function ShellInner({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar();
  const { user, ready } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  // Viewer tidak boleh mengakses halaman khusus admin via URL langsung — alihkan ke beranda.
  // Tunggu `ready`: sebelum sesi tervalidasi, user masih null sehingga admin pun akan
  // terdeteksi "bukan admin" dan salah ter-bounce dari halaman admin.
  const blocked = ready && user?.role !== "admin" && isAdminOnlyPath(pathname);
  useEffect(() => { if (blocked) router.replace("/"); }, [blocked, router]);
  return (
    <div className="h-full flex overflow-hidden bg-[var(--background)]">
      <Sidebar />
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-[margin] duration-300 ease-in-out",
          collapsed ? "ml-[60px]" : "ml-[260px]"
        )}
      >
        <Header />
        <main className="flex-1 overflow-y-auto">
          {blocked ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-10 gap-2">
              <p className="text-sm font-semibold text-[var(--foreground)]">Akses ditolak</p>
              <p className="text-xs text-[var(--muted)]">Halaman ini khusus Administrator. Mengalihkan ke beranda…</p>
            </div>
          ) : children}
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Halaman login tampil tanpa shell (sidebar/header) & tanpa gate auth.
  if (pathname === "/login") {
    return <ThemeProvider>{children}</ThemeProvider>;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <SidebarProvider>
          <ShellInner>{children}</ShellInner>
        </SidebarProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
