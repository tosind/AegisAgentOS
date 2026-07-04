"use client";

import { useToast } from "@/components/ui/toast";
import { availableIntegrations } from "@/lib/ops-data";
import { useOpsData } from "@/lib/use-ops-data";

export default function IntegrationsPage() {
  const { addToast } = useToast();
  const { data, refresh } = useOpsData();
  const connectedCount = data.connections.filter((conn) => conn.status === "connected").length;

  return (
    <div className="p-8 space-y-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
          <p className="text-[#9b8460] text-sm mt-1">
            Connect enterprise systems via MCP —{" "}
            <span className="text-[#9dffb5] font-medium">
              {connectedCount} of {availableIntegrations.length} connected
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              void refresh();
              addToast("success", "Connections refreshed");
            }}
            className="btn btn-secondary text-sm"
          >
            Refresh
          </button>
          <button
            onClick={() => addToast("info", "Connection wizard coming soon")}
            className="btn btn-primary text-sm"
          >
            + New Connection
          </button>
        </div>
      </div>

      {/* Active Connections */}
      <div>
        <h3 className="font-semibold text-lg mb-3">Active Connections</h3>
        <div className="space-y-2">
          {data.connections.map((conn) => (
            <div key={conn.name} className="card flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${conn.status === "connected" ? "bg-[#9dffb5]" : conn.status === "error" ? "bg-[#ff8a61]" : "bg-[#9b8460]"}`}>
                  {conn.status === "connected" && <div className="w-3 h-3 rounded-full bg-[#9dffb5] animate-ping opacity-30" />}
                </div>
                <div>
                  <div className="font-medium text-sm">{conn.name}</div>
                  <div className="text-[11px] text-[#9b8460]">{conn.type}</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-[#d8c19d]">{conn.tools} tools</span>
                <span className="text-[10px] text-[#9b8460] font-mono">{conn.lastConnected}</span>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => addToast(conn.status === "connected" ? "success" : "error", conn.status === "connected" ? "Connection OK" : "Connection failed")}
                    className="btn btn-secondary text-[11px] px-2 py-1"
                  >
                    Test
                  </button>
                  <button onClick={() => addToast("info", "Configure connection")} className="btn btn-secondary text-[11px] px-2 py-1">Config</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Available */}
      <div>
        <h3 className="font-semibold text-lg mb-3">Available Integrations</h3>
        <div className="grid grid-cols-2 gap-3">
          {availableIntegrations.map((item) => (
            <button
              key={item.name}
              onClick={() => addToast("info", `Connect to ${item.name}`)}
              className="card flex items-center gap-4 hover:border-[#ffac02]/30 hover:bg-[#ffac02]/[0.02] transition-all text-left group"
            >
              <span className="w-9 h-9 rounded-none bg-[#170d02] border border-[#4a2b08] flex items-center justify-center text-[10px] font-bold text-[#ffac02] group-hover:scale-105 transition-transform">
                {item.icon}
              </span>
              <div className="flex-1">
                <div className="font-medium text-sm">{item.name}</div>
                <div className="text-[11px] text-[#9b8460] mt-0.5">{item.desc}</div>
              </div>
              <span className="text-[#ffac02] text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Connect →
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
