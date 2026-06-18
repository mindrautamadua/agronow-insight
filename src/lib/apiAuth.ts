/**
 * Guard untuk Route Handlers domain.
 * - requireUser: harus login (admin/viewer) — untuk read.
 * - requireAdmin: harus admin — untuk write (create/update/delete).
 *
 * Mengembalikan { user } bila lolos, atau { response } berisi Response error
 * yang harus langsung di-return oleh handler.
 */
import { getSessionUser, type AuthUser } from "./authServer";
import { isAdminRole } from "./roles";

export async function requireUser(): Promise<{ user: AuthUser } | { response: Response }> {
  const user = await getSessionUser();
  if (!user) return { response: Response.json({ error: "Belum login." }, { status: 401 }) };
  return { user };
}

export async function requireAdmin(): Promise<{ user: AuthUser } | { response: Response }> {
  const user = await getSessionUser();
  if (!user) return { response: Response.json({ error: "Belum login." }, { status: 401 }) };
  if (!isAdminRole(user.role)) return { response: Response.json({ error: "Khusus Administrator." }, { status: 403 }) };
  return { user };
}
