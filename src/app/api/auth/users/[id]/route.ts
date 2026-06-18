import { getSessionUser, updateUser, setUserActive } from "@/lib/authServer";
import { isAdminRole, parseRole, needsScope } from "@/lib/roles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/auth/users/[id] — perbarui user (admin)
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "Belum login." }, { status: 401 });
  if (!isAdminRole(me.role)) return Response.json({ error: "Tidak berwenang." }, { status: 403 });

  const { id } = await params;
  // Admin bawaan (hardcoded) tidak tersimpan di DB, tak bisa diedit.
  if (id === "0") return Response.json({ error: "User bawaan tidak dapat diubah." }, { status: 400 });

  let b: Record<string, unknown>;
  try {
    b = await request.json();
  } catch {
    return Response.json({ error: "Body tidak valid." }, { status: 400 });
  }

  // Toggle aktif/nonaktif — aksi terpisah dari edit profil.
  if (typeof b.active === "boolean") {
    if (!b.active && String(me.id) === id) {
      return Response.json({ error: "Tidak dapat menonaktifkan akun sendiri." }, { status: 400 });
    }
    const res = await setUserActive(id, b.active);
    if (!res.ok) return Response.json({ error: res.error ?? "Gagal mengubah status user." }, { status: 400 });
    return Response.json({ ok: true });
  }

  const role = parseRole(b.role);
  if (!role) return Response.json({ error: "Role tidak valid." }, { status: 400 });
  // Scope wajib untuk peran anper/regional, diabaikan (NULL) untuk holding/global.
  const scope = needsScope(role) ? String(b.scope ?? "").trim() : "";
  if (needsScope(role) && !scope) {
    return Response.json({ error: "Cakupan (scope) wajib diisi untuk peran ini." }, { status: 400 });
  }
  const password = b.password == null ? "" : String(b.password);

  const res = await updateUser(id, {
    nama: b.nama == null ? "" : String(b.nama),
    role,
    scope: scope || null,
    password: password || undefined,
  });
  if (!res.ok) return Response.json({ error: res.error ?? "Gagal memperbarui user." }, { status: 400 });
  return Response.json({ ok: true });
}
