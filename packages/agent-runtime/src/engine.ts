// ── Agent Engine ───────────────────────────────────────────────
// Core agent execution loop — the "brain" of each agent.

import type { LLMRequest, LLMResponse } from "@enterprise/shared";
import { MemorySystem } from "./memory.js";
import { SkillEngine } from "./skills.js";
import { ToolRegistry } from "./tools.js";

const SECURITY_LAYER_URL =
  process.env.SECURITY_LAYER_URL || "http://localhost:8423";
const VLLM_URL = process.env.VLLM_URL || "http://localhost:8000/v1";

const SYSTEM_PROMPT = `You are an enterprise AI agent. You help employees complete tasks efficiently and securely.

Key rules:
- Never share sensitive data outside the organization
- Use available tools to access enterprise systems
- Be concise and professional
- Always complete the task thoroughly
- Flag anything that requires human approval

You have access to:
- Enterprise databases and APIs (via MCP tools)
- Internal documents and knowledge bases
- Communication tools (Slack, email)
- Code execution and file operations`;

export class AgentEngine {
  private memory: MemorySystem;
  private skills: SkillEngine;
  private tools: ToolRegistry;

  constructor() {
    this.memory = new MemorySystem();
    this.skills = new SkillEngine();
    this.tools = new ToolRegistry();
  }

