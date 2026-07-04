import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID, proxyJson, serviceUrls } from "@/lib/service-client";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const limit = url.searchParams.get("limit") || "50";
  const params = new URLSearchParams({
    tenantId: DEFAULT_TENANT_ID,
    limit,
  });
  if (status) params.set("status", status);

  const { response, body } = await proxyJson(
    `${serviceUrls.securityLayer}/approvals?${params.toString()}`,
    { method: "GET" },
    5000,
  );

  return NextResponse.json(body || { approvals: [] }, { status: response.status });
}
