import { getSessionUser, listUsers, createUser } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/auth/users — daftar user (admin)
export async function GET() {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "Belum login." }, { status: 401 });
  if (me.role !== "admin") return Response.json({ error: "Tidak berwenang." }, { status: 403 });
  const users = await listUsers();
  return Response.json({ users });
}

// POST /api/auth/users — buat user baru (admin)
export async function POST(request: Request) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "Belum login." }, { status: 401 });
  if (me.role !== "admin") return Response.json({ error: "Tidak berwenang." }, { status: 403 });

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
  const res = await createUser(
    username,
    password,
    b.nama == null ? "" : String(b.nama),
    b.role === "viewer" ? "viewer" : "admin",
  );
  if (!res.ok) return Response.json({ error: res.error ?? "Gagal membuat user." }, { status: 400 });
  return Response.json({ ok: true, id: res.id });
}
