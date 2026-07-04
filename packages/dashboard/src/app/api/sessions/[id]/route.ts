import { NextResponse } from "next/server";
import { proxyJson, serviceUrls } from "@/lib/service-client";
import { requireDashboardRole } from "@/lib/server-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { response, body } = await proxyJson(
    `${serviceUrls.agentRuntime}/sessions/${id}`,
    { method: "GET" },
    5000,
  );

  return NextResponse.json(body || {}, { status: response.status });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireDashboardRole(["admin", "agent_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const payload = await request.json();
  const { response, body } = await proxyJson(
    `${serviceUrls.agentRuntime}/sessions/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    },
    10000,
  );

  return NextResponse.json(body || {}, { status: response.status });
}
