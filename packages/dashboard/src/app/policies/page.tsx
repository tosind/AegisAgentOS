"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Check,
  ClipboardList,
  Gauge,
  Globe2,
  Hand,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";

type Approval = {
  id: string;
  tenantId: string;
  agentId: string;
  actionType: string;
  target?: string | null;
  details: Record<string, any>;
  status: "pending" | "approved" | "rejected";
  requestedBy?: string | null;
  approvedBy?: string | null;
};

type Usage = {
  tenantId: string;
  usedTokensToday: number;
  dailyTokenBudget: number;
  maxTokensPerRequest: number;
  remainingTokensToday: number;
};

export default function PoliciesPage() {
  const { addToast } = useToast();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");

  const pending = approvals.filter((approval) => approval.status === "pending");
  const budgetPercent = useMemo(() => {
    if (!usage?.dailyTokenBudget) return 0;
    return Math.min(100, Math.round((usage.usedTokensToday / usage.dailyTokenBudget) * 100));
  }, [usage]);

  const loadGovernance = async () => {
    setLoading(true);
    try {
      const [approvalResponse, usageResponse] = await Promise.all([
        fetch("/api/approvals?limit=25", { cache: "no-store" }),
        fetch("/api/usage", { cache: "no-store" }),
      ]);
      const approvalBody = await approvalResponse.json();
      const usageBody = await usageResponse.json();
      if (!approvalResponse.ok) throw new Error(approvalBody.error || "Could not load approvals");
      if (!usageResponse.ok) throw new Error(usageBody.error || "Could not load usage");
      setApprovals(approvalBody.approvals || []);
      setUsage(usageBody.usage || null);
    } catch (error: any) {
      addToast("error", error.message || "Could not load governance data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGovernance();
  }, []);

  const decide = async (approval: Approval, status: "approved" | "rejected") => {
    setBusy(`${approval.id}:${status}`);
    try {
      const response = await fetch(`/api/approvals/${approval.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Approval update failed");
      addToast("success", `Request ${status}`);
      await loadGovernance();
    } catch (error: any) {
      addToast("error", error.message || "Approval update failed");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="max-w-[1500px] space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
        <div>
          <div className="mono mb-3 flex flex-wrap items-center gap-2 text-[11px] uppercase text-[#9b8460]">
            <span className="badge badge-warning px-2 py-0.5 text-[10px]">Governance</span>
            <span>{pending.length} pending approvals</span>
          </div>
          <h2 className="display text-[2rem] font-semibold leading-tight text-[#fff7e8]">
            Policy Control
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-[#d8c19d]">
            Enforce local-first routing, approval gates, tool permissions, and token budgets before agents touch sensitive systems.
          </p>
        </div>
        <button
          onClick={() => void loadGovernance()}
          disabled={loading}
          className="btn btn-secondary text-sm"
        >
          <RefreshCw size={14} />
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <section className="card">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-[#ffac02]/30 bg-[#ffac02]/10 text-[#ffac02]">
                <ShieldCheck size={19} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Default Enterprise Policy</h3>
                <p className="mt-1 text-xs text-[#9b8460]">Local-first, PII scrubbed, approval-gated</p>
              </div>
            </div>
            <span className="badge badge-success text-[10px]">Active</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <RuleBox icon={Globe2} label="External API Calls" value="Blocked" detail="Local Ollama/vLLM unless explicitly approved" negative />
            <RuleBox icon={Search} label="PII Scrubbing" value="Enabled" detail="Email, phone, SSN, cards, API keys" positive />
            <RuleBox icon={Hand} label="Approval Required" value="Live" detail="LLM and high-risk tool calls create queue items" />
            <RuleBox icon={ClipboardList} label="Audit Level" value="All" detail="Blocked and successful actions are logged" />
            <RuleBox icon={Gauge} label="Max Request" value={`${usage?.maxTokensPerRequest?.toLocaleString() || "32,768"}`} detail="Tokens per LLM call" />
            <RuleBox icon={Activity} label="Daily Budget" value={`${usage?.dailyTokenBudget?.toLocaleString() || "250,000"}`} detail={`${usage?.remainingTokensToday?.toLocaleString() || "n/a"} remaining today`} />
          </div>

          <div className="mt-5 border-t border-[#4a2b08] pt-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="mono uppercase text-[#9b8460]">Token Budget Used</span>
              <span className="mono text-[#ffd8b0]">{budgetPercent}%</span>
            </div>
            <div className="h-2 border border-[#4a2b08] bg-[#120800]">
              <div className="h-full bg-[#ffac02]" style={{ width: `${budgetPercent}%` }} />
            </div>
          </div>
        </section>

        <section className="card">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">Approval Queue</h3>
              <p className="mt-1 text-xs text-[#9b8460]">
                Requests are created by the runtime and security layer when work crosses policy boundaries.
              </p>
            </div>
            <span className="badge badge-warning text-[10px]">{pending.length} Pending</span>
          </div>

          <div className="space-y-3">
            {approvals.length === 0 ? (
              <div className="border border-dashed border-[#4a2b08] px-4 py-10 text-center text-sm text-[#9b8460]">
                No approval requests have been created yet.
              </div>
            ) : (
              approvals.map((approval) => (
                <ApprovalRow
                  key={approval.id}
                  approval={approval}
                  busy={busy.startsWith(approval.id)}
                  onApprove={() => void decide(approval, "approved")}
                  onReject={() => void decide(approval, "rejected")}
                />
              ))
            )}
          </div>
        </section>
      </div>

      <section className="card">
        <h3 className="mb-4 text-lg font-semibold">PII Detection Patterns</h3>
        <div className="grid gap-2 lg:grid-cols-2">
          {[
            { name: "Email", pattern: "[a-zA-Z0-9._%+-]+@[...]", strategy: "Mask", active: true },
            { name: "Phone (US)", pattern: "\\b\\d{3}[-.]?\\d{3}[-.]?\\d{4}\\b", strategy: "Mask", active: true },
            { name: "SSN", pattern: "\\b\\d{3}-\\d{2}-\\d{4}\\b", strategy: "Redact", active: true },
            { name: "Credit Card", pattern: "\\b(?:\\d{4}[ -]?){3}\\d{4}\\b", strategy: "Redact", active: true },
            { name: "API Keys", pattern: "(?:api_key|secret|token)...", strategy: "Redact", active: true },
            { name: "AWS Keys", pattern: "AKIA[0-9A-Z]{16}", strategy: "Redact", active: true },
          ].map((pattern) => (
            <div key={pattern.name} className="panel flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{pattern.name}</div>
                <div className="mono mt-1 truncate text-[10px] text-[#9b8460]">{pattern.pattern}</div>
              </div>
              <span className={`badge shrink-0 text-[10px] ${pattern.strategy === "Redact" ? "badge-danger" : "badge-warning"}`}>
                {pattern.strategy}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ApprovalRow({
  approval,
  busy,
  onApprove,
  onReject,
}: {
  approval: Approval;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const reasons = approval.details?.reasons as string[] | undefined;
  return (
    <div className="panel p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mono text-[10px] uppercase text-[#ffac02]">{approval.actionType}</div>
          <h4 className="mt-1 text-sm font-semibold">{approval.target || approval.id}</h4>
        </div>
        <span className={`badge text-[10px] ${approval.status === "approved" ? "badge-success" : approval.status === "rejected" ? "badge-danger" : "badge-warning"}`}>
          {approval.status}
        </span>
      </div>
      <p className="line-clamp-3 text-xs text-[#d8c19d]">
        {approval.details?.messagePreview || approval.details?.reason || reasons?.join("; ") || "Approval requested by runtime policy."}
      </p>
      {reasons?.length ? (
        <div className="mono mt-3 text-[10px] uppercase text-[#9b8460]">
          {reasons.join(" / ")}
        </div>
      ) : null}
      {approval.status === "pending" ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={onApprove} disabled={busy} className="btn btn-primary px-3 py-1.5 text-[11px]">
            <Check size={12} />
            Approve
          </button>
          <button onClick={onReject} disabled={busy} className="btn btn-secondary px-3 py-1.5 text-[11px]">
            <X size={12} />
            Reject
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RuleBox({
  icon: Icon,
  label,
  value,
  detail,
  positive,
  negative,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  positive?: boolean;
  negative?: boolean;
}) {
  const valueColor = positive ? "text-[#9dffb5]" : negative ? "text-[#ff8a61]" : "text-[#fff7e8]";
  return (
    <div className="panel p-3">
      <div className="mb-1 flex items-center gap-2">
        <Icon size={13} className="text-[#ffac02]" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className={`text-sm font-bold ${valueColor}`}>{value}</div>
      <div className="mt-0.5 text-[10px] text-[#9b8460]">{detail}</div>
    </div>
  );
}
