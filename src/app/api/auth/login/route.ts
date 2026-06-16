import { login, setSessionCookie } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Body tidak valid." }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!username || !password) {
    return Response.json({ error: "Username & password wajib diisi." }, { status: 400 });
  }

  try {
    const res = await login(username, password);
    if (!res) {
      return Response.json({ error: "Username atau password salah." }, { status: 401 });
    }
    await setSessionCookie(res.token);
    return Response.json({ user: res.user });
  } catch (err) {
    console.error("login error", err);
    return Response.json({ error: "Gagal terhubung ke database." }, { status: 500 });
  }
}
