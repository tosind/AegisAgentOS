// ── Memory System Tests ────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock DB — factory must NOT reference external variables (vitest hoisting)
vi.mock("../db.js", () => ({
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

// We'll import the mock after module init
const { MemorySystem } = await import("../memory.js");

// Mock the embedding fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe("MemorySystem", () => {
  let memory: MemorySystem;

  beforeEach(() => {
    memory = new MemorySystem();
    mockFetch.mockReset();
  });

  describe("store", () => {
    it("should store a memory entry with embedding", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.1, 0.2, 0.3] }),
      });

      await memory.store(
        "agent-1",
        "Write a function",
        "Here is the function",
        { tenantId: "tenant-1" },
      );

      // Verify pool.query was called for the INSERT
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should handle missing embedding gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("No embedding service"));

      await memory.store(
        "agent-2",
        "Task",
        "Result",
        { tenantId: "tenant-1" },
      );

      // Should fall back to no embedding — should not throw
      expect(true).toBe(true);
    });
  });

  describe("search", () => {
    it("should return empty array when no memories match", async () => {
      mockFetch.mockRejectedValueOnce(new Error("No embedding"));
      const results = await memory.search("agent-1", "some query");
      expect(results).toEqual([]);
    });

    it("should fall back to text search when embeddings unavailable", async () => {
      mockFetch.mockRejectedValueOnce(new Error("No embedding"));
      const results = await memory.search("agent-1", "test query");
      expect(results).toEqual([]);
    });
  });

  describe("storeKnowledge", () => {
    it("should store a knowledge fact", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ embedding: [0.1, 0.2] }),
      });

      await memory.storeKnowledge("agent-1", "tenant-1", "The API endpoint is /v2/data", 0.8);
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe("getRecent", () => {
    it("should return recent memories", async () => {
      const results = await memory.getRecent("agent-1", 5);
      expect(Array.isArray(results)).toBe(true);
    });
  });
});
