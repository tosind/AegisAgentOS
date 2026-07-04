import { NextResponse } from "next/server";
import { proxyJson, serviceUrls } from "@/lib/service-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { response, body } = await proxyJson(
    `${serviceUrls.agentRuntime}/tasks/${id}/events`,
    { method: "GET" },
    5000,
  );

  return NextResponse.json(body || { events: [] }, { status: response.status });
}
