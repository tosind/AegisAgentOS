// ── Skill Engine ───────────────────────────────────────────────
// Self-improving skill system — agents learn from experience.
// Inspired by Hermes Agent's skill creation loop.

import { pool } from "./db.js";

interface Skill {
  id: string;
  name: string;
  description: string;
  instructions: string;
  category: string;
  source: string;
  usageCount: number;
  successRate: number;
}

export class SkillEngine {
  /**
   * Find skills relevant to a task.
   */
  async findRelevant(agentId: string, task: string): Promise<Skill[]> {
    const result = await pool.query(
      `SELECT * FROM skills
       WHERE (agent_id = $1 OR agent_id IS NULL)
       AND usage_count > 0
       ORDER BY success_rate DESC, usage_count DESC
       LIMIT 10`,
      [agentId],
    );

    // Simple keyword matching for relevance
    const taskLower = task.toLowerCase();
    return result.rows
      .filter((row: any) => {
        const skillText = `${row.name} ${row.description} ${row.instructions}`.toLowerCase();
        const keywords = taskLower.split(/\s+/).filter((w) => w.length > 3);
        return keywords.some((kw) => skillText.includes(kw));
      })
      .map(this.mapRow)
      .slice(0, 5);
  }

  /**
   * Create a new skill manually.
   */
  async createSkill(params: {
    tenantId: string;
    agentId?: string;
    name: string;
    description: string;
    instructions: string;
    category?: string;
  }): Promise<Skill> {
    const result = await pool.query(
      `INSERT INTO skills (tenant_id, agent_id, name, description, instructions, category, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'manual')
       RETURNING *`,
      [
        params.tenantId,
        params.agentId || null,
        params.name,
        params.description,
        params.instructions,
        params.category || "general",
      ],
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Extract a skill from a successful task execution (auto-learning).
   * This is a heuristic extraction — identifies patterns that could be
   * turned into reusable skills.
   */
  async extractSkill(
    agentId: string,
    task: string,
    result: string,
  ): Promise<Skill | null> {
    // Only extract if the result looks successful and substantial
    if (result.length < 200) return null;

    const taskLower = task.toLowerCase();

    // Check if a similar skill already exists
    const existing = await pool.query(
      `SELECT * FROM skills
       WHERE agent_id = $1
       AND similarity(name, $2) > 0.3
       LIMIT 1`,
      [agentId, task.slice(0, 100)],
    );

    if (existing.rows.length > 0) {
      // Update usage stats on existing skill
      await pool.query(
        `UPDATE skills SET usage_count = usage_count + 1, updated_at = NOW()
         WHERE id = $1`,
        [existing.rows[0].id],
      );
      return this.mapRow(existing.rows[0]);
    }

    // Generate a skill name from the task
    const skillName = this.generateSkillName(task);

    // Extract key instructions from the result
    const instructions = this.extractInstructions(result);

    if (instructions.length < 50) return null;

    // Determine category
    const category = this.categorizeTask(taskLower);

    const dbResult = await pool.query(
      `INSERT INTO skills (tenant_id, agent_id, name, description, instructions, category, source)
       VALUES ($1, $2, $3, $4, $5, $6, 'learned')
       RETURNING *`,
      [
        "00000000-0000-0000-0000-000000000000", // tenant from agent config
        agentId,
        skillName,
        `Auto-learned skill for: ${task.slice(0, 200)}`,
        instructions,
        category,
      ],
    );

    console.log(`🎓 Agent ${agentId} learned new skill: ${skillName}`);
    return this.mapRow(dbResult.rows[0]);
  }

  /**
   * List all skills for an agent.
   */
  async listSkills(agentId?: string): Promise<Skill[]> {
    const result = await pool.query(
      `SELECT * FROM skills
       WHERE agent_id = $1 OR agent_id IS NULL
       ORDER BY usage_count DESC`,
      [agentId || null],
    );

    return result.rows.map(this.mapRow);
  }

  /**
   * Generate a skill name from a task description.
   */
  private generateSkillName(task: string): string {
    // Take first few meaningful words
    const words = task
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 4);

    return words
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ") || "General Task";
  }

  /**
   * Extract actionable instructions from a result.
   */
  private extractInstructions(result: string): string {
    // Look for numbered steps, bullet points, or code blocks
    const lines = result.split("\n");
    const instructionLines = lines.filter(
      (l) =>
        l.match(/^\d+[\.\)]\s/) || // Numbered steps
        l.match(/^[-*•]\s/) || // Bullet points
        l.match(/^```/) || // Code blocks
        l.match(/step\s+\d+/i) || // "Step X"
        l.match(/^(first|next|then|finally)/i), // Sequential markers
    );

    if (instructionLines.length >= 2) {
      return instructionLines.join("\n").slice(0, 2000);
    }

    // Fallback: take the first 1000 chars as instructions
    return result.slice(0, 1000);
  }

  /**
   * Categorize a task based on keywords.
   */
  private categorizeTask(taskLower: string): string {
    const categories: Record<string, string[]> = {
      database: ["sql", "query", "database", "postgres", "table", "schema"],
      api: ["api", "endpoint", "rest", "graphql", "http", "fetch"],
      code: ["code", "function", "class", "implement", "refactor", "bug", "fix"],
      data: ["data", "analysis", "report", "chart", "analytics", "metrics"],
      communication: ["email", "slack", "message", "notify", "send"],
      deployment: ["deploy", "release", "pipeline", "ci/cd", "docker"],
      documentation: ["document", "readme", "write", "docs"],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some((kw) => taskLower.includes(kw))) {
        return category;
      }
    }

    return "general";
  }

  private mapRow(row: any): Skill {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      instructions: row.instructions,
      category: row.category,
      source: row.source,
      usageCount: row.usage_count,
      successRate: row.success_rate,
    };
  }
}
