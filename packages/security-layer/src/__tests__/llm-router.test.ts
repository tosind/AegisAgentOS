// ── LLM Router Tests ───────────────────────────────────────────

import { describe, it, expect, vi, beforeEach } from "vitest";
import { LLMRouter } from "../llm-router.js";
import { PolicyEngine } from "../policy-engine.js";
import { SensitivityLevel, LLMBackend } from "@enterprise/shared";
import type { ClassificationResult, AgentConfig, SecurityPolicy } from "@enterprise/shared";

// Mock fetch for LLM clients
const mockFetch = vi.fn();
global.fetch = mockFetch;

const defaultPolicy: SecurityPolicy = {
  id: "policy-1",
  tenantId: "tenant-1",
  name: "Test Policy",
  rules: {
    allowExternalAPI: false,
    allowedExternalModels: [],
    scrubPII: true,
    piiPatterns: ["email", "phone", "ssn"],
    maxTokensPerRequest: 32768,
    requireApprovalFor: ["deploy", "financial"],
    auditLevel: "all",
  },
  priority: 0,
  enabled: true,
};

const defaultAgent: AgentConfig = {
  id: "agent-1",
  tenantId: "tenant-1",
  name: "Test Agent",
  role: "assistant",
  llmPreferences: {
    defaultModel: "local",
    fallbackModel: "ollama",
    maxTokens: 32768,
    temperature: 0.7,
  },
  toolPermissions: {
    allowedTools: ["*"],
    deniedTools: [],
  },
  externalApiAllowed: false,
  allowedExternalModels: [],
  skillLearningEnabled: true,
  memoryEnabled: true,
  heartbeatIntervalSec: 300,
};

const sensitiveClassification: ClassificationResult = {
  sensitivityLevel: SensitivityLevel.INTERNAL,
  piiDetected: [
    {
      patternName: "email",
      matches: [{ value: "test@example.com", startIndex: 0, endIndex: 16 }],
      strategy: "redact",
    },
  ],
  recommendedBackend: LLMBackend.VLLM,
  requiresApproval: true,
  approvalReasons: ["PII detected — external routing blocked"],
};

const cleanClassification: ClassificationResult = {
  sensitivityLevel: SensitivityLevel.SCRUBBED,
  piiDetected: [],
  recommendedBackend: LLMBackend.VLLM,
  requiresApproval: false,
  approvalReasons: [],
};

describe("LLMRouter", () => {
  let router: LLMRouter;
  let policyEngine: PolicyEngine;

  beforeEach(() => {
    policyEngine = new PolicyEngine();
    router = new LLMRouter(policyEngine);
    mockFetch.mockReset();
  });

  describe("determineBackend", () => {
    it("should force local when PII is detected", () => {
      const backend = router.determineBackend(
        sensitiveClassification,
        defaultAgent,
        defaultPolicy,
      );
      expect(backend).toBe(LLMBackend.VLLM);
    });

    it("should force local when external API is disabled in policy", () => {
      const policy: SecurityPolicy = {
        ...defaultPolicy,
        rules: { ...defaultPolicy.rules, allowExternalAPI: false },
      };

      const classification: ClassificationResult = {
        ...cleanClassification,
        recommendedBackend: LLMBackend.OPENAI,
      };

      const backend = router.determineBackend(classification, defaultAgent, policy);
      expect(backend).toBe(LLMBackend.VLLM);
    });

    it("should force local when agent has external API disabled", () => {
      const policy: SecurityPolicy = {
        ...defaultPolicy,
        rules: { ...defaultPolicy.rules, allowExternalAPI: true, allowedExternalModels: ["openai"] },
      };

      const agent: AgentConfig = {
        ...defaultAgent,
        externalApiAllowed: false,
      };

      const classification: ClassificationResult = {
        ...cleanClassification,
        recommendedBackend: LLMBackend.OPENAI,
      };

      const backend = router.determineBackend(classification, agent, policy);
      expect(backend).toBe(LLMBackend.VLLM);
    });

    it("should allow external when both policy and agent permit it", () => {
      const policy: SecurityPolicy = {
        ...defaultPolicy,
        rules: { ...defaultPolicy.rules, allowExternalAPI: true, allowedExternalModels: ["openai"] },
      };

      const agent: AgentConfig = {
        ...defaultAgent,
        externalApiAllowed: true,
        allowedExternalModels: ["openai"],
      };

      const classification: ClassificationResult = {
        ...cleanClassification,
        recommendedBackend: LLMBackend.OPENAI,
      };

      const backend = router.determineBackend(classification, agent, policy);
      expect(backend).toBe(LLMBackend.OPENAI);
    });

    it("should default to local for clean tasks", () => {
      const backend = router.determineBackend(
        cleanClassification,
        defaultAgent,
        defaultPolicy,
      );
      expect(backend).toBe(LLMBackend.VLLM);
    });
  });

  describe("pickBestLocal", () => {
    it("should prefer vLLM over Ollama", () => {
      expect(router.pickBestLocal()).toBe(LLMBackend.VLLM);
    });
  });

  describe("route", () => {
    it("should scrub PII when routing to external API", async () => {
      const policy: SecurityPolicy = {
        ...defaultPolicy,
        rules: { ...defaultPolicy.rules, allowExternalAPI: true, allowedExternalModels: ["openai"] },
      };

      const agent: AgentConfig = {
        ...defaultAgent,
        externalApiAllowed: true,
        allowedExternalModels: ["openai"],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "Hello [EMAIL_REDACTED]" } }],
          model: "gpt-4o",
          usage: { total_tokens: 50 },
        }),
      });

      // Use try/finally to ensure env var is always cleaned up
      process.env.OPENAI_API_KEY = "test-key";
      try {
        const result = await router.route(
          {
            messages: [{ role: "user", content: "Email user@company.com about the meeting" }],
          },
          agent,
          policy,
        );

        expect(result.classification.sensitivityLevel).toBe(SensitivityLevel.INTERNAL);
        expect(result.response.backend).toBe(LLMBackend.OPENAI);
      } finally {
        delete process.env.OPENAI_API_KEY;
      }
    });
  });
});
