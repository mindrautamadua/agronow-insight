/**
 * Definisi peran (role) terpusat — dipakai sisi server & client (tanpa import server-only).
 *
 * Tujuh jenis user, dua tingkat hak akses:
 *  - TULIS (admin): super_admin, admin_holding, admin_anper, admin_regional
 *  - BACA  (viewer): viewer_holding, viewer_anper, viewer_regional
 *
 * Cakupan organisasi (holding / anper = anak perusahaan / regional) tersimpan pada nama
 * peran; pemfilteran data per-cakupan dapat ditambahkan kemudian via helper di sini.
 */
export type Role =
  | "super_admin"
  | "admin_holding"
  | "admin_anper"
  | "admin_regional"
  | "viewer_holding"
  | "viewer_anper"
  | "viewer_regional";

export const ROLES: Role[] = [
  "super_admin",
  "admin_holding",
  "admin_anper",
  "admin_regional",
  "viewer_holding",
  "viewer_anper",
  "viewer_regional",
];

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  admin_holding: "Admin Holding",
  admin_anper: "Admin Anak Perusahaan",
  admin_regional: "Admin Regional",
  viewer_holding: "Viewer Holding",
  viewer_anper: "Viewer Anak Perusahaan",
  viewer_regional: "Viewer Regional",
};

/** Label tampilan untuk sebuah peran (fallback ke nilai mentah bila tak dikenal). */
export function roleLabel(role: Role | string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role as Role] ?? role;
}

/** True bila peran punya hak TULIS (super_admin atau salah satu admin_*). */
export function isAdminRole(role: Role | string | null | undefined): boolean {
  return role === "super_admin" || (typeof role === "string" && role.startsWith("admin_"));
}

/** Validasi & normalisasi nilai peran dari input luar; null bila tak valid. */
export function parseRole(value: unknown): Role | null {
  return typeof value === "string" && (ROLES as string[]).includes(value) ? (value as Role) : null;
}

/**
 * Tingkat cakupan organisasi sebuah peran:
 *  - "global"   → super_admin (lihat semua)
 *  - "holding"  → admin_holding / viewer_holding (lihat semua, level holding)
 *  - "anper"    → admin_anper / viewer_anper (dibatasi 1 anak perusahaan)
 *  - "regional" → admin_regional / viewer_regional (dibatasi 1 regional)
 */
export function scopeLevel(role: Role | string | null | undefined): "global" | "holding" | "anper" | "regional" {
  if (role === "super_admin") return "global";
  if (typeof role === "string" && role.endsWith("_anper")) return "anper";
  if (typeof role === "string" && role.endsWith("_regional")) return "regional";
  return "holding";
}

/** True bila peran perlu nilai `scope` (anper/regional), bukan holding/global. */
export function needsScope(role: Role | string | null | undefined): boolean {
  const lvl = scopeLevel(role);
  return lvl === "anper" || lvl === "regional";
}

/** Label tampilan untuk tingkat cakupan sebuah peran. */
export function scopeLevelLabel(role: Role | string | null | undefined): string {
  return { global: "Semua", holding: "Holding", anper: "Anak Perusahaan", regional: "Regional" }[scopeLevel(role)];
}

// ── Otoritas manajemen user & operasi tulis ──────────────────────────────────
/**
 * Keluasan wewenang sebuah peran (makin besar makin luas):
 * global(3) > holding(2) > anper(1) > regional(0). Dipakai untuk membatasi
 * peran apa yang boleh diberikan & user mana yang boleh dikelola seorang admin.
 */
export function roleBreadth(role: Role | string | null | undefined): number {
  return { global: 3, holding: 2, anper: 1, regional: 0 }[scopeLevel(role)];
}

/**
 * Bolehkah `managerRole` memberikan/menetapkan `targetRole`?
 *  - super_admin: bebas (termasuk membuat super_admin lain).
 *  - selain itu: hanya peran dengan keluasan ≤ keluasannya, dan tak boleh super_admin.
 */
export function canAssignRole(managerRole: Role | string, targetRole: Role | string): boolean {
  if (targetRole === "super_admin") return managerRole === "super_admin";
  return roleBreadth(targetRole) <= roleBreadth(managerRole);
}

/**
 * Apakah cakupan `targetScope` berada DI DALAM wewenang seorang manajer
 * (managerRole + managerScope)?
 *  - global/holding: mencakup semua (true).
 *  - anper (scope X): target = X, atau regional di bawahnya ("X - …").
 *  - regional (scope Y): hanya target = Y.
 * Manajer bercakupan tanpa scope, atau target tanpa scope, → false.
 */
export function scopeContains(
  managerRole: Role | string,
  managerScope: string | null | undefined,
  targetScope: string | null | undefined,
): boolean {
  const lvl = scopeLevel(managerRole);
  if (lvl === "global" || lvl === "holding") return true;
  const ms = (managerScope ?? "").trim();
  const ts = (targetScope ?? "").trim();
  if (!ms || !ts) return false;
  if (lvl === "regional") return ts === ms;
  return ts === ms || ts.startsWith(`${ms} - `); // anper
}

/**
 * Bolehkah manajer mengelola (lihat/buat/ubah) seorang user dengan peran+cakupan
 * tertentu? Gabungan: keluasan peran cocok DAN cakupan termasuk wewenang manajer.
 */
export function canManageUser(
  manager: { role: Role | string; scope: string | null },
  targetRole: Role | string,
  targetScope: string | null | undefined,
): boolean {
  if (!isAdminRole(manager.role)) return false;
  if (!canAssignRole(manager.role, targetRole)) return false;
  // Peran berskala (anper/regional) wajib cakupan yang termasuk wewenang manajer.
  if (needsScope(targetRole)) return scopeContains(manager.role, manager.scope, targetScope);
  // Peran holding/global hanya boleh dikelola admin global/holding.
  return roleBreadth(targetRole) <= roleBreadth(manager.role);
}

/** True bila admin tak dibatasi cakupan (super_admin / *_holding). */
export function isGlobalAdmin(role: Role | string | null | undefined): boolean {
  return isAdminRole(role) && roleBreadth(role) >= 2;
}
