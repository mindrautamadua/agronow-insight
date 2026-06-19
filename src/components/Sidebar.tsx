"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, GraduationCap, ClipboardList, Users, Award, CalendarDays,
  Settings, ChevronRight, ChevronLeft, ChevronDown, Database, Wallet, Star, Briefcase, TrendingUp, Sparkles, UserCheck, Image as ImageIcon, Library, Coins, ExternalLink, Clock, ClipboardCheck, Boxes,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./SidebarContext";
import { useAuth } from "./AuthContext";
import { isAdminRole } from "@/lib/roles";

// Halaman khusus Administrator — disembunyikan dari Viewer di sidebar & diblokir di level rute.
export const ADMIN_ONLY_PATHS = ["/settings", "/users", "/idp-verifikasi"];
export function isAdminOnlyPath(path: string): boolean {
  return ADMIN_ONLY_PATHS.some(p => path === p || path.startsWith(p + "/"));
}

type NavItem = { href: string; icon: LucideIcon; label: string; flag?: string };
type NavGroup = { label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/eksternal", icon: ExternalLink, label: "Penggunaan Eksternal" },
      { href: "/cari-jpl", icon: Clock, label: "Cari JPL Karyawan" },
    ],
  },
  {
    label: "Pembelajaran",
    items: [
      { href: "/courses",     icon: GraduationCap, label: "Katalog Training" },
      { href: "/enrollments", icon: ClipboardList, label: "Enrollment"       },
      { href: "/calendar",    icon: CalendarDays,  label: "Kalender Training" },
      { href: "/wallet",      icon: Wallet,        label: "Learning Wallet"   },
      { href: "/serapan",     icon: Coins,         label: "Serapan Anggaran"  },
      { href: "/evaluasi",    icon: Star,          label: "Evaluasi & Kepuasan" },
      { href: "/project-assignment", icon: Briefcase, label: "Project Assignment" },
      { href: "/efektivitas", icon: TrendingUp, label: "Efektivitas" },
      { href: "/wishlist", icon: Sparkles, label: "Demand & Wishlist" },
      { href: "/presensi", icon: UserCheck, label: "Kehadiran" },
      { href: "/km", icon: Library, label: "Knowledge Management" },
    ],
  },
  {
    label: "SDM",
    items: [
      { href: "/employees",      icon: Users, label: "Peserta" },
      { href: "/idp-verifikasi", icon: ClipboardCheck, label: "Verifikasi IDP" },
      { href: "/certifications", icon: Award, label: "Sertifikasi" },
    ],
  },
  {
    label: "Master Data",
    items: [
      { href: "/master-data", icon: Boxes, label: "Manajemen Master Data" },
    ],
  },
  {
    label: "Basis Data",
    items: [
      { href: "/schema", icon: Database, label: "Skema Database" },
      { href: "/photos", icon: ImageIcon, label: "Sync Foto" },
    ],
  },
  {
    label: "Administrasi Sistem",
    items: [
      { href: "/users",    icon: Users,    label: "Manajemen User" },
      { href: "/settings", icon: Settings, label: "Settings"       },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const { user } = useAuth();
  const isAdmin = isAdminRole(user?.role);
  const activeHref = (() => {
    let best = "";
    for (const g of NAV_GROUPS) {
      for (const it of g.items) {
        const matches = it.href === "/"
          ? pathname === "/"
          : pathname === it.href || pathname.startsWith(it.href + "/");
        if (matches && it.href.length > best.length) best = it.href;
      }
    }
    return best;
  })();
  const [expanded, setExpanded] = useState<Record<string, boolean>>(
    () => Object.fromEntries(NAV_GROUPS.map((g) => [g.label, true]))
  );

  function toggleGroup(label: string) {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  return (
    <>
    {/* Floating edge toggle */}
    <motion.button
      initial={false}
      animate={{ left: collapsed ? 60 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      onClick={toggle}
      title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="fixed top-6 z-40 -translate-x-1/2 flex items-center justify-center
                 w-6 h-6 rounded-full bg-[var(--bg-card)] border border-[var(--border-md)]
                 text-[var(--muted)] shadow-md shadow-black/20
                 hover:text-[var(--primary)] hover:border-[var(--primary)]/50 hover:bg-[var(--bg-card2)]
                 transition-colors"
    >
      {collapsed
        ? <ChevronRight className="w-3.5 h-3.5" />
        : <ChevronLeft className="w-3.5 h-3.5" />
      }
    </motion.button>
    <motion.aside
      initial={{ x: -260 }}
      animate={{ x: 0, width: collapsed ? 60 : 260 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-full flex flex-col z-30 overflow-hidden
                 bg-[var(--bg-card)] border-r border-[var(--border)]"
    >
      {/* Brand */}
      <div className={cn(
        "flex items-center border-b border-[var(--border)] shrink-0 transition-all duration-300",
        collapsed ? "justify-center px-0 py-[18px]" : "gap-3 px-5 py-[18px]"
      )}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/logo-login.png" alt="Agronow" className={cn("w-auto object-contain shrink-0", collapsed ? "h-8" : "h-9")} />
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-[var(--muted)] font-medium uppercase tracking-wider whitespace-nowrap">
              Insight
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className={cn(
        "flex-1 py-4 overflow-y-auto overflow-x-hidden space-y-4",
        collapsed ? "px-0" : "px-3"
      )}>
        {NAV_GROUPS.map(group => {
          const items = group.items.filter(it => isAdmin || !ADMIN_ONLY_PATHS.includes(it.href));
          if (items.length === 0) return null;
          return (
          <div key={group.label}>
            {!collapsed && (
              <button
                onClick={() => toggleGroup(group.label)}
                className="group/hdr flex w-full items-center justify-between px-3 mb-2"
              >
                <p className="text-[10px] font-semibold text-[var(--muted)] uppercase tracking-wider whitespace-nowrap group-hover/hdr:text-[var(--foreground)] transition-colors">
                  {group.label}
                </p>
                <ChevronDown className={cn(
                  "w-3 h-3 text-[var(--muted)] group-hover/hdr:text-[var(--foreground)] transition-transform duration-200",
                  !expanded[group.label] && "-rotate-90"
                )} />
              </button>
            )}

            {collapsed && (
              <div className="mx-auto w-6 border-t border-[var(--border)] mb-3" />
            )}

            <AnimatePresence initial={false}>
              {(collapsed || expanded[group.label]) && (
                <motion.div
                  initial={collapsed ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={collapsed ? undefined : { height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className={cn("space-y-0.5", collapsed && "flex flex-col items-center")}>
                    {items.map(({ href, icon: Icon, label, flag }) => {
                      const active = href === activeHref;
                      return (
                        <Link
                          key={href}
                          href={href}
                          title={collapsed ? (flag ? `${label} (${flag})` : label) : undefined}
                          className={cn(
                            "group flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200",
                            collapsed ? "w-10 h-10 justify-center px-0" : "px-3 py-2.5",
                            active
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--bg-card2)] border border-transparent"
                          )}
                        >
                          <span className="relative shrink-0">
                            <Icon className={cn("w-4 h-4 transition-colors",
                              active ? "text-emerald-400" : "text-[var(--muted)] group-hover:text-[var(--foreground)]")} />
                            {flag && collapsed && <span title={flag} className="absolute -top-1 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 ring-2 ring-[var(--bg-card)]" />}
                          </span>
                          {!collapsed && (
                            <>
                              <span className="flex-1 truncate">{label}</span>
                              {flag && <span className="shrink-0 text-[7px] leading-none px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold tracking-wider">{flag}</span>}
                              {active && <ChevronRight className="w-3 h-3 text-emerald-400 shrink-0" />}
                            </>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          );
        })}
      </nav>
    </motion.aside>
    </>
  );
}
