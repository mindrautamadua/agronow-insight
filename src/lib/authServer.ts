/**
 * Helper autentikasi sisi-server (Route Handlers) berbasis MySQL.
 *
 * Tabel: `app_users` (username, password_hash bcrypt, role) & `app_sessions`
 * (token acak, user_id, expires_at). Tidak ada Supabase/RPC — query langsung
 * ke MySQL lewat `@/lib/db`. Cookie sesi httpOnly: `agronow_session`.
 */
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { query, queryOne, execute } from "./db";
import type { Role } from "./roles";

export const SESSION_COOKIE = "agronow_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 hari

export type { Role };
export interface AuthUser { id: string; username: string; nama: string | null; role: Role }

interface UserRow {
  id: number;
  username: string;
  nama: string | null;
  role: Role;
  password_hash: string;
}

function toAuthUser(r: { id: number; username: string; nama: string | null; role: Role }): AuthUser {
  return { id: String(r.id), username: r.username, nama: r.nama, role: r.role };
}

// ── Fallback hardcoded (sementara) ───────────────────────────────────────────
// Memungkinkan login admin/admin123 TANPA MySQL. Hapus blok ini setelah DB siap.
const HARDCODED_USERNAME = "admin";
const HARDCODED_PASSWORD = "admin123";
const HARDCODED_TOKEN = "agronow-dev-hardcoded-admin-session";
const HARDCODED_USER: AuthUser = { id: "0", username: "admin", nama: "Administrator L&D", role: "super_admin" };

// ── Cookie helpers ──────────────────────────────────────────────────────────
export async function getToken(): Promise<string | null> {
  const c = await cookies();
  return c.get(SESSION_COOKIE)?.value ?? null;
}

export async function setSessionCookie(token: string) {
  const c = await cookies();
  c.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const c = await cookies();
  c.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

// ── Auth core ───────────────────────────────────────────────────────────────
/** Validasi username+password, buat sesi baru, kembalikan token + user. */
export async function login(username: string, password: string): Promise<{ token: string; user: AuthUser } | null> {
  // Fallback hardcoded — bekerja tanpa MySQL.
  if (username === HARDCODED_USERNAME && password === HARDCODED_PASSWORD) {
    return { token: HARDCODED_TOKEN, user: HARDCODED_USER };
  }
  const u = await queryOne<UserRow>(
    "SELECT id, username, nama, role, password_hash FROM app_users WHERE username = ? LIMIT 1",
    [username],
  );
  if (!u) return null;
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) return null;

  const token = randomBytes(32).toString("hex");
  await execute(
    "INSERT INTO app_sessions (token, user_id, expires_at) VALUES (?, ?, NOW() + INTERVAL '7 days')",
    [token, u.id],
  );
  return { token, user: toAuthUser(u) };
}

/** User aktif berdasarkan token sesi (cek expiry), atau null. */
export async function getSessionUser(): Promise<AuthUser | null> {
  const token = await getToken();
  if (!token) return null;
  // Fallback hardcoded — kenali sesi admin tanpa MySQL.
  if (token === HARDCODED_TOKEN) return HARDCODED_USER;
  const r = await queryOne<{ id: number; username: string; nama: string | null; role: Role }>(
    `SELECT u.id, u.username, u.nama, u.role
       FROM app_sessions s
       JOIN app_users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > NOW()
      LIMIT 1`,
    [token],
  );
  return r ? toAuthUser(r) : null;
}

export async function logout(token: string) {
  if (token === HARDCODED_TOKEN) return; // sesi hardcoded: tak ada di DB
  await execute("DELETE FROM app_sessions WHERE token = ?", [token]);
}

// ── User management (admin) ──────────────────────────────────────────────────
export async function listUsers(): Promise<(AuthUser & { created_at: string })[]> {
  const rows = await query<{ id: number; username: string; nama: string | null; role: Role; created_at: string }>(
    "SELECT id, username, nama, role, created_at FROM app_users ORDER BY created_at ASC",
  );
  return rows.map(r => ({ ...toAuthUser(r), created_at: r.created_at }));
}

export async function createUser(username: string, password: string, nama: string, role: Role): Promise<{ ok: boolean; error?: string; id?: string }> {
  const existing = await queryOne<{ id: number }>("SELECT id FROM app_users WHERE username = ? LIMIT 1", [username]);
  if (existing) return { ok: false, error: "Username sudah dipakai." };
  const hash = await bcrypt.hash(password, 10);
  const res = await execute(
    "INSERT INTO app_users (username, nama, role, password_hash) VALUES (?, ?, ?, ?) RETURNING id",
    [username, nama || null, role, hash],
  );
  return { ok: true, id: String(res.insertId) };
}
