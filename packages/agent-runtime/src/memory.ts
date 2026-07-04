// ── Memory System ──────────────────────────────────────────────
// Vector-based agent memory using PostgreSQL + pgvector.
// Stores conversation history, knowledge, and preferences.

import { pool } from "./db.js";

interface Memory {
  id: string;
  content: string;
  memoryType: string;
  metadata: Record<string, unknown>;
  importance: number;
  createdAt: Date;
}

export class MemorySystem {
  /**
   * Store a new memory entry with optional embedding.
   */
  async store(
    agentId: string,
    prompt: string,
    response: string,
    metadata: Record<string, unknown> = {},
  ): Promise<void> {
    const content = `Task: ${prompt}\n\nResult: ${response}`;
    const embedding = await this.generateEmbedding(content);

    const tenantId = (metadata.tenantId as string) || "00000000-0000-0000-0000-000000000000";

    await pool.query(
      `INSERT INTO agent_memory (tenant_id, agent_id, content, embedding, memory_type, metadata, importance)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        tenantId,
        agentId,
        content,
        embedding ? `[${embedding.join(",")}]` : null,
        "conversation",
        JSON.stringify(metadata),
        0.5,
      ],
    );
  }

  /**
   * Search for relevant memories using vector similarity.
   */
  async search(
    agentId: string,
    query: string,
    limit: number = 5,
  ): Promise<Memory[]> {
    const embedding = await this.generateEmbedding(query);

    if (!embedding) {
      // Fallback to text search
      const result = await pool.query(
        `SELECT * FROM agent_memory
         WHERE agent_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [agentId, limit],
      );
      return result.rows.map(this.mapRow);
    }

    const result = await pool.query(
      `SELECT *, 1 - (embedding <=> $1::vector) AS similarity
       FROM agent_memory
       WHERE agent_id = $2
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [`[${embedding.join(",")}]`, agentId, limit],
    );

    return result.rows.map(this.mapRow);
  }

  /**
   * Retrieve recent conversation history for an agent.
   */
  async getRecent(agentId: string, limit: number = 10): Promise<Memory[]> {
    const result = await pool.query(
      `SELECT * FROM agent_memory
       WHERE agent_id = $1 AND memory_type = 'conversation'
       ORDER BY created_at DESC
       LIMIT $2`,
      [agentId, limit],
    );

    return result.rows.map(this.mapRow);
  }

  /**
   * Store a knowledge fact (persistent memory).
   */
  async storeKnowledge(
    agentId: string,
    tenantId: string,
    fact: string,
    importance: number = 0.7,
  ): Promise<void> {
    const embedding = await this.generateEmbedding(fact);

    await pool.query(
      `INSERT INTO agent_memory (tenant_id, agent_id, content, embedding, memory_type, importance)
       VALUES ($1, $2, $3, $4, 'knowledge', $5)`,
      [
        tenantId,
        agentId,
        fact,
        embedding ? `[${embedding.join(",")}]` : null,
        importance,
      ],
    );
  }

  /**
   * Generate an embedding for a text using the local vLLM/Ollama.
   */
  private async generateEmbedding(text: string): Promise<number[] | null> {
    const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";

    try {
      const response = await fetch(`${ollamaUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: process.env.EMBEDDING_MODEL || "nomic-embed-text",
          prompt: text,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) return null;

      const data = await response.json() as any;
      return data.embedding || null;
    } catch {
      // Fallback: no embedding available
      return null;
    }
  }

  private mapRow(row: any): Memory {
    return {
      id: row.id,
      content: row.content,
      memoryType: row.memory_type,
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata,
      importance: row.importance,
      createdAt: row.created_at,
    };
  }
}
