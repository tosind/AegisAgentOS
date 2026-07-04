"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/toast";
import { useOpsData } from "@/lib/use-ops-data";

export default function AuditPage() {
  const { addToast } = useToast();
  const { data, refresh } = useOpsData();
  const [filter, setFilter] = useState("all");
  const [agentFilter, setAgentFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filteredLogs = data.auditLogs.filter((log) => {
    if (filter !== "all" && log.action !== filter) return false;
    if (agentFilter !== "all" && log.agent !== agentFilter) return false;
    if (search && !log.target.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const agentNames = Array.from(new Set(data.auditLogs.map((log) => log.agent)));

  return (
    <div className="p-8 space-y-6 max-w-[1800px]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Audit Logs</h2>
          <p className="text-[#6c757d] text-sm mt-1">
            Immutable record of all agent actions —{" "}
            <span className="text-[#40c057] font-medium">
              {data.auditLogs.length} events loaded from {data.source}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => addToast("success", "Audit log exported")} className="btn btn-secondary text-sm">
            Export CSV
          </button>
          <button
            onClick={() => {
              void refresh();
              addToast("success", "Audit log refreshed");
            }}
            className="btn btn-secondary text-sm"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search targets..."
          className="bg-[#14141f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm w-64 focus:border-[#4c6ef5] focus:outline-none"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-[#14141f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#adb5bd]"
        >
          <option value="all">All Actions</option>
          <option value="llm_call">LLM Calls</option>
          <option value="llm_call_blocked">Blocked Calls</option>
          <option value="tool_call">Tool Calls</option>
          <option value="file_scan">File Scans</option>
        </select>
        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="bg-[#14141f] border border-[#2a2a3a] rounded-lg px-3 py-2 text-sm text-[#adb5bd]"
        >
          <option value="all">All Agents</option>
          {agentNames.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
        <span className="text-xs text-[#6c757d]">{filteredLogs.length} results</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2a3a] bg-[#0d0d16]/50">
              <th className="text-left py-3 px-4 text-[11px] font-medium text-[#6c757d] uppercase tracking-wider">Time</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-[#6c757d] uppercase tracking-wider">Agent</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-[#6c757d] uppercase tracking-wider">Action</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-[#6c757d] uppercase tracking-wider">Target</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-[#6c757d] uppercase tracking-wider">Level</th>
              <th className="text-left py-3 px-4 text-[11px] font-medium text-[#6c757d] uppercase tracking-wider">Backend</th>
              <th className="text-right py-3 px-4 text-[11px] font-medium text-[#6c757d] uppercase tracking-wider">Tokens</th>
              <th className="text-right py-3 px-4 text-[11px] font-medium text-[#6c757d] uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id} className="border-b border-[#1e1e2e] hover:bg-white/[0.01] transition-colors">
                <td className="py-2.5 px-4 font-mono text-xs text-[#adb5bd]">
                  {new Date(log.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </td>
                <td className="py-2.5 px-4 font-medium text-xs">{log.agent}</td>
                <td className="py-2.5 px-4">
                  <span className={`badge text-[10px] ${
                    log.status === "blocked" ? "badge-danger" : log.action === "tool_call" ? "badge-info" : "badge-success"
                  }`}>{log.action.replace(/_/g, " ")}</span>
                </td>
                <td className="py-2.5 px-4 text-xs text-[#adb5bd] max-w-xs truncate">{log.target}</td>
                <td className="py-2.5 px-4">
                  <span className={`badge text-[10px] ${log.sensitivity === "internal" ? "badge-danger" : "badge-warning"}`}>{log.sensitivity}</span>
                </td>
                <td className="py-2.5 px-4 font-mono text-xs text-[#6c757d]">{log.backend}</td>
                <td className="py-2.5 px-4 text-right font-mono text-xs text-[#adb5bd]">{log.tokens.toLocaleString()}</td>
                <td className="py-2.5 px-4 text-right">
                  <span className={`badge text-[10px] ${log.status === "success" ? "badge-success" : "badge-danger"}`}>
                    {log.status === "success" ? "✓ OK" : "✕ Blocked"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredLogs.length === 0 && (
          <div className="text-center py-12 text-[#6c757d] text-sm">
            No audit logs match your filters
          </div>
        )}
      </div>
    </div>
  );
}
