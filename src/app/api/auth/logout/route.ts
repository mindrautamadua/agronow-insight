import { getToken, clearSessionCookie, logout } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const token = await getToken();
  if (token) await logout(token).catch(() => {});
  await clearSessionCookie();
  return Response.json({ ok: true });
}
