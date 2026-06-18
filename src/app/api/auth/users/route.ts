import { getSessionUser, listUsers, createUser } from "@/lib/authServer";
import { isAdminRole, parseRole, needsScope, canManageUser } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/auth/users — daftar user (admin). Admin bercakupan hanya melihat
// user di dalam wewenangnya (anper/regional miliknya).
export async function GET() {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "Belum login." }, { status: 401 });
  if (!isAdminRole(me.role)) return Response.json({ error: "Tidak berwenang." }, { status: 403 });
  const all = await listUsers();
  const users = all.filter(u => canManageUser(me, u.role, u.scope) || String(u.id) === String(me.id));
  return Response.json({ users });
}

// POST /api/auth/users — buat user baru (admin)
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "Belum login." }, { status: 401 });
  if (!isAdminRole(me.role)) return Response.json({ error: "Tidak berwenang." }, { status: 403 });

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return Response.json({ error: "Body tidak valid." }, { status: 400 });
  }
  const username = String(b.username ?? "").trim();
  const password = String(b.password ?? "");
  if (!username || !password) {
    return Response.json({ error: "Username & password wajib diisi." }, { status: 400 });
  }
  const role = parseRole(b.role);
  if (!role) return Response.json({ error: "Role tidak valid." }, { status: 400 });
  // Scope wajib untuk peran anper/regional, diabaikan (NULL) untuk holding/global.
  const scope = needsScope(role) ? String(b.scope ?? "").trim() : "";
  if (needsScope(role) && !scope) {
    return Response.json({ error: "Cakupan (scope) wajib diisi untuk peran ini." }, { status: 400 });
  }
  // Cegah eskalasi: admin hanya boleh membuat user di dalam wewenang & cakupannya.
  if (!canManageUser(me, role, scope || null)) {
    return Response.json({ error: "Tidak berwenang membuat user dengan peran/cakupan tersebut." }, { status: 403 });
  }
  const res = await createUser(
    username,
    password,
    b.nama == null ? "" : String(b.nama),
    role,
    scope || null,
  );
  if (!res.ok) return Response.json({ error: res.error ?? "Gagal membuat user." }, { status: 400 });
  return Response.json({ ok: true, id: res.id });
}
