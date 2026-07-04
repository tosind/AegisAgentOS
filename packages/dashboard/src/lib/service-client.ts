export const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID || "00000000-0000-0000-0000-000000000000";

export const serviceUrls = {
  agentRuntime:
    process.env.AGENT_RUNTIME_URL ||
    process.env.NEXT_PUBLIC_AGENT_RUNTIME_URL ||
    "http://localhost:8421",
  securityLayer:
    process.env.SECURITY_LAYER_URL ||
    process.env.NEXT_PUBLIC_SECURITY_LAYER_URL ||
    "http://localhost:8423",
  mcpHub:
    process.env.MCP_HUB_URL ||
    process.env.NEXT_PUBLIC_MCP_HUB_URL ||
    "http://localhost:8422",
};

export function serviceHeaders(): HeadersInit {
  const apiKey = process.env.DASHBOARD_API_KEY || "esk_dev_dashboard_key";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

export async function getJson<T>(url: string, timeoutMs = 1500): Promise<T | null> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function proxyJson<T>(
  url: string,
  init: RequestInit = {},
  timeoutMs = 30000,
): Promise<{ response: Response; body: T | null }> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...serviceHeaders(),
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as T) : null;
  return { response, body };
}
