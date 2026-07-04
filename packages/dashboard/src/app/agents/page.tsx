"use client";

import { useToast } from "@/components/ui/toast";
import { useOpsData } from "@/lib/use-ops-data";

export default function AgentsPage() {
  const { addToast } = useToast();
  const { data, refresh } = useOpsData();
  const active = data.agents.filter((agent) => agent.status === "active").length;
  const idle = data.agents.filter((agent) => agent.status === "idle").length;
  const tasksToday = data.agents.reduce((sum, agent) => sum + agent.tasksToday, 0);
  const skills = data.agents.reduce((sum, agent) => sum + agent.skillsLearned, 0);

  return (
    <div className="p-8 space-y-8 max-w-[1600px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Agents</h2>
          <p className="text-[#6c757d] text-sm mt-1">
            Manage your AI workforce — {data.source === "live" ? "runtime connected" : "demo data"}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              void refresh();
              addToast("success", "Agent data refreshed");
            }}
            className="btn btn-secondary text-sm"
          >
            Refresh
          </button>
          <button
            onClick={() => addToast("success", "Agent hired successfully")}
            className="btn btn-primary text-sm"
          >
            + Hire Agent
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <MiniStat label="Total" value={`${data.agents.length}`} sub="agents" />
        <MiniStat label="Active" value={`${active}`} sub="online" color="green" />
        <MiniStat label="Idle" value={`${idle}`} sub="waiting" color="yellow" />
        <MiniStat label="Tasks Today" value={`${tasksToday}`} sub="completed" />
        <MiniStat label="Skills" value={`${skills}`} sub="learned" color="blue" />
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-2 gap-5">
        {data.agents.map((agent) => (
          <div key={agent.id} className="card group hover:border-[#2a2a3a] transition-all">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#4c6ef5]/10 flex items-center justify-center text-lg group-hover:scale-105 transition-transform">
                  🤖
                </div>
                <div>
                  <h3 className="font-semibold">{agent.name}</h3>
                  <p className="text-xs text-[#6c757d]">{agent.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`badge ${agent.status === "active" ? "badge-success" : agent.status === "idle" ? "badge-warning" : "badge-danger"}`}>
                  {agent.status === "active" ? "● Active" : agent.status === "idle" ? "○ Idle" : "Offline"}
                </span>
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <StatPill label="Model" value={agent.model.split(" / ")[0]} />
              <StatPill label="Today" value={`${agent.tasksToday}`} />
              <StatPill label="Success" value={agent.successRate} highlight />
              <StatPill label="Skills" value={`${agent.skillsLearned}`} />
            </div>

            {/* Config Bar */}
            <div className="flex items-center gap-2 text-[10px] text-[#6c757d] mb-4 font-mono">
              <span>ID: {agent.paperclipId}</span>
              <span>•</span>
              <span>Heartbeat: {agent.heartbeatInterval}</span>
              <span>•</span>
              <span className={agent.externalAllowed ? "text-[#fab005]" : "text-[#40c057]"}>
                {agent.externalAllowed ? "External: Allowed" : "External: Blocked"}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-[#1e1e2e]">
              <div className="text-[11px] text-[#6c757d]">
                {agent.memoryEntries.toLocaleString()} memory entries
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => addToast("info", "Configure agent")} className="btn btn-secondary text-[11px] px-2 py-1">
                  Configure
                </button>
                <button onClick={() => addToast("info", "View agent memory")} className="btn btn-secondary text-[11px] px-2 py-1">
                  Memory
                </button>
                <button onClick={() => addToast("info", "View agent skills")} className="btn btn-secondary text-[11px] px-2 py-1">
                  Skills
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  const colors: Record<string, string> = { green: "text-[#40c057]", yellow: "text-[#fab005]", blue: "text-[#4c6ef5]" };
  return (
    <div className="card text-center py-4">
      <div className={`text-2xl font-bold ${color ? colors[color] : ""}`}>{value}</div>
      <div className="text-xs text-[#6c757d] mt-1">{label}</div>
      <div className="text-[10px] text-[#6c757d]/60">{sub}</div>
    </div>
  );
}

function StatPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="p-2 rounded-lg bg-[#0d0d16] border border-[#1e1e2e] text-center">
      <div className="text-[10px] text-[#6c757d] uppercase tracking-wider">{label}</div>
      <div className={`text-sm font-mono mt-0.5 ${highlight ? "text-[#40c057]" : ""}`}>{value}</div>
    </div>
  );
}
