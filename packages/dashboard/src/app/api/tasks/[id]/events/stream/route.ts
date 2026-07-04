import { serviceUrls } from "@/lib/service-client";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(request.url);
  const after = url.searchParams.get("after");
  const upstream = await fetch(
    `${serviceUrls.agentRuntime}/tasks/${id}/events/stream${after ? `?after=${after}` : ""}`,
    {
      method: "GET",
      cache: "no-store",
    },
  );

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