  /**
   * Execute a task — the main agent loop.
   */
  async executeTask(params: {
    taskId: string;
    tenantId: string;
    agentId: string;
    agentName: string;
    prompt: string;
    context?: Record<string, unknown>;
    maxIterations?: number;
    onEvent?: (event: {
      eventType: string;
      title: string;
      message?: string;
      payload?: Record<string, unknown>;
    }) => Promise<void> | void;
  }): Promise<{
    success: boolean;
    output: string;
    iterations: number;
    toolCalls: Array<{ name: string; result: unknown }>;
    tokensUsed: number;
  }> {
    const {
      taskId,
      tenantId,
      agentId,
      agentName,
      prompt,
      context = {},
      maxIterations = 10,
      onEvent,
    } = params;

    console.log(`🎯 Agent "${agentName}" executing task: ${taskId}`);

    // Build the message history
    await onEvent?.({
      eventType: "context_prepared",
      title: "Context prepared",
      message: "System prompt and task prompt assembled.",
      payload: { hasContext: Object.keys(context).length > 0 },
    });

    // Build the message history
    const messages: LLMRequest["messages"] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Add relevant memories
    const memories = await this.memory.search(agentId, prompt, 5);
    if (memories.length > 0) {
      const memoryContext = memories
        .map((m) => `[Relevant memory]: ${m.content}`)
        .join("\n");
      messages.push({
        role: "system",
        content: `Relevant past context:\n${memoryContext}`,
      });
    }
    await onEvent?.({
      eventType: "memory_loaded",
      title: "Memory loaded",
      message: `${memories.length} relevant memory entries loaded.`,
      payload: { count: memories.length },
    });

    // Add relevant skills
    const relevantSkills = await this.skills.findRelevant(agentId, prompt);
    if (relevantSkills.length > 0) {
      const skillContext = relevantSkills
        .map((s) => `[Available skill: ${s.name}]: ${s.instructions}`)
        .join("\n");
      messages.push({
        role: "system",
        content: `Available skills:\n${skillContext}`,
      });
    }
    await onEvent?.({
      eventType: "skills_loaded",
      title: "Skills loaded",
      message: `${relevantSkills.length} relevant skills loaded.`,
      payload: { count: relevantSkills.length },
    });

    // Add task context
    if (Object.keys(context).length > 0) {
      messages.push({
        role: "system",
        content: `Task context: ${JSON.stringify(context, null, 2)}`,
      });
    }

    // Main task prompt
    messages.push({ role: "user", content: prompt });

    // Get available tools
    const availableTools = await this.tools.listTools(tenantId);
    const toolDefs = availableTools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));

    // Execution loop
    let iterations = 0;
    let totalTokens = 0;
    const toolCalls: Array<{ name: string; result: unknown }> = [];
    let finalOutput = "";

    while (iterations < maxIterations) {
      iterations++;

      await onEvent?.({
        eventType: "model_call_started",
        title: `Model call ${iterations}`,
        message: "Routing through security layer.",
        payload: { iteration: iterations, toolDefinitions: toolDefs.length },
      });

      // Route through security layer
      const llmResponse = await this.callLLM(
        tenantId,
        agentId,
        messages,
        toolDefs,
      );

      totalTokens += llmResponse.tokensUsed;

      await onEvent?.({
        eventType: "model_call_completed",
        title: `Model response ${iterations}`,
        message: llmResponse.content.slice(0, 500),
        payload: {
          iteration: iterations,
          backend: llmResponse.backend,
          model: llmResponse.model,
          tokensUsed: llmResponse.tokensUsed,
          toolCalls: llmResponse.toolCalls?.length || 0,
        },
      });

      // If no tool calls, we're done
      if (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) {
        finalOutput = llmResponse.content;
        break;
      }

      // Execute tool calls
      const toolResults: Array<{ name: string; result: string }> = [];

      for (const toolCall of llmResponse.toolCalls) {
        try {
          await onEvent?.({
            eventType: "tool_call_started",
            title: `Tool call: ${toolCall.name}`,
            message: "Executing MCP-backed tool.",
            payload: { arguments: toolCall.arguments },
          });
          const result = await this.tools.executeTool(
            tenantId,
            toolCall.name,
            toolCall.arguments,
          );
          toolCalls.push({ name: toolCall.name, result });
          toolResults.push({
            name: toolCall.name,
            result: JSON.stringify(result),
          });
          await onEvent?.({
            eventType: "tool_call_completed",
            title: `Tool completed: ${toolCall.name}`,
            message: JSON.stringify(result).slice(0, 500),
            payload: { result },
          });
        } catch (err: any) {
          toolCalls.push({ name: toolCall.name, result: { error: err.message } });
          toolResults.push({
            name: toolCall.name,
            result: `Error: ${err.message}`,
          });
          await onEvent?.({
            eventType: "tool_call_failed",
            title: `Tool failed: ${toolCall.name}`,
            message: err.message,
            payload: { arguments: toolCall.arguments },
          });
        }
      }

      // Add assistant message with tool calls
      messages.push({
        role: "assistant",
        content: llmResponse.content || "Using tools...",
      });

      // Add tool results
      for (const tr of toolResults) {
        messages.push({
          role: "user",
          content: `Tool "${tr.name}" result: ${tr.result}`,
        });
      }

      finalOutput = llmResponse.content;
    }

    // Store in memory
    await this.memory.store(agentId, prompt, finalOutput, {
      taskId,
      tenantId,
      iterations,
      toolCalls: toolCalls.length,
    });
    await onEvent?.({
      eventType: "memory_written",
      title: "Memory written",
      message: "Task prompt and result stored as agent memory.",
      payload: { taskId },
    });

    // Learn from this execution
    if (iterations > 1 && finalOutput) {
      await this.skills.extractSkill(agentId, prompt, finalOutput);
      await onEvent?.({
        eventType: "skill_extraction",
        title: "Skill extraction attempted",
        message: "The runtime inspected the task for reusable skill patterns.",
        payload: { iterations },
      });
    }

    return {
      success: true,
      output: finalOutput || "Task completed (no additional output)",
      iterations,
      toolCalls,
      tokensUsed: totalTokens,
    };
  }

  /**
   * Call the LLM through the security layer.
   */
  private async callLLM(
    tenantId: string,
    agentId: string,
    messages: LLMRequest["messages"],
    tools?: LLMRequest["tools"],
  ): Promise<LLMResponse> {
    const response = await fetch(`${SECURITY_LAYER_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        agentId,
        tenantId,
        maxTokens: 32768,
        temperature: 0.7,
        tools,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Security layer error: ${error}`);
    }

    return response.json() as Promise<LLMResponse>;
  }
}
