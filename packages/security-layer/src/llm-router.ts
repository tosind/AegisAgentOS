// ── LLM Router ─────────────────────────────────────────────────
// Routes prompts to the appropriate LLM backend based on:
// 1. Sensitivity classification
// 2. Agent permissions
// 3. Security policies

import type {
  LLMBackend,
  LLMRequest,
  LLMResponse,
  ClassificationResult,
  AgentConfig,
  SecurityPolicy,
} from "@enterprise/shared";
import { SensitivityLevel, LLMBackend as LLMBackendConst } from "@enterprise/shared";
import { classifyPrompt } from "./pii-scrubber.js";
import { PolicyEngine } from "./policy-engine.js";

// ── LLM Client Interface ─────────────────────────────────────

interface LLMClient {
  backend: LLMBackend;
  chat(request: LLMRequest, baseUrl: string): Promise<LLMResponse>;
  isAvailable(baseUrl: string): Promise<boolean>;
}

// ── vLLM Client (OpenAI-compatible) ──────────────────────────

class VLLMClient implements LLMClient {
  backend: LLMBackend = LLMBackendConst.VLLM;

  async chat(request: LLMRequest, baseUrl: string): Promise<LLMResponse> {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model || "default",
        messages: request.messages,
        max_tokens: request.maxTokens || 32768,
        temperature: request.temperature || 0.7,
        tools: request.tools?.map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          },
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`vLLM error (${response.status}): ${error}`);
    }

    const data = await response.json() as any;
    const choice = data.choices?.[0];
    const message = choice?.message;

    return {
      content: message?.content || "",
      model: data.model || "unknown",
      backend: LLMBackendConst.VLLM,
      tokensUsed: data.usage?.total_tokens || 0,
      toolCalls: message?.tool_calls?.map((tc: any) => ({
        name: tc.function?.name || "",
        arguments: JSON.parse(tc.function?.arguments || "{}"),
      })),
    };
  }

  async isAvailable(baseUrl: string): Promise<boolean> {
    try {
      // vLLM health is at /health, not /v1/health
      const healthUrl = baseUrl.replace(/\/v1$/, "") + "/health";
      const response = await fetch(healthUrl, { signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ── Ollama Client ────────────────────────────────────────────

class OllamaClient implements LLMClient {
  backend: LLMBackend = LLMBackendConst.OLLAMA;

  async chat(request: LLMRequest, baseUrl: string): Promise<LLMResponse> {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model || "llama3.1:70b",
        messages: request.messages,
        options: {
          num_predict: request.maxTokens || 32768,
          temperature: request.temperature || 0.7,
        },
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama error (${response.status}): ${error}`);
    }

    const data = await response.json() as any;

    return {
      content: data.message?.content || "",
      model: data.model || "unknown",
      backend: LLMBackendConst.OLLAMA,
      tokensUsed: data.eval_count || 0,
    };
  }

  async isAvailable(baseUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ── OpenAI Client (external) ─────────────────────────────────

class OpenAIClient implements LLMClient {
  backend: LLMBackend = LLMBackendConst.OPENAI;

  async chat(request: LLMRequest, _baseUrl: string): Promise<LLMResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: request.model || "gpt-4o",
        messages: request.messages,
        max_tokens: request.maxTokens || 4096,
        temperature: request.temperature || 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI error (${response.status}): ${error}`);
    }

    const data = await response.json() as any;
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || "",
      model: data.model || "unknown",
      backend: LLMBackendConst.OPENAI,
      tokensUsed: data.usage?.total_tokens || 0,
    };
  }

  async isAvailable(_baseUrl: string): Promise<boolean> {
    return !!process.env.OPENAI_API_KEY;
  }
}

// ── Anthropic Client (external) ──────────────────────────────

class AnthropicClient implements LLMClient {
  backend: LLMBackend = LLMBackendConst.ANTHROPIC;

  async chat(request: LLMRequest, _baseUrl: string): Promise<LLMResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: request.model || "claude-sonnet-4-20250514",
        max_tokens: request.maxTokens || 4096,
        messages: request.messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic error (${response.status}): ${error}`);
    }

    const data = await response.json() as any;

    return {
      content: data.content?.[0]?.text || "",
      model: data.model || "unknown",
      backend: LLMBackendConst.ANTHROPIC,
      tokensUsed: data.usage?.input_tokens + data.usage?.output_tokens || 0,
    };
  }

  async isAvailable(_baseUrl: string): Promise<boolean> {
    return !!process.env.ANTHROPIC_API_KEY;
  }
}

// ── LLM Router ───────────────────────────────────────────────

export class LLMRouter {
  private clients: Map<LLMBackend, LLMClient>;
  private vllmUrl: string;
  private ollamaUrl: string;
  private policyEngine: PolicyEngine;

  constructor(policyEngine: PolicyEngine) {
    this.vllmUrl = process.env.VLLM_URL || "http://localhost:8000/v1";
    this.ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
    this.policyEngine = policyEngine;

    this.clients = new Map([
      [LLMBackendConst.VLLM, new VLLMClient()],
      [LLMBackendConst.OLLAMA, new OllamaClient()],
      [LLMBackendConst.OPENAI, new OpenAIClient()],
      [LLMBackendConst.ANTHROPIC, new AnthropicClient()],
    ]);
  }

  /**
   * Main entry point: classify the prompt, apply policies, route to backend.
   */
  async route(
    request: LLMRequest,
    agentConfig: AgentConfig,
    tenantPolicy: SecurityPolicy,
  ): Promise<{ response: LLMResponse; classification: ClassificationResult }> {
    // Step 1: Classify the prompt
    const fullText = request.messages.map((m) => m.content).join("\n");
    const classification = classifyPrompt(fullText);

    // Step 2: Determine allowed backend
    const backend = this.determineBackend(classification, agentConfig, tenantPolicy);

    // Step 3: Scrub PII if routing externally
    let finalMessages = request.messages;
    if (
      backend === LLMBackendConst.OPENAI ||
      backend === LLMBackendConst.ANTHROPIC
    ) {
      if (tenantPolicy.rules.scrubPII && classification.piiDetected.length > 0) {
        finalMessages = this.scrubMessages(request.messages);
      }
    }

    // Step 4: Execute
    const client = this.clients.get(backend);
    if (!client) {
      throw new Error(`No client available for backend: ${backend}`);
    }

    const baseUrl = backend === LLMBackendConst.OLLAMA ? this.ollamaUrl : this.vllmUrl;
    const response = await client.chat(
      { ...request, messages: finalMessages },
      baseUrl,
    );

    return { response, classification };
  }

  /**
   * Determine which LLM backend to use.
   */
  determineBackend(
    classification: ClassificationResult,
    agentConfig: AgentConfig,
    tenantPolicy: SecurityPolicy,
  ): LLMBackend {
    const { sensitivityLevel, recommendedBackend } = classification;

    // If sensitive data detected, only force local if scrubbing is disabled
    if (sensitivityLevel === SensitivityLevel.INTERNAL) {
      if (!tenantPolicy.rules.scrubPII) {
        return this.pickBestLocal();
      }
      // PII scrubbing is enabled — continue to check external routing
    }

    // If external API not allowed by tenant policy
    if (!tenantPolicy.rules.allowExternalAPI) {
      return this.pickBestLocal();
    }

    // If external API not allowed for this agent
    if (!agentConfig.externalApiAllowed) {
      return this.pickBestLocal();
    }

    // Check if any external backend is allowed by policy and agent
    const allowedModels = agentConfig.allowedExternalModels || [];
    const tenantAllowedModels = tenantPolicy.rules.allowedExternalModels || [];
    const allowedExternal = [...allowedModels, ...tenantAllowedModels];

    // If recommended backend is external and allowed, use it
    if (
      recommendedBackend === LLMBackendConst.OPENAI ||
      recommendedBackend === LLMBackendConst.ANTHROPIC
    ) {
      if (allowedExternal.includes(recommendedBackend)) {
        return recommendedBackend;
      }
      return this.pickBestLocal();
    }

    // If the classifier recommends local but external is explicitly allowed,
    // check if any allowed external backend should be preferred
    // (For example, when PII scrubbing enables safe external routing)
    if (allowedExternal.length > 0) {
      // Prefer OpenAI if allowed, otherwise Anthropic
      if (allowedExternal.includes(LLMBackendConst.OPENAI)) {
        return LLMBackendConst.OPENAI;
      }
      if (allowedExternal.includes(LLMBackendConst.ANTHROPIC)) {
        return LLMBackendConst.ANTHROPIC;
      }
    }

    // Default: use local
    return this.pickBestLocal();
  }

  /**
   * Pick the best available local backend.
   */
  pickBestLocal(): LLMBackend {
    // vLLM preferred for production workloads
    return LLMBackendConst.VLLM;
  }

  /**
   * Check which backends are available.
   */
  async checkAvailability(): Promise<Record<LLMBackend, boolean>> {
    const results: Record<string, boolean> = {};
    for (const [backend, client] of this.clients) {
      const baseUrl =
        backend === LLMBackendConst.OLLAMA ? this.ollamaUrl : this.vllmUrl;
      results[backend] = await client.isAvailable(baseUrl);
    }
    return results as Record<LLMBackend, boolean>;
  }

  /**
   * Scrub PII from messages before sending externally.
   */
  private scrubMessages(
    messages: LLMRequest["messages"],
  ): LLMRequest["messages"] {
    return messages.map((m) => ({
      ...m,
      content: this.scrubText(m.content),
    }));
  }

  /**
   * Replace PII with placeholders.
   */
  private scrubText(text: string): string {
    const patterns: Array<{ regex: RegExp; replacement: string }> = [
      { regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: "[EMAIL_REDACTED]" },
      { regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, replacement: "[PHONE_REDACTED]" },
      { regex: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN_REDACTED]" },
      { regex: /\b(?:\d{4}[ -]?){3}\d{4}\b/g, replacement: "[CREDIT_CARD_REDACTED]" },
      { regex: /(?:api[_-]?key|apikey|secret|token|password)[:=]\s*["']?[a-zA-Z0-9_\-.]{20,}["']?/gi, replacement: "[CREDENTIAL_REDACTED]" },
      { regex: /AKIA[0-9A-Z]{16}/g, replacement: "[AWS_KEY_REDACTED]" },
    ];

    let result = text;
    for (const { regex, replacement } of patterns) {
      result = result.replace(regex, replacement);
    }
    return result;
  }
}
