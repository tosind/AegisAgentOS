// ── REST API Connector ─────────────────────────────────────────
// Generic connector for any REST API.

import type { Connector, Tool } from "./types.js";
import { decodeConfigValue } from "./utils.js";

export class RESTAPIConnector implements Connector {
  listTools(config: Record<string, unknown>): Tool[] {
    return [
      {
        name: "rest_api_get",
        description: `Make a GET request to ${config.baseUrl || "the REST API"}`,
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "API path (e.g., /users)" },
            params: { type: "object", description: "Query parameters" },
          },
          required: ["path"],
        },
        serverType: "rest_api",
        connectionId: "",
      },
      {
        name: "rest_api_post",
        description: `Make a POST request to ${config.baseUrl || "the REST API"}`,
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "API path" },
            body: { type: "object", description: "Request body" },
          },
          required: ["path", "body"],
        },
        serverType: "rest_api",
        connectionId: "",
      },
      {
        name: "rest_api_put",
        description: `Make a PUT request to ${config.baseUrl || "the REST API"}`,
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "API path" },
            body: { type: "object", description: "Request body" },
          },
          required: ["path", "body"],
        },
        serverType: "rest_api",
        connectionId: "",
      },
      {
        name: "rest_api_delete",
        description: `Make a DELETE request to ${config.baseUrl || "the REST API"}`,
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "API path" },
          },
          required: ["path"],
        },
        serverType: "rest_api",
        connectionId: "",
      },
    ];
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Promise<unknown> {
    const baseUrl = (config.baseUrl as string).replace(/\/$/, "");
    const path = args.path as string;
    const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((config.headers as Record<string, string>) || {}),
    };

    // Add auth
    const authType = config.authType as string;
    const authConfig = (config.authConfig as Record<string, string>) || {};
    if (authType === "bearer") {
      headers["Authorization"] = `Bearer ${decodeConfigValue(authConfig.token || "")}`;
    } else if (authType === "basic") {
      const user = authConfig.username || "";
      const pass = decodeConfigValue(authConfig.password || "");
      headers["Authorization"] = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
    } else if (authType === "api_key") {
      headers[authConfig.headerName || "X-API-Key"] = decodeConfigValue(authConfig.apiKey || "");
    }

    let method = "GET";
    let body: string | undefined;

    switch (toolName) {
      case "rest_api_get": {
        const params = args.params as Record<string, string> | undefined;
        const queryString = params
          ? "?" + new URLSearchParams(params).toString()
          : "";
        const response = await fetch(`${url}${queryString}`, { headers });
        return response.json();
      }
      case "rest_api_post":
        method = "POST";
        body = JSON.stringify(args.body);
        break;
      case "rest_api_put":
        method = "PUT";
        body = JSON.stringify(args.body);
        break;
      case "rest_api_delete":
        method = "DELETE";
        break;
      default:
        throw new Error(`Unknown REST API tool: ${toolName}`);
    }

    const response = await fetch(url, { method, headers, body });
    if (!response.ok) {
      throw new Error(`REST API error (${response.status}): ${await response.text()}`);
    }
    return response.json();
  }

  async testConnection(config: Record<string, unknown>): Promise<boolean> {
    try {
      const baseUrl = (config.baseUrl as string).replace(/\/$/, "");
      const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(5000) });
      return response.ok || response.status < 500;
    } catch {
      return false;
    }
  }

}
