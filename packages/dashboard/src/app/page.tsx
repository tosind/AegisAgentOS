"use client";

import Link from "next/link";
import { useToast } from "@/components/ui/toast";
import { useOpsData } from "@/lib/use-ops-data";

export default function DashboardPage() {
  const { addToast } = useToast();
  const { data, loading, refresh } = useOpsData();
  const activeAgents = data.agents.filter((agent) => agent.status === "active").length;
  const tasksToday = data.agents.reduce((sum, agent) => sum + agent.tasksToday, 0);
  const blockedEvents = data.auditLogs.filter((event) => event.status === "blocked").length;
  const localBackendCount = Number(data.backends.vllm) + Number(data.backends.ollama);
  const servicesOnline = Object.values(data.serviceHealth).filter(Boolean).length;
  const recentActivity = data.auditLogs.slice(0, 7).map((event) => ({
    time: new Date(event.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    agent: event.agent,
    event: `${event.action.replace(/_/g, " ")}: ${event.target}`,
    type: event.status === "blocked" ? "warning" : event.action.includes("tool") ? "info" : "success",
  }));

  return (
    <div className="p-8 space-y-8 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-[#6c757d] text-sm mt-1">
            Enterprise AI workforce overview —{" "}
            <span className="text-[#40c057] font-medium">
              {data.source === "live" ? `${servicesOnline}/3 services online` : "demo mode"}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#14141f] border border-[#2a2a3a] text-xs">
            <span className={`w-2 h-2 rounded-full ${localBackendCount > 0 ? "bg-[#40c057] animate-pulse" : "bg-[#fab005]"}`} />
            <span className="text-[#adb5bd]">
              {localBackendCount > 0 ? "Local LLM online" : "Local LLM pending"}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#14141f] border border-[#2a2a3a] text-xs">
            <span className="text-[#4c6ef5]">SEC</span>
            <span className="text-[#adb5bd]">{blockedEvents} blocked events</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Active Agents"
          value={`${activeAgents} / ${data.agents.length}`}
          subtext={data.source === "live" ? "runtime backed" : "demo fleet"}
          trend={loading ? "Refreshing..." : "Synced from ops API"}
          icon="◈"
        />
        <StatCard
          label="Tasks Today"
          value={`${tasksToday}`}
          subtext="95.2% success rate"
          trend={`${data.auditLogs.length} audit events loaded`}
          icon="✓"
        />
        <StatCard
          label="Tokens Used"
          value="1.2M"
          subtext="100% local (vLLM + Ollama)"
          trend="$0.00 cost today"
          icon="◉"
          positive
        />
        <StatCard
          label="Security Blocks"
          value={`${blockedEvents}`}
          subtext="PII / credential detections"
          trend="Policy layer enforced"
          icon="🛡"
          positive
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Agent Overview */}
        <div className="col-span-2 card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Agent Fleet</h3>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  void refresh();
                  addToast("success", "Ops data refreshed");
                }}
                className="btn btn-secondary text-xs"
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {data.agents.map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between p-3 rounded-lg border border-[#1e1e2e] hover:border-[#2a2a3a] hover:bg-white/[0.01] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        agent.status === "active" ? "bg-[#40c057]" : agent.status === "idle" ? "bg-[#fab005]" : "bg-[#6c757d]"
                      }`}
                    />
                    {agent.status === "active" && (
                      <div className="absolute inset-0 w-3 h-3 rounded-full bg-[#40c057] animate-ping opacity-30" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{agent.name}</div>
                    <div className="text-[11px] text-[#6c757d]">{agent.role}</div>
                  </div>
                </div>
                <div className="flex items-center gap-6 text-xs">
                  <div className="text-right">
                    <div className="text-[#6c757d]">Today</div>
                    <div className="font-mono font-medium">{agent.tasksToday} tasks</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[#6c757d]">Success</div>
                    <div className="font-mono text-[#40c057]">{agent.successRate}</div>
                  </div>
                  <div className="text-right w-20">
                    <div className="text-[#6c757d]">{agent.lastActive}</div>
                  </div>
                  <div className="badge badge-info text-[10px]">{agent.skillsLearned} skills</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="card">
          <h3 className="font-semibold text-lg mb-4">Live Activity</h3>
          <div className="space-y-0">
            {recentActivity.map((item, i) => (
              <div
                key={i}
                className="flex gap-3 py-2.5 border-b border-[#1e1e2e] last:border-0"
              >
                <span className="text-[10px] font-mono text-[#6c757d] w-10 flex-shrink-0 pt-0.5">
                  {item.time}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-medium">{item.agent}</div>
                  <div
                    className={`text-xs mt-0.5 ${
                      item.type === "success"
                        ? "text-[#adb5bd]"
                        : item.type === "warning"
                        ? "text-[#fab005]"
                        : "text-[#4c6ef5]"
                    }`}
                  >
                    {item.event}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        <QuickAction
          title="Hire a New Agent"
          description="Create a new AI agent for your team"
          icon="🤖"
          href="/agents?action=hire"
        />
        <QuickAction
          title="Connect a Database"
          description="Link PostgreSQL, MySQL, or other data sources"
          icon="🗄"
          href="/integrations?action=connect"
        />
        <QuickAction
          title="Review Security"
          description="Check audit logs and security policies"
          icon="🛡"
          href="/audit"
        />
      </div>
    </div>
  );
}

function StatCard({
  label, value, subtext, trend, icon, positive,
}: {
  label: string; value: string; subtext: string; trend: string; icon: string; positive?: boolean;
}) {
  return (
    <div className="card hover:border-[#2a2a3a] transition-all">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[#6c757d] text-sm">{label}</span>
        <span className="text-lg opacity-60">{icon}</span>
      </div>
      <div className="text-2xl font-bold mb-1 tracking-tight">{value}</div>
      <div className="text-xs text-[#6c757d]">{subtext}</div>
      <div
        className={`text-[11px] mt-2 font-medium ${
          positive ? "text-[#40c057]" : "text-[#adb5bd]"
        }`}
      >
        {trend}
      </div>
    </div>
  );
}

function QuickAction({
  title, description, icon, href,
}: { title: string; description: string; icon: string; href: string }) {
  return (
    <Link
      href={href}
      className="card flex items-center gap-4 hover:border-[#4c6ef5]/30 hover:bg-[#4c6ef5]/[0.02] transition-all group cursor-pointer"
    >
      <span className="text-2xl group-hover:scale-110 transition-transform">
        {icon}
      </span>
      <div>
        <div className="font-medium text-sm group-hover:text-[#4c6ef5] transition-colors">
          {title}
        </div>
        <div className="text-xs text-[#6c757d] mt-0.5">{description}</div>
      </div>
      <span className="ml-auto text-[#6c757d] group-hover:translate-x-1 transition-transform">
        →
      </span>
    </Link>
  );
}
