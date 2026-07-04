"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Cable,
  Cpu,
  Database,
  Gauge,
  LockKeyhole,
  Network,
  RefreshCw,
  ShieldCheck,
  TerminalSquare,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { useOpsData } from "@/lib/use-ops-data";

const serviceLabels = {
  agentRuntime: "Agent Runtime",
  securityLayer: "Security Layer",
  mcpHub: "MCP Hub",
};

export default function DashboardPage() {
  const { addToast } = useToast();
  const { data, loading, refresh } = useOpsData();
  const activeAgents = data.agents.filter((agent) => agent.status === "active").length;
  const tasksToday = data.agents.reduce((sum, agent) => sum + agent.tasksToday, 0);
  const blockedEvents = data.auditLogs.filter((event) => event.status === "blocked").length;
  const servicesOnline = Object.values(data.serviceHealth).filter(Boolean).length;
  const localBackendCount = Number(data.backends.vllm) + Number(data.backends.ollama);
  const connectedSystems = data.connections.filter((conn) => conn.status === "connected").length;

  return (
    <div className="min-h-screen max-w-[1720px] space-y-5 px-4 py-5 sm:px-6 lg:space-y-6 lg:px-8 lg:py-7">
      <header className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-start">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[#8a8171] sm:gap-3">
            <span className="badge badge-warning text-[10px] px-2 py-0.5">Aegis Alpha</span>
            <span>Hermes-grade operator surface</span>
            <span className="hidden text-[#332d20] sm:inline">/</span>
            <span className="basis-full sm:basis-auto">{data.source === "live" ? "Live stack" : "Demo telemetry"}</span>
          </div>
          <h2 className="max-w-[20rem] text-3xl font-semibold leading-tight text-[#f5f0e4] sm:max-w-none sm:text-[2.15rem]">
            <span className="block sm:inline">Enterprise agent</span>
            <span className="block sm:inline"> command center</span>
          </h2>
          <p className="mt-2 max-w-[19.5rem] break-words text-sm text-[#c8bea9] sm:max-w-3xl">
            Paperclip orchestration, local LLM routing, MCP connectors, and audit-first policy control in one cockpit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              void refresh();
              addToast("success", "Aegis telemetry refreshed");
            }}
            className="btn btn-secondary text-sm"
          >
            <RefreshCw size={15} />
            {loading ? "Syncing" : "Refresh"}
          </button>
          <Link href="/audit" className="btn btn-primary text-sm">
            <ShieldCheck size={15} />
            Review Audit
          </Link>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile
          icon={UsersRound}
          label="Active Agents"
          value={`${activeAgents}/${data.agents.length}`}
          detail={data.source === "live" ? "runtime synchronized" : "demo fleet loaded"}
          tone="gold"
        />
        <MetricTile
          icon={TerminalSquare}
          label="Tasks Today"
          value={`${tasksToday}`}
          detail={`${data.auditLogs.length} audit events available`}
          tone="cyan"
        />
        <MetricTile
          icon={LockKeyhole}
          label="Policy Blocks"
          value={`${blockedEvents}`}
          detail="PII and credential guardrails"
          tone="red"
        />
        <MetricTile
          icon={Cable}
          label="Connected Systems"
          value={`${connectedSystems}/${data.connections.length}`}
          detail="MCP-backed tools"
          tone="green"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-0 overflow-hidden">
          <div className="px-5 py-4 border-b border-[#332d20] flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Agent Fleet</h3>
              <p className="text-xs text-[#8a8171] mt-1">Heartbeat posture, local model routing, and skill growth</p>
            </div>
            <Link href="/agents" className="text-xs text-[#e3a21a] flex items-center gap-1">
              Manage <ArrowUpRight size={13} />
            </Link>
          </div>
          <div className="divide-y divide-[#332d20]/70">
            {data.agents.map((agent, index) => (
              <div key={agent.id} className="grid gap-4 px-5 py-4 transition-colors hover:bg-[#e3a21a]/[0.035] sm:grid-cols-[auto_1fr] xl:grid-cols-[auto_1fr_auto]">
                <div className={`w-10 h-10 rounded-lg border flex items-center justify-center mono text-xs font-bold ${agent.status === "active" ? "border-[#3aa35c]/45 text-[#77d28d] bg-[#3aa35c]/10" : agent.status === "idle" ? "border-[#e3a21a]/45 text-[#f2c566] bg-[#e3a21a]/10" : "border-[#8a8171]/35 text-[#8a8171] bg-white/[0.02]"}`}>
                  A{index + 1}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm">{agent.name}</h4>
                    <span className={`badge text-[10px] px-2 py-0.5 ${agent.status === "active" ? "badge-success" : agent.status === "idle" ? "badge-warning" : "badge-danger"}`}>
                      {agent.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#8a8171] mt-1">{agent.role}</p>
                  <div className="mt-3 h-1.5 bg-[#090907] border border-[#332d20] rounded overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#e3a21a] via-[#4fbcba] to-[#3aa35c]"
                      style={{ width: `${Math.min(100, 24 + agent.skillsLearned * 4)}%` }}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-left text-xs sm:col-span-2 xl:col-span-1 xl:text-right">
                  <MiniReadout label="Today" value={`${agent.tasksToday}`} />
                  <MiniReadout label="Success" value={agent.successRate} good />
                  <MiniReadout label="Skills" value={`${agent.skillsLearned}`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">Stack Health</h3>
              <span className={`badge text-[10px] ${servicesOnline === 3 ? "badge-success" : "badge-warning"}`}>
                {servicesOnline}/3 online
              </span>
            </div>
            <div className="space-y-3">
              {Object.entries(data.serviceHealth).map(([key, online]) => (
                <div key={key} className="panel px-3 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full ${online ? "bg-[#3aa35c]" : "bg-[#e3a21a]"}`} />
                    <span className="text-sm">{serviceLabels[key as keyof typeof serviceLabels]}</span>
                  </div>
                  <span className="mono text-xs text-[#8a8171]">{online ? "online" : "pending"}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Cpu size={18} className="text-[#4fbcba]" />
              <h3 className="font-semibold text-lg">Model Routing</h3>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <BackendCell label="vLLM" online={!!data.backends.vllm} />
              <BackendCell label="Ollama" online={!!data.backends.ollama} />
              <BackendCell label="OpenAI" online={!!data.backends.openai} external />
              <BackendCell label="Anthropic" online={!!data.backends.anthropic} external />
            </div>
            <p className="text-xs text-[#8a8171] mt-4">
              {localBackendCount > 0 ? "Local inference is available for sensitive work." : "Local inference is waiting for a backend."}
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <Database size={18} className="text-[#e3a21a]" />
            <h3 className="font-semibold text-lg">Connected Surface</h3>
          </div>
          <div className="space-y-2">
            {data.connections.map((conn) => (
              <div key={conn.name} className="panel px-3 py-3 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{conn.name}</div>
                  <div className="text-[11px] text-[#8a8171]">{conn.type}</div>
                </div>
                <div className="text-right">
                  <div className={`mono text-xs ${conn.status === "connected" ? "text-[#77d28d]" : "text-[#8a8171]"}`}>{conn.status}</div>
                  <div className="text-[11px] text-[#8a8171]">{conn.tools} tools</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[#332d20] px-5 py-4">
            <div className="flex items-center gap-2">
              <Activity size={18} className="text-[#4fbcba]" />
              <h3 className="font-semibold text-lg">Audit Stream</h3>
            </div>
            <span className="text-xs text-[#8a8171]">Immutable action log</span>
          </div>
          <div className="divide-y divide-[#332d20]/70">
            {data.auditLogs.slice(0, 7).map((event) => (
              <div key={event.id} className="grid gap-2 px-5 py-3 transition-colors hover:bg-white/[0.018] sm:grid-cols-[5rem_1fr_auto] sm:items-center sm:gap-4">
                <span className="mono text-xs text-[#8a8171]">
                  {new Date(event.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{event.target}</div>
                  <div className="text-[11px] text-[#8a8171]">{event.agent} / {event.backend}</div>
                </div>
                <span className={`badge text-[10px] px-2 py-0.5 ${event.status === "blocked" ? "badge-danger" : event.action.includes("tool") ? "badge-info" : "badge-success"}`}>
                  {event.action.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <QuickAction title="Hire an Agent" description="Create a governed worker and bind it to Paperclip." icon={UsersRound} href="/agents?action=hire" />
        <QuickAction title="Connect Systems" description="Add MCP-backed data, code, and communication tools." icon={Network} href="/integrations?action=connect" />
        <QuickAction title="Tune Policy" description="Review local routing, approvals, and PII controls." icon={ShieldCheck} href="/policies" />
      </section>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "gold" | "cyan" | "green" | "red";
}) {
  const colors = {
    gold: "text-[#e3a21a] bg-[#e3a21a]/10 border-[#e3a21a]/25",
    cyan: "text-[#4fbcba] bg-[#4fbcba]/10 border-[#4fbcba]/25",
    green: "text-[#77d28d] bg-[#3aa35c]/10 border-[#3aa35c]/25",
    red: "text-[#ff8b6b] bg-[#e94b27]/10 border-[#e94b27]/25",
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <span className={`w-9 h-9 rounded-lg border flex items-center justify-center ${colors[tone]}`}>
          <Icon size={18} />
        </span>
        <Gauge size={16} className="text-[#332d20]" />
      </div>
      <div className="text-xs text-[#8a8171]">{label}</div>
      <div className="text-3xl font-semibold mt-1">{value}</div>
      <div className="text-xs text-[#c8bea9] mt-2">{detail}</div>
    </div>
  );
}

function MiniReadout({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div>
      <div className="text-[#8a8171]">{label}</div>
      <div className={`mono font-medium mt-1 ${good ? "text-[#77d28d]" : "text-[#f5f0e4]"}`}>{value}</div>
    </div>
  );
}

function BackendCell({ label, online, external }: { label: string; online: boolean; external?: boolean }) {
  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between">
        <span className="mono text-sm">{label}</span>
        <span className={`w-2 h-2 rounded-full ${online ? "bg-[#3aa35c]" : external ? "bg-[#8a8171]" : "bg-[#e3a21a]"}`} />
      </div>
      <div className="text-[11px] text-[#8a8171] mt-2">
        {online ? "available" : external ? "policy gated" : "not ready"}
      </div>
    </div>
  );
}

function QuickAction({
  title,
  description,
  icon: Icon,
  href,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="card flex items-center gap-4 hover:border-[#5d4b23] hover:bg-[#e3a21a]/[0.035] transition-all group"
    >
      <span className="w-10 h-10 rounded-lg bg-[#090907] border border-[#332d20] flex items-center justify-center text-[#e3a21a] group-hover:border-[#e3a21a]/40">
        <Icon size={18} />
      </span>
      <div className="min-w-0">
        <div className="font-medium text-sm group-hover:text-[#f2c566] transition-colors">{title}</div>
        <div className="text-xs text-[#8a8171] mt-1">{description}</div>
      </div>
      <ArrowUpRight size={16} className="ml-auto text-[#8a8171] group-hover:text-[#e3a21a]" />
    </Link>
  );
}
