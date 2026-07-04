import { NextResponse } from "next/server";
import { proxyJson, serviceUrls } from "@/lib/service-client";
import { requireDashboardRole } from "@/lib/server-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireDashboardRole(["admin", "agent_manager"]);
  if ("response" in auth) return auth.response;

  const { id } = await params;
  const payload = await request.json();
  const actorId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    auth.session.userId,
  )
    ? auth.session.userId
    : undefined;
  const { response, body } = await proxyJson(
    `${serviceUrls.securityLayer}/approvals/${id}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status: payload.status,
        actorId,
      }),
    },
    10000,
  );

  return NextResponse.json(body || {}, { status: response.status });
}
