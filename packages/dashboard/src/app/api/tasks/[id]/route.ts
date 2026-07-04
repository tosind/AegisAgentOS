import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID, proxyJson, serviceUrls } from "@/lib/service-client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const payload = await request.json();
  const { response, body } = await proxyJson(
    `${serviceUrls.agentRuntime}/tasks/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        tenantId: DEFAULT_TENANT_ID,
        ...payload,
      }),
    },
    10000,
  );

  return NextResponse.json(body || {}, { status: response.status });
}
