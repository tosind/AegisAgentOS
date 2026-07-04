import { NextResponse } from "next/server";
import { proxyJson, serviceUrls } from "@/lib/service-client";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = await request.json().catch(() => ({}));
  const { response, body } = await proxyJson(
    `${serviceUrls.agentRuntime}/tasks/${id}/run`,
    {
      method: "POST",
      body: JSON.stringify({
        agentId: payload.agentId,
        context: payload.context || {},
        maxIterations: payload.maxIterations || 4,
      }),
    },
    120000,
  );

  return NextResponse.json(body || {}, { status: response.status });
}
