import { NextResponse } from "next/server";
import { DEFAULT_TENANT_ID, proxyJson, serviceUrls } from "@/lib/service-client";

export async function GET() {
  const { response, body } = await proxyJson(
    `${serviceUrls.securityLayer}/usage/${DEFAULT_TENANT_ID}`,
    { method: "GET" },
    5000,
  );

  return NextResponse.json(body || { usage: null }, { status: response.status });
}
