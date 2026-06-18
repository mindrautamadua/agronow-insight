/**
 * Pembatas cakupan (scope) data per-user untuk query Postgres.
 *
 * Setiap user punya `scope` (lihat `app_users.scope`):
 *  - super_admin / *_holding / scope kosong → tanpa batas (lihat semua).
 *  - *_anper    → dibatasi 1 anak perusahaan; cocok bila `group_name` = scope
 *                 ATAU diawali "scope - " (mis. "PTPN IV - Regional 2").
 *  - *_regional → dibatasi 1 group penuh; cocok bila `group_name` = scope.
 *
 * Pola ini menyamai filter entitas/sub-entitas yang sudah dipakai endpoint
 * (lihat employees/route.ts). Placeholder pakai gaya `?` (di-convert oleh db.ts).
 */
import type { AuthUser } from "./authServer";
import { scopeLevel } from "./roles";
import { query } from "./db";

export interface ScopeFilter { sql: string; params: unknown[] }

/**
 * Bangun fragmen WHERE pembatas cakupan terhadap ekspresi kolom group_name
 * (mis. "g.group_name"). Kembalikan { sql: "", params: [] } bila user tak dibatasi.
 */
export function scopeWhere(user: Pick<AuthUser, "role" | "scope">, groupNameCol: string): ScopeFilter {
  const lvl = scopeLevel(user.role);
  const scope = (user.scope ?? "").trim();
  if (lvl === "global" || lvl === "holding" || !scope) return { sql: "", params: [] };
  if (lvl === "regional") return { sql: `${groupNameCol} = ?`, params: [scope] };
  // anper: group induk persis, atau sub-entitas di bawahnya.
  return { sql: `(${groupNameCol} = ? OR ${groupNameCol} ILIKE ?)`, params: [scope, `${scope} - %`] };
}

/** True bila user dibatasi cakupannya (perlu memfilter data). */
export function isScoped(user: Pick<AuthUser, "role" | "scope">): boolean {
  const lvl = scopeLevel(user.role);
  return (lvl === "anper" || lvl === "regional") && !!(user.scope ?? "").trim();
}

/**
 * Daftar `group_id` yang boleh diakses user — untuk endpoint yang memfilter
 * lewat id_group (numerik), bukan group_name. Kembalikan `null` bila user tak
 * dibatasi (lihat semua); array kosong bila scope tak cocok group manapun.
 */
export async function scopeGroupIds(user: Pick<AuthUser, "role" | "scope">): Promise<number[] | null> {
  const f = scopeWhere(user, "group_name");
  if (!f.sql) return null;
  const rows = await query<{ group_id: number }>(`SELECT group_id FROM _group WHERE ${f.sql}`, f.params);
  return rows.map(r => Number(r.group_id));
}
