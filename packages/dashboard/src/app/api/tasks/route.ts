import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID, proxyJson, serviceUrls } from "@/lib/service-client";
import { requireDashboardRole } from "@/lib/server-auth";

export async function GET() {
  const { response, body } = await proxyJson(
    `${serviceUrls.agentRuntime}/tasks?tenantId=${DEFAULT_TENANT_ID}&limit=25`,
    { method: "GET" },
    5000,
  );

  return NextResponse.json(body || { tasks: [] }, { status: response.status });
}

export async function POST(request: Request) {
  const auth = await requireDashboardRole(["admin", "agent_manager", "agent_user"]);
  if ("response" in auth) return auth.response;

  const payload = await request.json();
  const createOnly = payload.mode === "create" || payload.runNow === false;
  if (createOnly) {
    const { response, body } = await proxyJson(
      `${serviceUrls.agentRuntime}/tasks`,
      {
        method: "POST",
        body: JSON.stringify({
          tenantId: DEFAULT_TENANT_ID,
          sessionId: payload.sessionId || null,
          agentId: payload.agentId || null,
          agentName: payload.agentName || null,
          title: payload.title,
          prompt: payload.prompt,
          priority: payload.priority || "medium",
          boardStatus: payload.boardStatus || "queued",
        }),
      },
      10000,
    );

    return NextResponse.json(body || {}, { status: response.status });
  }

  const { response, body } = await proxyJson(
    `${serviceUrls.agentRuntime}/execute`,
    {
      method: "POST",
      body: JSON.stringify({
        taskId: payload.taskId || randomUUID(),
        tenantId: DEFAULT_TENANT_ID,
        sessionId: payload.sessionId || null,
        agentId: payload.agentId,
        agentName: payload.agentName,
        title: payload.title,
        prompt: payload.prompt,
        context: payload.context || {},
        maxIterations: payload.maxIterations || 4,
      }),
    },
    120000,
  );

  return NextResponse.json(body || {}, { status: response.status });
}
