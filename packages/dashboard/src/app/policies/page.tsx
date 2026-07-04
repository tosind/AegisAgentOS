"use client";

import { useToast } from "@/components/ui/toast";

export default function PoliciesPage() {
  const { addToast } = useToast();

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Security Policies</h2>
          <p className="text-[#6c757d] text-sm mt-1">Define what agents can and cannot do</p>
        </div>
        <button
          onClick={() => addToast("info", "New policy form coming soon")}
          className="btn btn-primary text-sm"
        >
          + New Policy
        </button>
      </div>

      {/* Default Policy */}
      <div className="card border-[#4c6ef5]/20">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4c6ef5]/10 flex items-center justify-center">
              <span className="text-lg">🛡</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Default Enterprise Policy</h3>
                <span className="badge badge-success text-[10px]">Active</span>
                <span className="badge badge-info text-[10px]">Priority 0</span>
              </div>
              <p className="text-xs text-[#adb5bd] mt-1">Local-first, no external API calls, auto-scrub PII</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => addToast("info", "Edit policy")} className="btn btn-secondary text-xs">Edit</button>
            <button onClick={() => addToast("success", "Policy duplicated")} className="btn btn-secondary text-xs">Duplicate</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <RuleBox icon="🌐" label="External API Calls" value="Blocked" detail="All LLM calls use local vLLM/Ollama" negative />
          <RuleBox icon="🔍" label="PII Scrubbing" value="Enabled" detail="Scrubs: email, phone, SSN, credit card, API keys, AWS keys" positive />
          <RuleBox icon="✋" label="Approval Required" value="Yes" detail="For: deploy, financial, external_api_call" />
          <RuleBox icon="📋" label="Audit Level" value="All" detail="Every action is logged immutably" />
          <RuleBox icon="🔢" label="Max Tokens" value="32,768" detail="Per request limit" />
          <RuleBox icon="⏱" label="Heartbeat Interval" value="300s" detail="5 minutes default" />
        </div>

        <div className="mt-4 flex items-center justify-between pt-4 border-t border-[#1e1e2e]">
          <div className="text-xs text-[#6c757d]">Applied to all agents by default</div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-xs text-[#adb5bd]">Override per-agent</span>
            <Toggle />
          </label>
        </div>
      </div>

      {/* PII Patterns */}
      <div className="card">
        <h3 className="font-semibold text-lg mb-4">PII Detection Patterns</h3>
        <div className="space-y-2">
          {[
            { name: "Email", pattern: "[a-zA-Z0-9._%+-]+@[...]", strategy: "Mask", active: true },
            { name: "Phone (US)", pattern: "\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b", strategy: "Mask", active: true },
            { name: "SSN", pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b", strategy: "Redact", active: true },
            { name: "Credit Card", pattern: "\\b(?:\\d{4}[ -]?){3}\\d{4}\\b", strategy: "Redact", active: true },
            { name: "API Keys", pattern: "(?:api_key|secret|token)...", strategy: "Redact", active: true },
            { name: "AWS Keys", pattern: "AKIA[0-9A-Z]{16}", strategy: "Redact", active: true },
            { name: "JWT Tokens", pattern: "eyJ...", strategy: "Redact", active: true },
            { name: "IP Addresses", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b", strategy: "Mask", active: false },
          ].map((p) => (
            <div key={p.name} className="flex items-center justify-between p-3 rounded-lg border border-[#1e1e2e] hover:border-[#2a2a3a] transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${p.active ? "bg-[#40c057]" : "bg-[#6c757d]"}`} />
                <div>
                  <div className="font-medium text-sm">{p.name}</div>
                  <div className="text-[10px] text-[#6c757d] font-mono mt-0.5">{p.pattern}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`badge text-[10px] ${p.strategy === "Redact" ? "badge-danger" : "badge-warning"}`}>
                  {p.strategy}
                </span>
                <Toggle active={p.active} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RuleBox({ icon, label, value, detail, positive, negative }: {
  icon: string; label: string; value: string; detail: string; positive?: boolean; negative?: boolean;
}) {
  const valColor = positive ? "text-[#40c057]" : negative ? "text-[#f03e3e]" : "";
  return (
    <div className="p-3 rounded-lg bg-[#0d0d16] border border-[#1e1e2e]">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs">{icon}</span>
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={`font-bold text-sm ${valColor}`}>{value}</div>
      <div className="text-[10px] text-[#6c757d] mt-0.5">{detail}</div>
    </div>
  );
}

function Toggle({ active = false }: { active?: boolean }) {
  return (
    <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${active ? "bg-[#4c6ef5]" : "bg-[#2a2a3a]"}`}>
      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${active ? "translate-x-4" : "translate-x-0"}`} />
    </div>
  );
}
