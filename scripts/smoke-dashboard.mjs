const baseUrl = process.env.DASHBOARD_BASE_URL || "http://localhost:3000";
const email = process.env.DASHBOARD_SMOKE_EMAIL || process.env.DASHBOARD_ADMIN_EMAIL || "admin@enterprise.local";
const password = process.env.DASHBOARD_SMOKE_PASSWORD || process.env.DASHBOARD_ADMIN_PASSWORD || "change-me-now";

const routes = [
  "/",
  "/agents",
  "/policies",
  "/audit",
  "/integrations",
  "/settings",
  "/onboarding",
  "/auth/login",
];

function url(path) {
  return new URL(path, baseUrl).toString();
}

async function assertRoute(path) {
  const response = await fetch(url(path), { redirect: "manual" });
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return `${path} ${response.status}`;
}

async function assertOpsApi() {
  const response = await fetch(url("/api/ops"));
  if (!response.ok) {
    throw new Error(`/api/ops returned ${response.status}`);
  }

  const body = await response.json();
  const requiredArrays = ["agents", "tasks", "auditLogs", "connections"];
  for (const key of requiredArrays) {
    if (!Array.isArray(body[key])) {
      throw new Error(`/api/ops missing array field: ${key}`);
    }
  }
  if (!body.serviceHealth || typeof body.serviceHealth !== "object") {
    throw new Error("/api/ops missing serviceHealth object");
  }
  if (!body.backends || typeof body.backends !== "object") {
    throw new Error("/api/ops missing backends object");
  }

  return `/api/ops ${response.status} source=${body.source} agents=${body.agents.length} tasks=${body.tasks.length} audit=${body.auditLogs.length} connections=${body.connections.length}`;
}

async function postLogin(payload) {
  return fetch(url("/api/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function assertAuth() {
  const success = await postLogin({ email, password });
  const successBody = await success.json().catch(() => ({}));
  if (!success.ok || successBody.success !== true || !successBody.user?.email) {
    throw new Error(
      `/api/auth/login expected success for ${email}, got ${success.status}: ${JSON.stringify(successBody)}`,
    );
  }

  const failure = await postLogin({ email, password: `${password}-wrong` });
  if (failure.status !== 401) {
    throw new Error(`/api/auth/login expected 401 for bad password, got ${failure.status}`);
  }

  return `/api/auth/login success=${success.status} failure=${failure.status}`;
}

try {
  const results = [];
  for (const path of routes) {
    results.push(await assertRoute(path));
  }
  results.push(await assertOpsApi());
  results.push(await assertAuth());

  console.log(`Aegis dashboard smoke passed at ${baseUrl}`);
  for (const line of results) {
    console.log(`- ${line}`);
  }
} catch (error) {
  console.error("Aegis dashboard smoke failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
