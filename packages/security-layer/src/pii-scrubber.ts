// ── PII Scrubber ───────────────────────────────────────────────
// Detects and scrubs PII from prompts before they leave the network.

import type {
  PIIDetection,
  ClassificationResult,
} from "@enterprise/shared";
import { SensitivityLevel, LLMBackend } from "@enterprise/shared";

// ── PII Detection Patterns ───────────────────────────────────

const PII_PATTERNS: Array<{
  name: string;
  regex: RegExp;
  isSensitive: boolean;
}> = [
  { name: "email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, isSensitive: true },
  { name: "phone_us", regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, isSensitive: true },
  { name: "ssn", regex: /\b\d{3}-\d{2}-\d{4}\b/g, isSensitive: true },
  { name: "credit_card", regex: /\b(?:\d{4}[ -]?){3}\d{4}\b/g, isSensitive: true },
  { name: "api_key", regex: /(?:api[_-]?key|apikey|secret|token|password)\s*[:=]\s*["']?[a-zA-Z0-9_\-.]{20,}["']?/gi, isSensitive: true },
  { name: "aws_key", regex: /AKIA[0-9A-Z]{16}/g, isSensitive: true },
  { name: "ip_address", regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g, isSensitive: false },
  { name: "jwt_token", regex: /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g, isSensitive: true },
];

// ── Sensitivity Keywords ─────────────────────────────────────

const SENSITIVE_KEYWORDS = [
  "password", "credential", "secret", "token", "private key",
  "social security", "ssn", "credit card", "bank account",
  "patient", "medical record", "hipaa", "phi",
  "proprietary", "confidential", "classified", "internal only",
  "customer data", "user data", "pii",
];

// ── Classification ───────────────────────────────────────────

/**
 * Classify a prompt's sensitivity level and detect PII.
 */
export function classifyPrompt(text: string): ClassificationResult {
  const piiDetected = detectPII(text);
  const hasSensitivePII = piiDetected.some((p) =>
    PII_PATTERNS.find((pat) => pat.name === p.patternName)?.isSensitive,
  );
  const hasSensitiveKeywords = SENSITIVE_KEYWORDS.some((kw) =>
    text.toLowerCase().includes(kw.toLowerCase()),
  );

  let sensitivityLevel: SensitivityLevel;
  let recommendedBackend = LLMBackend.VLLM;
  const approvalReasons: string[] = [];

  if (hasSensitivePII) {
    sensitivityLevel = SensitivityLevel.INTERNAL;
    recommendedBackend = LLMBackend.VLLM;
    approvalReasons.push("PII detected — external routing blocked");
  } else if (hasSensitiveKeywords) {
    sensitivityLevel = SensitivityLevel.INTERNAL;
    recommendedBackend = LLMBackend.VLLM;
    approvalReasons.push("Sensitive keywords detected");
  } else {
    sensitivityLevel = SensitivityLevel.SCRUBBED;
    recommendedBackend = LLMBackend.VLLM;
  }

  return {
    sensitivityLevel,
    piiDetected,
    recommendedBackend,
    requiresApproval: hasSensitivePII || hasSensitiveKeywords,
    approvalReasons,
  };
}

/**
 * Detect PII in text using regex patterns.
 */
function detectPII(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];

  for (const pattern of PII_PATTERNS) {
    const matches = [...text.matchAll(pattern.regex)];
    if (matches.length > 0) {
      detections.push({
        patternName: pattern.name,
        matches: matches.map((m) => ({
          value: m[0],
          startIndex: m.index || 0,
          endIndex: (m.index || 0) + m[0].length,
        })),
        strategy: pattern.isSensitive ? "redact" : "mask",
      });
    }
  }

  return detections;
}

/**
 * Scrub PII from text, replacing with placeholder markers.
 */
export function scrubPII(text: string): string {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern.regex, (match) => {
      return `[${pattern.name.toUpperCase()}_REDACTED]`;
    });
  }
  return result;
}

/**
 * Mask PII (keep partial info) instead of full redaction.
 */
export function maskPII(text: string): string {
  let result = text;

  // Email: j***@domain.com
  result = result.replace(
    /([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*([a-zA-Z0-9._%+-]@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    "$1***$2",
  );

  // Phone: ***-***-1234
  result = result.replace(/\b\d{3}[-.]?\d{3}[-.]?(\d{4})\b/g, "***-***-$1");

  // Credit card: ****-****-****-1234
  result = result.replace(/\b(?:\d{4}[ -]?){3}(\d{4})\b/g, "****-****-****-$1");

  return result;
}
