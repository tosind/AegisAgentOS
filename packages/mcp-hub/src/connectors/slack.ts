// ── Slack Connector ────────────────────────────────────────────
// Provides Slack messaging and channel tools via MCP.

import type { Connector, Tool } from "./types.js";
import { decodeConfigValue } from "./utils.js";

export class SlackConnector implements Connector {
  listTools(config: Record<string, unknown>): Tool[] {
    return [
      {
        name: "slack_send_message",
        description: "Send a message to a Slack channel",
        parameters: {
          type: "object",
          properties: {
            channel: { type: "string", description: "Channel ID or name" },
            text: { type: "string", description: "Message text (supports markdown)" },
          },
          required: ["channel", "text"],
        },
        serverType: "slack",
        connectionId: "",
      },
      {
        name: "slack_list_channels",
        description: "List available Slack channels",
        parameters: { type: "object", properties: {} },
        serverType: "slack",
        connectionId: "",
      },
      {
        name: "slack_get_channel_history",
        description: "Get recent messages from a channel",
        parameters: {
          type: "object",
          properties: {
            channel: { type: "string", description: "Channel ID" },
            limit: { type: "number", description: "Max messages (default: 10)" },
          },
          required: ["channel"],
        },
        serverType: "slack",
        connectionId: "",
      },
      {
        name: "slack_search_messages",
        description: "Search for messages in Slack",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search query" },
            count: { type: "number", description: "Max results (default: 20)" },
          },
          required: ["query"],
        },
        serverType: "slack",
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
      case "slack_send_message":
        return this.apiCall(token, "chat.postMessage", {
          channel: args.channel,
          text: args.text,
          mrkdwn: true,
        });

      case "slack_list_channels":
        return this.apiCall(token, "conversations.list", {
          limit: 200,
          types: "public_channel,private_channel",
        });

      case "slack_get_channel_history":
        return this.apiCall(token, "conversations.history", {
          channel: args.channel,
          limit: args.limit || 10,
        });

      case "slack_search_messages":
        return this.apiCall(token, "search.messages", {
          query: args.query,
          count: args.count || 20,
        });

      default:
        throw new Error(`Unknown Slack tool: ${toolName}`);
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<boolean> {
    try {
      const token = decodeConfigValue(config.token as string);
      await this.apiCall(token, "auth.test", {});
      return true;
    } catch {
      return false;
    }
  }

  private async apiCall(
    token: string,
    method: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const url = new URL(`https://slack.com/api/${method}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await response.json() as any;
    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error}`);
    }
    return data;
  }

}
