import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16: "Proxy" menggantikan "Middleware". Pengecekan OPTIMISTIK saja
// (ada/tidaknya cookie sesi). Validasi token sebenarnya di /api/auth/me.
const SESSION_COOKIE = "agronow_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isLogin = pathname === "/login";

  if (!hasSession && !isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (hasSession && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
};
