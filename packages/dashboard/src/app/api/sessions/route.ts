import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID, proxyJson, serviceUrls } from "@/lib/service-client";
import { requireDashboardRole } from "@/lib/server-auth";

export async function GET() {
  const { response, body } = await proxyJson(
    `${serviceUrls.agentRuntime}/sessions?tenantId=${DEFAULT_TENANT_ID}&limit=25`,
    { method: "GET" },
    5000,
  );

  return NextResponse.json(body || { sessions: [] }, { status: response.status });
}

export async function POST(request: Request) {
  const auth = await requireDashboardRole(["admin", "agent_manager", "agent_user"]);
  if ("response" in auth) return auth.response;

  const payload = await request.json();
  const { response, body } = await proxyJson(
    `${serviceUrls.agentRuntime}/sessions`,
    {
      method: "POST",
      body: JSON.stringify({
        tenantId: DEFAULT_TENANT_ID,
        title: payload.title,
        objective: payload.objective,
        createdBy: auth.session.userId,
        metadata: payload.metadata || {},
      }),
    },
    10000,
  );

  return NextResponse.json(body || {}, { status: response.status });
}
