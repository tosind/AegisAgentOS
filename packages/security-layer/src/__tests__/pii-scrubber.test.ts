// ── PII Scrubber Tests ─────────────────────────────────────────

import { describe, it, expect } from "vitest";
import { classifyPrompt, scrubPII, maskPII } from "../pii-scrubber.js";
import { SensitivityLevel } from "@enterprise/shared";

describe("classifyPrompt", () => {
  it("should detect emails and classify as INTERNAL", () => {
    const result = classifyPrompt("Contact john.doe@company.com for details");
    expect(result.sensitivityLevel).toBe(SensitivityLevel.INTERNAL);
    expect(result.piiDetected.some((p) => p.patternName === "email")).toBe(true);
    expect(result.requiresApproval).toBe(true);
  });

  it("should detect US phone numbers", () => {
    const result = classifyPrompt("Call 555-123-4567 for support");
    expect(result.piiDetected.some((p) => p.patternName === "phone_us")).toBe(true);
  });

  it("should detect SSNs", () => {
    const result = classifyPrompt("SSN: 123-45-6789 needs verification");
    expect(result.piiDetected.some((p) => p.patternName === "ssn")).toBe(true);
  });

  it("should detect credit card numbers", () => {
    const result = classifyPrompt("Card: 4111-1111-1111-1111");
    expect(result.piiDetected.some((p) => p.patternName === "credit_card")).toBe(true);
  });

  it("should detect API keys", () => {
    const result = classifyPrompt('api_key: "sk-abcdefghijklmnopqrstuvwxyz123456"');
    expect(result.piiDetected.some((p) => p.patternName === "api_key")).toBe(true);
  });

  it("should detect AWS access keys", () => {
    const result = classifyPrompt("AWS key: AKIAIOSFODNN7EXAMPLE");
    expect(result.piiDetected.some((p) => p.patternName === "aws_key")).toBe(true);
  });

  it("should detect IP addresses", () => {
    const result = classifyPrompt("Server at 192.168.1.100 is down");
    expect(result.piiDetected.some((p) => p.patternName === "ip_address")).toBe(true);
  });

  it("should detect JWT tokens", () => {
    const result = classifyPrompt(
      "Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U",
    );
    expect(result.piiDetected.some((p) => p.patternName === "jwt_token")).toBe(true);
  });

  it("should detect sensitive keywords", () => {
    const result = classifyPrompt("This contains confidential customer data and passwords");
    expect(result.sensitivityLevel).toBe(SensitivityLevel.INTERNAL);
    expect(result.requiresApproval).toBe(true);
  });

  it("should classify clean text as SCRUBBED", () => {
    const result = classifyPrompt("Write a function to sort an array");
    expect(result.sensitivityLevel).toBe(SensitivityLevel.SCRUBBED);
    expect(result.piiDetected).toHaveLength(0);
    expect(result.requiresApproval).toBe(false);
  });

  it("should detect multiple PII types in one text", () => {
    const text = "Email admin@corp.com, SSN 987-65-4321, card 5500-0000-0000-0004";
    const result = classifyPrompt(text);
    expect(result.piiDetected.length).toBeGreaterThanOrEqual(3);
  });
});

describe("scrubPII", () => {
  it("should replace emails with placeholder", () => {
    const result = scrubPII("Contact john.doe@company.com now");
    expect(result).toBe("Contact [EMAIL_REDACTED] now");
  });

  it("should replace phone numbers", () => {
    const result = scrubPII("Call 555-123-4567 for help");
    expect(result).toBe("Call [PHONE_US_REDACTED] for help");
  });

  it("should replace SSNs", () => {
    const result = scrubPII("SSN is 123-45-6789");
    expect(result).toBe("SSN is [SSN_REDACTED]");
  });

  it("should replace credit cards", () => {
    const result = scrubPII("Card 4111-1111-1111-1111 charged");
    expect(result).toBe("Card [CREDIT_CARD_REDACTED] charged");
  });

  it("should replace API keys", () => {
    const result = scrubPII('api_key: "sk-proj-abcdefghijklmnopqrstuvwxyz"');
    expect(result).toContain("[API_KEY_REDACTED]");
  });

  it("should leave clean text unchanged", () => {
    const text = "This is a normal message about code";
    expect(scrubPII(text)).toBe(text);
  });

  it("should handle multiple replacements", () => {
    const text = "Email a@b.com, phone 123-456-7890, IP 10.0.0.1";
    const result = scrubPII(text);
    expect(result).toContain("[EMAIL_REDACTED]");
    expect(result).toContain("[PHONE_US_REDACTED]");
    expect(result).toContain("[IP_ADDRESS_REDACTED]");
  });
});

describe("maskPII", () => {
  it("should partially mask emails", () => {
    const result = maskPII("Contact john.doe@company.com");
    expect(result).toMatch(/j\*+\w@company\.com/);
  });

  it("should partially mask phone numbers", () => {
    const result = maskPII("Call 555-123-4567");
    expect(result).toContain("***-***-4567");
  });

  it("should partially mask credit cards", () => {
    const result = maskPII("Card: 4111-1111-1111-1111");
    expect(result).toContain("****-****-****-1111");
  });

  it("should leave clean text unchanged", () => {
    const text = "No PII here at all";
    expect(maskPII(text)).toBe(text);
  });
});
