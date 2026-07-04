// ── File System Connector ──────────────────────────────────────
// Provides file system access tools via MCP.

import type { Connector, Tool } from "./types.js";
import * as fs from "fs/promises";
import * as path from "path";

export class FileSystemConnector implements Connector {
  listTools(config: Record<string, unknown>): Tool[] {
    const basePath = (config.basePath as string) || "/";
    return [
      {
        name: "filesystem_read",
        description: `Read a file (relative to ${basePath})`,
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path relative to base" },
          },
          required: ["path"],
        },
        serverType: "filesystem",
        connectionId: "",
      },
      {
        name: "filesystem_write",
        description: `Write to a file (relative to ${basePath})`,
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "File path relative to base" },
            content: { type: "string", description: "Content to write" },
          },
          required: ["path", "content"],
        },
        serverType: "filesystem",
        connectionId: "",
      },
      {
        name: "filesystem_list",
        description: `List directory contents (relative to ${basePath})`,
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Directory path (default: root)" },
          },
        },
        serverType: "filesystem",
        connectionId: "",
      },
      {
        name: "filesystem_search",
        description: `Search for files matching a pattern`,
        parameters: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "Glob pattern (e.g., **/*.ts)" },
          },
          required: ["pattern"],
        },
        serverType: "filesystem",
        connectionId: "",
      },
    ];
  }

  async callTool(
    toolName: string,
    args: Record<string, unknown>,
    config: Record<string, unknown>,
  ): Promise<unknown> {
    const basePath = (config.basePath as string) || "/";
    const readOnly = config.readOnly as boolean;

    const resolve = (p: string) => path.resolve(basePath, p);
    const validate = (p: string) => {
      const resolved = resolve(p);
      if (!resolved.startsWith(path.resolve(basePath))) {
        throw new Error("Path traversal denied");
      }
      return resolved;
    };

    switch (toolName) {
      case "filesystem_read": {
        const filePath = validate(args.path as string);
        const content = await fs.readFile(filePath, "utf-8");
        return { path: args.path, content, size: content.length };
      }
      case "filesystem_write": {
        if (readOnly) throw new Error("File system is read-only");
        const filePath = validate(args.path as string);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, args.content as string, "utf-8");
        return { success: true, path: args.path };
      }
      case "filesystem_list": {
        const dirPath = validate((args.path as string) || ".");
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        return {
          path: args.path || ".",
          entries: entries.map((e) => ({
            name: e.name,
            type: e.isDirectory() ? "directory" : "file",
          })),
        };
      }
      case "filesystem_search": {
        // Simple glob-based search
        const pattern = args.pattern as string;
        const results: string[] = [];
        await this.globSearch(basePath, pattern, results);
        return { pattern, matches: results.slice(0, 100) };
      }
      default:
        throw new Error(`Unknown FileSystem tool: ${toolName}`);
    }
  }

  async testConnection(config: Record<string, unknown>): Promise<boolean> {
    try {
      const basePath = (config.basePath as string) || "/";
      await fs.access(basePath);
      return true;
    } catch {
      return false;
    }
  }

  private async globSearch(
    dir: string,
    pattern: string,
    results: string[],
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (pattern.startsWith("**")) {
            await this.globSearch(fullPath, pattern, results);
          }
        } else if (entry.name.includes(pattern.replace(/\*\*\/?/g, "").replace(/\*/g, ""))) {
          results.push(fullPath);
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }
}
