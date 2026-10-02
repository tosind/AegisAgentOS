import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "./lib/auth-helpers";

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/api/auth/login") return NextResponse.next();
  const token = request.cookies.get("session")?.value;
  if (!token || !verifySessionToken(token)) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && new URL(origin).origin !== request.nextUrl.origin)) {
      return NextResponse.json({ error: "Cross-origin requests are forbidden" }, { status: 403 });
    }
  }
  return NextResponse.next();
}
export const config = { matcher: ["/api/:path*"] };
