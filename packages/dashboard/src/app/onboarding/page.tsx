"use client";

export default function OnboardingPage() {
  const steps = [
    {
      num: "1",
      title: "Configure Your LLM Backend",
      description: "Connect to vLLM or Ollama for local inference. No data ever leaves your network.",
      action: "Go to Settings → LLM Configuration",
      done: true,
    },
    {
      num: "2",
      title: "Hire Your First Agent",
      description: "Create an AI agent with a specific role — developer assistant, data analyst, support bot, or custom role.",
      action: "Go to Agents → Hire Agent",
      done: false,
    },
    {
      num: "3",
      title: "Set Security Policies",
      description: "Define what agents can and cannot do. Enable PII scrubbing, set external API restrictions, and configure approval gates.",
      action: "Go to Policies → New Policy",
      done: false,
    },
    {
      num: "4",
      title: "Connect Enterprise Systems",
      description: "Link databases, Slack, GitHub, Jira, email, and other systems via MCP connectors.",
      action: "Go to Integrations → Connect",
      done: false,
    },
    {
      num: "5",
      title: "Assign Tasks & Monitor",
      description: "Start assigning work via Paperclip. Monitor agent activity, audit logs, and performance from the dashboard.",
      action: "Open Paperclip → Create Issue",
      done: false,
    },
  ];

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Getting Started</h2>
        <p className="text-[#6c757d] text-sm mt-1">
          Set up your enterprise AI workforce in 5 steps
        </p>
      </div>

      {/* Progress */}
      <div className="card">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-2xl">🚀</span>
          <div>
            <div className="font-semibold">Setup Progress</div>
            <div className="text-xs text-[#6c757d]">1 of 5 steps complete</div>
          </div>
        </div>
        <div className="w-full h-2 rounded-full bg-[#1e1e2e] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#4c6ef5] transition-all duration-500"
            style={{ width: "20%" }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step) => (
          <div
            key={step.num}
            className={`card flex gap-4 transition-all ${
              step.done ? "border-[#40c057]/20 bg-[#40c057]/[0.02]" : ""
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                step.done
                  ? "bg-[#40c057]/20 text-[#40c057]"
                  : "bg-[#1e1e2e] text-[#6c757d]"
              }`}
            >
              {step.done ? "✓" : step.num}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm">{step.title}</h4>
                {step.done && (
                  <span className="badge badge-success text-[10px]">Done</span>
                )}
              </div>
              <p className="text-xs text-[#adb5bd] mt-1">{step.description}</p>
              <p className="text-[11px] text-[#4c6ef5] mt-2 font-medium">
                {step.action} →
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Config */}
      <div className="card">
        <h3 className="font-semibold text-sm mb-3">Environment Status</h3>
        <div className="space-y-2">
          <StatusRow label="vLLM Server" status="pending" detail="Not configured" />
          <StatusRow label="Ollama (Fallback)" status="connected" detail="llama3.1:70b loaded" />
          <StatusRow label="PostgreSQL" status="connected" detail="pgvector ready" />
          <StatusRow label="Paperclip" status="pending" detail="Start Paperclip to begin" />
          <StatusRow label="External API Access" status="disabled" detail="All calls local-only" />
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  label, status, detail,
}: { label: string; status: "connected" | "pending" | "disabled"; detail: string }) {
  const colors = {
    connected: "bg-[#40c057]",
    pending: "bg-[#fab005]",
    disabled: "bg-[#6c757d]",
  };

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-xs text-[#6c757d]">{detail}</span>
    </div>
  );
}
