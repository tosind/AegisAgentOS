// ── GitHub Connector ───────────────────────────────────────────
// Provides GitHub repository tools via MCP.

import type { Connector, Tool } from "./types.js";
import { decodeConfigValue } from "./utils.js";

export class GitHubConnector implements Connector {
  listTools(config: Record<string, unknown>): Tool[] {
    return [
      {
        name: "github_search_code",
        description: "Search code in a GitHub repository",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            repo: { type: "string", description: "Repository (owner/repo)" },
          },
          required: ["query"],
        },
        serverType: "github",
        connectionId: "",
      },
      {
        name: "github_list_issues",
        description: "List issues in a repository",
        parameters: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repository (owner/repo)" },
            state: { type: "string", description: "open, closed, or all" },
            labels: { type: "string", description: "Comma-separated labels" },
          },
          required: ["repo"],
        },
        serverType: "github",
        connectionId: "",
      },
      {
        name: "github_create_issue",
        description: "Create a new issue",
        parameters: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repository (owner/repo)" },
            title: { type: "string", description: "Issue title" },
            body: { type: "string", description: "Issue body (markdown)" },
            labels: { type: "array", items: { type: "string" } },
          },
          required: ["repo", "title"],
        },
        serverType: "github",
        connectionId: "",
      },
      {
        name: "github_list_prs",
        description: "List pull requests in a repository",
        parameters: {
          type: "object",
          properties: {
            repo: { type: "string", description: "Repository (owner/repo)" },
            state: { type: "string", description: "open, closed, or all" },
          },
          required: ["repo"],
        },
        serverType: "github",
        connectionId: "",
      },
    ];
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Promise<unknown> {
    const token = decodeConfigValue(config.token as string);

    switch (toolName) {
      case "github_search_code": {
        const repo = args.repo || config.repo;
        return this.apiCall(token, "GET", `/search/code?q=${encodeURIComponent(args.query as string)}+repo:${repo}`);
      }
      case "github_list_issues": {
        const repo = (args.repo || config.repo) as string;
        const state = (args.state as string) || "open";
        const labels = args.labels ? `&labels=${args.labels}` : "";
        return this.apiCall(token, "GET", `/repos/${repo}/issues?state=${state}${labels}`);
      }
      case "github_create_issue": {
        const repo = (args.repo || config.repo) as string;
        return this.apiCall(token, "POST", `/repos/${repo}/issues`, {
          title: args.title,
          body: args.body,
          labels: args.labels,
        });
      }
      case "github_list_prs": {
        const repo = args.repo || config.repo;
        const state = (args.state as string) || "open";
        return this.apiCall(token, "GET", `/repos/${repo}/pulls?state=${state}`);
      }
      default:
        throw new Error(`Unknown GitHub tool: ${toolName}`);
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<boolean> {
    try {
      const token = decodeConfigValue(config.token as string);
      await this.apiCall(token, "GET", "/user");
      return true;
    } catch {
      return false;
    }
  }

  private async apiCall(
    token: string,
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    };

    if (body && method !== "GET") {
      options.headers = { ...options.headers, "Content-Type": "application/json" };
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`https://api.github.com${path}`, options);
    if (!response.ok) {
      throw new Error(`GitHub API error (${response.status}): ${await response.text()}`);
    }
    return response.json();
  }

}
