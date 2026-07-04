import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID, proxyJson, serviceUrls } from "@/lib/service-client";
import { requireDashboardRole } from "@/lib/server-auth";

export async function GET() {
  const { response, body } = await proxyJson(
    `${serviceUrls.agentRuntime}/agents?tenantId=${DEFAULT_TENANT_ID}`,
    { method: "GET" },
    5000,
  );

  return NextResponse.json(body || { agents: [] }, { status: response.status });
}

export async function POST(request: Request) {
  const auth = await requireDashboardRole(["admin", "agent_manager"]);
  if ("response" in auth) return auth.response;

  const payload = await request.json();
  const { response, body } = await proxyJson(
    `${serviceUrls.agentRuntime}/agents`,
    {
      method: "POST",
      body: JSON.stringify({
        tenantId: DEFAULT_TENANT_ID,
        ...payload,
      }),
    },
    10000,
  );

  return NextResponse.json(body || {}, { status: response.status });
}
