import { getSessionUser, getToken, clearSessionCookie } from "@/lib/authServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      // Cookie sesi basi/invalid: hapus agar proxy berhenti memantulkan /login → /
      // dan client bisa mencapai /login.
      if (await getToken()) await clearSessionCookie();
      return Response.json({ error: "Belum login." }, { status: 401 });
    }
    return Response.json({ user });
  } catch (err) {
    console.error("me error", err);
    return Response.json({ error: "Gagal terhubung ke database." }, { status: 500 });
  }
}
