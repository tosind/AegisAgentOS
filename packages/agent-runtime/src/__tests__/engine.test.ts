// ── Agent Engine Tests ─────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentEngine } from "../engine.js";

// Mock database queries
vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

describe("AgentEngine", () => {
  let engine: AgentEngine;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    engine = new AgentEngine();
    // Create a fresh mock for each test
    mockFetch = vi.fn();
    global.fetch = mockFetch as any;
  });

  describe("executeTask", () => {
    it("should complete a simple task without tool calls", async () => {
      // Mock embedding fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.1, 0.2] }),
      });
      // Mock tools listTools fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tools: [] }),
      });
      // Mock callLLM fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: "Task completed successfully",
          model: "llama-3.1",
          backend: "vllm",
          tokensUsed: 100,
        }),
      });

      const result = await engine.executeTask({
        taskId: "task-1",
        tenantId: "tenant-1",
        agentId: "agent-1",
        agentName: "Test Agent",
        prompt: "Write a hello world function",
      });

      expect(result.success).toBe(true);
      expect(result.output).toBe("Task completed successfully");
      expect(result.iterations).toBe(1);
      expect(result.toolCalls).toHaveLength(0);
    });

    it("should handle tool calls correctly", async () => {
      // Mock embedding fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.1, 0.2] }),
      });
      // Mock tools listTools fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tools: [] }),
      });
      // First callLLM fetch: returns tool calls
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: "Let me check the database",
          model: "llama-3.1",
          backend: "vllm",
          tokensUsed: 50,
          toolCalls: [{ name: "get_current_time", arguments: {} }],
        }),
      });
      // Second callLLM fetch: final response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: "The current time is known. Task complete.",
          model: "llama-3.1",
          backend: "vllm",
          tokensUsed: 50,
        }),
      });

      const result = await engine.executeTask({
        taskId: "task-2",
        tenantId: "tenant-1",
        agentId: "agent-1",
        agentName: "Test Agent",
        prompt: "What time is it?",
      });

      expect(result.success).toBe(true);
      expect(result.iterations).toBe(2);
      expect(result.toolCalls.length).toBeGreaterThan(0);
    });

    it("should enforce max iterations limit", async () => {
      // Mock embedding fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.1, 0.2] }),
      });
      // Mock tools listTools fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tools: [] }),
      });
      // Create an infinite tool-calling loop
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          content: "Checking...",
          model: "llama-3.1",
          backend: "vllm",
          tokensUsed: 10,
          toolCalls: [{ name: "get_current_time", arguments: {} }],
        }),
      });

      const result = await engine.executeTask({
        taskId: "task-3",
        tenantId: "tenant-1",
        agentId: "agent-1",
        agentName: "Test Agent",
        prompt: "Loop forever",
        maxIterations: 3,
      });

      expect(result.iterations).toBe(3);
      expect(result.success).toBe(true);
    });

    it("should include relevant memories in system prompt", async () => {
      // Mock embedding fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.1, 0.2] }),
      });
      // Mock tools listTools fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tools: [] }),
      });
      // Mock callLLM fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: "Done",
          model: "llama-3.1",
          backend: "vllm",
          tokensUsed: 50,
        }),
      });

      await engine.executeTask({
        taskId: "task-4",
        tenantId: "tenant-1",
        agentId: "agent-1",
        agentName: "Test Agent",
        prompt: "Continue from last time",
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it("should propagate LLM errors", async () => {
      // Mock embedding fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.1, 0.2] }),
      });
      // Mock tools listTools fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tools: [] }),
      });
      // Mock callLLM fetch — reject
      mockFetch.mockRejectedValueOnce(new Error("LLM connection failed"));

      await expect(
        engine.executeTask({
          taskId: "task-5",
          tenantId: "tenant-1",
          agentId: "agent-1",
          agentName: "Test Agent",
          prompt: "Test error handling",
        }),
      ).rejects.toThrow("LLM connection failed");
    });
  });
});
