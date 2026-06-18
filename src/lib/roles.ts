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
