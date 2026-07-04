// ── Dashboard Auth API — Login ────────────────────────────────

import { NextResponse } from "next/server";
import { createSessionToken, verifyPassword } from "@/lib/auth-helpers";

// In production, these would be in a database
const MOCK_USERS: Record<
  string,
  { password: string; userId: string; tenantId: string; name: string; roles: string[] }
> = {
  "admin@enterprise.local": {
    password: "$2b$10$placeholder_hash_for_development",
    userId: "user-admin",
    tenantId: "00000000-0000-0000-0000-000000000000",
    name: "Admin User",
    roles: ["admin", "agent_manager"],
  },
  "developer@enterprise.local": {
    password: "$2b$10$placeholder_hash_for_development",
    userId: "user-dev",
    tenantId: "00000000-0000-0000-0000-000000000000",
    name: "Developer",
    roles: ["agent_user"],
  },
};

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 },
      );
    }

    const normalizedEmail = String(email).toLowerCase();
    const configuredAdminEmail =
      process.env.DASHBOARD_ADMIN_EMAIL || "admin@enterprise.local";
    const configuredAdminPassword = process.env.DASHBOARD_ADMIN_PASSWORD;
    const user = MOCK_USERS[normalizedEmail] || (
      normalizedEmail === configuredAdminEmail
        ? {
            password: "",
            userId: "user-admin",
            tenantId: "00000000-0000-0000-0000-000000000000",
            name: "Admin User",
            roles: ["admin", "agent_manager"],
          }
        : undefined
    );
    if (!user) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const isLocalDevUser =
      process.env.NODE_ENV === "development" &&
      normalizedEmail.endsWith("@enterprise.local");
    const isConfiguredAdmin =
      normalizedEmail === configuredAdminEmail &&
      !!configuredAdminPassword &&
      password === configuredAdminPassword;
    const isHashValid = user.password ? verifyPassword(password, user.password) : false;
    const isValid = isLocalDevUser || isConfiguredAdmin || isHashValid;

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 },
      );
    }

    const token = createSessionToken({
      userId: user.userId,
      tenantId: user.tenantId,
      email,
      name: user.name,
      roles: user.roles,
    });

    // Set cookie and return token
    const response = NextResponse.json({
      success: true,
      user: {
        userId: user.userId,
        tenantId: user.tenantId,
        email: normalizedEmail,
        name: user.name,
        roles: user.roles,
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      },
    });

    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 },
    );
  }
}
