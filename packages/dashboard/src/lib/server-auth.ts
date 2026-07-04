import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySessionToken, type UserSession } from "@/lib/auth-helpers";

export async function getServerSession(): Promise<UserSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  return token ? verifySessionToken(token) : null;
}

export async function requireDashboardRole(
  roles: string[],
): Promise<{ session: UserSession } | { response: NextResponse }> {
  const session = await getServerSession();
  if (!session) {
    return { response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const allowed = roles.some((role) => session.roles.includes(role));
  if (!allowed) {
    return { response: NextResponse.json({ error: "Insufficient permissions" }, { status: 403 }) };
  }

  return { session };
}
