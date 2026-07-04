"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BrainCircuit,
  Database,
  GitBranch,
  Play,
  RefreshCw,
  ScrollText,
  Settings2,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useToast } from "@/components/ui/toast";
import type { AgentSessionSummary, AgentSummary, AgentTaskEvent, AgentTaskSummary } from "@/lib/ops-data";
import { useOpsData } from "@/lib/use-ops-data";

type InspectorState = {
  agent: AgentSummary;
  kind: "memory" | "skills";
  items: any[];
};

type TraceState = {
  task: AgentTaskSummary;
  events: AgentTaskEvent[];
};

const BOARD_COLUMNS: Array<{ id: AgentTaskSummary["boardStatus"]; label: string }> = [
  { id: "queued", label: "Queued" },
  { id: "running", label: "Running" },
  { id: "review", label: "Review" },
  { id: "done", label: "Done" },
  { id: "blocked", label: "Blocked" },
];

export default function AgentsPage() {
  const { addToast } = useToast();
  const { data, refresh, loading } = useOpsData();
  const [creating, setCreating] = useState(false);
  const [running, setRunning] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [sessionDraft, setSessionDraft] = useState({
    title: "Enterprise agent rollout",
    objective: "Coordinate tasks, approvals, memory, and trace review for this internal agent harness.",
  });
  const [newAgent, setNewAgent] = useState({
    name: "Operations Analyst",
    role: "enterprise operations agent",
  });
  const [prompt, setPrompt] = useState(
    "Review the current connected systems and summarize what this agent can safely do next.",
  );
  const [taskDraft, setTaskDraft] = useState({
    title: "Investigate internal agent harness gap",
    prompt: "Inspect the current harness state and propose the next concrete implementation step.",
    priority: "high" as AgentTaskSummary["priority"],
  });
  const [lastRun, setLastRun] = useState<AgentTaskSummary | null>(null);
  const [inspector, setInspector] = useState<InspectorState | null>(null);
  const [trace, setTrace] = useState<TraceState | null>(null);
  const [traceStreaming, setTraceStreaming] = useState(false);
  const [boardBusy, setBoardBusy] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);

  useEffect(() => {
    if (!selectedAgentId && data.agents[0]) {
      setSelectedAgentId(data.agents[0].id);
    }
  }, [data.agents, selectedAgentId]);

  useEffect(() => {
    if (!selectedSessionId && data.sessions[0]) {
      setSelectedSessionId(data.sessions[0].id);
    }
  }, [data.sessions, selectedSessionId]);

  const selectedAgent = useMemo(
    () => data.agents.find((agent) => agent.id === selectedAgentId) || data.agents[0],
    [data.agents, selectedAgentId],
  );
  const selectedSession = useMemo(
    () => data.sessions.find((session) => session.id === selectedSessionId) || data.sessions[0],
    [data.sessions, selectedSessionId],
  );

  useEffect(() => {
    if (!trace) {
      setTraceStreaming(false);
      return;
    }

    const lastSequence = trace.events.reduce((max, event) => Math.max(max, event.sequence), 0);
    const source = new EventSource(`/api/tasks/${trace.task.id}/events/stream?after=${lastSequence}`);
    setTraceStreaming(true);

    source.addEventListener("trace", (message) => {
      const event = JSON.parse((message as MessageEvent).data) as AgentTaskEvent;
      setTrace((current) => {
        if (!current || current.task.id !== trace.task.id) return current;
        if (current.events.some((item) => item.id === event.id)) return current;
        return {
          ...current,
          events: [...current.events, event].sort((a, b) => a.sequence - b.sequence),
        };
      });
    });
    source.onerror = () => {
      setTraceStreaming(false);
      source.close();
    };

    return () => {
      setTraceStreaming(false);
      source.close();
    };
  }, [trace?.task.id]);

  const active = data.agents.filter((agent) => agent.status === "active").length;
  const idle = data.agents.filter((agent) => agent.status === "idle").length;
  const tasksToday = data.agents.reduce((sum, agent) => sum + agent.tasksToday, 0);
  const skills = data.agents.reduce((sum, agent) => sum + agent.skillsLearned, 0);

  const createAgent = async (event: FormEvent) => {
    event.preventDefault();
    setCreating(true);
    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAgent),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Agent creation failed");
      addToast("success", `Agent created: ${body.agent.name}`);
      setSelectedAgentId(body.agent.id);
      await refresh();
    } catch (error: any) {
      addToast("error", error.message || "Agent creation failed");
    } finally {
      setCreating(false);
    }
  };

  const createSession = async (event: FormEvent) => {
    event.preventDefault();
    setSessionBusy(true);
    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sessionDraft),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Session creation failed");
      addToast("success", `Session created: ${body.session.title}`);
      setSelectedSessionId(body.session.id);
      await refresh();
    } catch (error: any) {
      addToast("error", error.message || "Session creation failed");
    } finally {
      setSessionBusy(false);
    }
  };

  const runTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedAgent) return;
    setRunning(true);
    setLastRun(null);
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          agentName: selectedAgent.name,
          sessionId: selectedSession?.id || null,
          prompt,
          maxIterations: 4,
        }),
      });
      const body = await response.json();
      const task = body.task as AgentTaskSummary | undefined;
      if (task) setLastRun(task);
      if (!response.ok) throw new Error(body.error || "Task execution failed");
      addToast("success", `Task completed by ${selectedAgent.name}`);
      await refresh();
    } catch (error: any) {
      addToast("error", error.message || "Task execution failed");
      await refresh();
    } finally {
      setRunning(false);
    }
  };

  const inspectAgent = async (agent: AgentSummary, kind: "memory" | "skills") => {
    try {
      const response = await fetch(`/api/agents/${agent.id}/${kind}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `Could not load ${kind}`);
      setInspector({
        agent,
        kind,
        items: kind === "memory" ? body.results || [] : body.skills || [],
      });
    } catch (error: any) {
      addToast("error", error.message || `Could not load ${kind}`);
    }
  };

  const createBoardTask = async (event: FormEvent) => {
    event.preventDefault();
    setBoardBusy("create");
    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "create",
          sessionId: selectedSession?.id || null,
          agentId: selectedAgent?.id || null,
          agentName: selectedAgent?.name || null,
          ...taskDraft,
          boardStatus: "queued",
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Task creation failed");
      addToast("success", `Task queued: ${body.task.title}`);
      await refresh();
    } catch (error: any) {
      addToast("error", error.message || "Task creation failed");
    } finally {
      setBoardBusy("");
    }
  };

  const moveTask = async (
    task: AgentTaskSummary,
    boardStatus: AgentTaskSummary["boardStatus"],
  ) => {
    setBoardBusy(`${task.id}:move`);
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ boardStatus }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Task update failed");
      await refresh();
    } catch (error: any) {
      addToast("error", error.message || "Task update failed");
    } finally {
      setBoardBusy("");
    }
  };

  const inspectTrace = async (task: AgentTaskSummary) => {
    try {
      const response = await fetch(`/api/tasks/${task.id}/events`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load task trace");
      setTrace({ task, events: body.events || [] });
    } catch (error: any) {
      addToast("error", error.message || "Could not load task trace");
    }
  };

  const runBoardTask = async (task: AgentTaskSummary) => {
    if (!selectedAgent && !task.agentId) {
      addToast("error", "Select an agent before running this task");
      return;
    }
    setBoardBusy(`${task.id}:run`);
    try {
      const response = await fetch(`/api/tasks/${task.id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: task.agentId || selectedAgent?.id,
          maxIterations: 4,
        }),
      });
      const body = await response.json();
      if (body.task) setLastRun(body.task);
      if (!response.ok) throw new Error(body.error || "Task run failed");
      addToast("success", `Task run completed: ${body.task.title}`);
      await refresh();
      if (body.task) await inspectTrace(body.task);
    } catch (error: any) {
      addToast("error", error.message || "Task run failed");
      await refresh();
    } finally {
      setBoardBusy("");
    }
  };

  return (
    <div className="max-w-[1700px] space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
        <div>
          <div className="mono mb-3 flex flex-wrap items-center gap-2 text-[11px] uppercase text-[#9b8460]">
            <span className="badge badge-warning text-[10px] px-2 py-0.5">Agent Harness</span>
            <span>{data.source === "live" ? "runtime connected" : "runtime offline"}</span>
          </div>
          <h2 className="display text-[2rem] font-semibold leading-tight text-[#fff7e8]">
            Agent Fleet
          </h2>
          <p className="mt-2 max-w-3xl text-sm text-[#d8c19d]">
            Create governed workers, run tasks through the runtime, inspect task output, and verify memory and skills from the live database.
          </p>
        </div>
        <button
          onClick={() => {
            void refresh();
            addToast("success", "Agent harness refreshed");
          }}
          className="btn btn-secondary text-sm"
        >
          <RefreshCw size={14} />
          {loading ? "Refreshing" : "Refresh"}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MiniStat label="Total" value={`${data.agents.length}`} sub="registered" />
        <MiniStat label="Active" value={`${active}`} sub="running" color="green" />
        <MiniStat label="Idle" value={`${idle}`} sub="waiting" color="yellow" />
        <MiniStat label="Tasks Today" value={`${tasksToday}`} sub="ledger rows" />
        <MiniStat label="Skills" value={`${skills}`} sub="stored" color="blue" />
      </div>

      <section className="card">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <GitBranch size={18} className="text-[#ffac02]" />
              <h3 className="text-lg font-semibold">Sessions</h3>
            </div>
            <p className="text-xs text-[#9b8460]">
              Group work into resumable runs with shared task history and trace context.
            </p>
          </div>
          <select
            value={selectedSession?.id || ""}
            onChange={(event) => setSelectedSessionId(event.target.value)}
            className="min-w-72 rounded-none border border-[#4a2b08] bg-[#120800] px-3 py-2.5 text-sm text-[#fff7e8] focus:border-[#ffac02] focus:outline-none"
          >
            {data.sessions.length === 0 ? (
              <option value="">No active session</option>
            ) : (
              data.sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} / {session.status}
                </option>
              ))
            )}
          </select>
        </div>

        <form onSubmit={createSession} className="mb-4 grid gap-3 xl:grid-cols-[0.45fr_1fr_auto]">
          <input
            value={sessionDraft.title}
            onChange={(event) => setSessionDraft((current) => ({ ...current, title: event.target.value }))}
            className="rounded-none border border-[#4a2b08] bg-[#120800] px-3 py-2.5 text-sm text-[#fff7e8] focus:border-[#ffac02] focus:outline-none"
            placeholder="Session title"
            required
          />
          <input
            value={sessionDraft.objective}
            onChange={(event) => setSessionDraft((current) => ({ ...current, objective: event.target.value }))}
            className="rounded-none border border-[#4a2b08] bg-[#120800] px-3 py-2.5 text-sm text-[#fff7e8] focus:border-[#ffac02] focus:outline-none"
            placeholder="Session objective"
          />
          <button type="submit" disabled={sessionBusy} className="btn btn-primary justify-center">
            Create Session
          </button>
        </form>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {data.sessions.length === 0 ? (
            <div className="panel border-dashed p-4 text-sm text-[#9b8460] md:col-span-2 xl:col-span-4">
              No sessions yet.
            </div>
          ) : (
            data.sessions.slice(0, 4).map((session) => (
              <SessionPill
                key={session.id}
                session={session}
                selected={session.id === selectedSession?.id}
                onSelect={() => setSelectedSessionId(session.id)}
              />
            ))
          )}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <UserRound size={18} className="text-[#ffac02]" />
            <h3 className="text-lg font-semibold">Hire Agent</h3>
          </div>
          <form onSubmit={createAgent} className="space-y-4">
            <label className="block">
              <span className="mono mb-1.5 block text-[11px] uppercase text-[#d8c19d]">Name</span>
              <input
                value={newAgent.name}
                onChange={(event) => setNewAgent((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-none border border-[#4a2b08] bg-[#120800] px-3 py-2.5 text-sm text-[#fff7e8] focus:border-[#ffac02] focus:outline-none"
                required
              />
            </label>
            <label className="block">
              <span className="mono mb-1.5 block text-[11px] uppercase text-[#d8c19d]">Role</span>
              <input
                value={newAgent.role}
                onChange={(event) => setNewAgent((current) => ({ ...current, role: event.target.value }))}
                className="w-full rounded-none border border-[#4a2b08] bg-[#120800] px-3 py-2.5 text-sm text-[#fff7e8] focus:border-[#ffac02] focus:outline-none"
                required
              />
            </label>
            <button type="submit" disabled={creating} className="btn btn-primary w-full justify-center">
              <UserRound size={14} />
              {creating ? "Creating Agent" : "Create Agent"}
            </button>
          </form>
        </div>

        <div className="card">
          <div className="mb-4 flex items-center gap-2">
            <Play size={18} className="text-[#ffac02]" />
            <h3 className="text-lg font-semibold">Run Task</h3>
          </div>
          <form onSubmit={runTask} className="space-y-4">
            <label className="block">
              <span className="mono mb-1.5 block text-[11px] uppercase text-[#d8c19d]">Agent</span>
              <select
                value={selectedAgent?.id || ""}
                onChange={(event) => setSelectedAgentId(event.target.value)}
                className="w-full rounded-none border border-[#4a2b08] bg-[#120800] px-3 py-2.5 text-sm text-[#fff7e8] focus:border-[#ffac02] focus:outline-none"
                disabled={data.agents.length === 0}
              >
                {data.agents.length === 0 ? (
                  <option value="">No live agents registered</option>
                ) : (
                  data.agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} / {agent.role}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="block">
              <span className="mono mb-1.5 block text-[11px] uppercase text-[#d8c19d]">Prompt</span>
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                className="min-h-28 w-full resize-y rounded-none border border-[#4a2b08] bg-[#120800] px-3 py-2.5 text-sm text-[#fff7e8] focus:border-[#ffac02] focus:outline-none"
                required
              />
            </label>
            <button
              type="submit"
              disabled={running || !selectedAgent}
              className="btn btn-primary justify-center"
            >
              <Play size={14} />
              {running ? "Running Through Runtime" : "Run Task"}
            </button>
          </form>

          {lastRun && (
            <div className="panel mt-4 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="mono text-[11px] uppercase text-[#9b8460]">Last Run</span>
                <span className={`badge text-[10px] ${lastRun.status === "succeeded" ? "badge-success" : "badge-danger"}`}>
                  {lastRun.status}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-[#fff7e8]">
                {lastRun.output || lastRun.errorMessage || "No output returned."}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <GitBranch size={18} className="text-[#ffac02]" />
              <h3 className="text-lg font-semibold">Kanban Work Board</h3>
            </div>
            <p className="text-xs text-[#9b8460]">
              Paperclip-style work items backed by `agent_tasks`; run a card to generate trace events, audit rows, and memory.
            </p>
          </div>
        </div>

        <form onSubmit={createBoardTask} className="mb-5 grid gap-3 xl:grid-cols-[0.55fr_1fr_10rem_auto]">
          <input
            value={taskDraft.title}
            onChange={(event) => setTaskDraft((current) => ({ ...current, title: event.target.value }))}
            className="rounded-none border border-[#4a2b08] bg-[#120800] px-3 py-2.5 text-sm text-[#fff7e8] focus:border-[#ffac02] focus:outline-none"
            placeholder="Task title"
            required
          />
          <input
            value={taskDraft.prompt}
            onChange={(event) => setTaskDraft((current) => ({ ...current, prompt: event.target.value }))}
            className="rounded-none border border-[#4a2b08] bg-[#120800] px-3 py-2.5 text-sm text-[#fff7e8] focus:border-[#ffac02] focus:outline-none"
            placeholder="Task prompt"
            required
          />
          <select
            value={taskDraft.priority}
            onChange={(event) => setTaskDraft((current) => ({ ...current, priority: event.target.value as AgentTaskSummary["priority"] }))}
            className="rounded-none border border-[#4a2b08] bg-[#120800] px-3 py-2.5 text-sm text-[#fff7e8] focus:border-[#ffac02] focus:outline-none"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <button type="submit" disabled={boardBusy === "create"} className="btn btn-primary justify-center">
            Queue Task
          </button>
        </form>

        <div className="grid gap-3 xl:grid-cols-5">
          {BOARD_COLUMNS.map((column) => {
            const tasks = data.tasks.filter((task) => task.boardStatus === column.id);
            return (
              <div key={column.id} className="panel min-h-52 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="mono text-[11px] font-semibold uppercase text-[#ffd8b0]">{column.label}</h4>
                  <span className="badge text-[10px]">{tasks.length}</span>
                </div>
                <div className="space-y-3">
                  {tasks.length === 0 ? (
                    <div className="border border-dashed border-[#4a2b08] px-3 py-8 text-center text-xs text-[#9b8460]">
                      No cards
                    </div>
                  ) : (
                    tasks.map((task) => (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        busy={boardBusy.startsWith(task.id)}
                        onMove={moveTask}
                        onRun={runBoardTask}
                        onTrace={inspectTrace}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.75fr]">
        <div className="grid gap-4 lg:grid-cols-2">
          {data.agents.length === 0 ? (
            <div className="card lg:col-span-2">
              <h3 className="mb-2 text-lg font-semibold">No Agents Registered</h3>
              <p className="text-sm text-[#9b8460]">
                Create an agent to add an `agent_configs` row. Tasks, memory, skills, and audit entries will then be written by the runtime.
              </p>
            </div>
          ) : (
            data.agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                selected={agent.id === selectedAgent?.id}
                onSelect={() => setSelectedAgentId(agent.id)}
                onMemory={() => void inspectAgent(agent, "memory")}
                onSkills={() => void inspectAgent(agent, "skills")}
              />
            ))
          )}
        </div>

        <div className="card p-0 overflow-hidden">
          <div className="border-b border-[#4a2b08] px-5 py-4">
            <h3 className="text-lg font-semibold">Task Ledger</h3>
            <p className="mt-1 text-xs text-[#9b8460]">Recent runtime executions from `agent_tasks`</p>
          </div>
          <div className="divide-y divide-[#4a2b08]/70">
            {data.tasks.length === 0 ? (
              <div className="px-5 py-5 text-sm text-[#9b8460]">No tasks have run yet.</div>
            ) : (
              data.tasks.slice(0, 10).map((task) => <TaskRow key={task.id} task={task} />)
            )}
          </div>
        </div>
      </section>

      {inspector && (
        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold">
                {inspector.agent.name} / {inspector.kind === "memory" ? "Memory" : "Skills"}
              </h3>
              <p className="mt-1 text-xs text-[#9b8460]">Live runtime readback</p>
            </div>
            <button onClick={() => setInspector(null)} className="btn btn-secondary text-xs">
              Close
            </button>
          </div>
          {inspector.items.length === 0 ? (
            <p className="text-sm text-[#9b8460]">No {inspector.kind} entries yet.</p>
          ) : (
            <div className="grid gap-3">
              {inspector.items.map((item, index) => (
                <div key={item.id || index} className="panel p-3">
                  <div className="text-sm text-[#fff7e8]">
                    {item.content || item.name || item.instructions || JSON.stringify(item)}
                  </div>
                  {item.memoryType || item.category ? (
                    <div className="mono mt-2 text-[10px] uppercase text-[#9b8460]">
                      {item.memoryType || item.category}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {trace && (
        <section className="card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <ScrollText size={18} className="text-[#ffac02]" />
                <h3 className="text-lg font-semibold">Execution Trace</h3>
              </div>
              <p className="text-xs text-[#9b8460]">{trace.task.title}</p>
            </div>
            <span className={`badge text-[10px] ${traceStreaming ? "badge-success" : "badge-warning"}`}>
              {traceStreaming ? "Live Stream" : "Snapshot"}
            </span>
            <button onClick={() => setTrace(null)} className="btn btn-secondary text-xs">
              Close
            </button>
          </div>
          {trace.events.length === 0 ? (
            <p className="text-sm text-[#9b8460]">No trace events recorded yet.</p>
          ) : (
            <div className="space-y-3">
              {trace.events.map((event) => (
                <div key={event.id} className="panel grid gap-2 p-3 sm:grid-cols-[4rem_12rem_1fr]">
                  <div className="mono text-[10px] uppercase text-[#9b8460]">#{event.sequence}</div>
                  <div>
                    <div className="mono text-[10px] uppercase text-[#ffac02]">
                      {event.eventType.replace(/_/g, " ")}
                    </div>
                    <div className="mt-1 text-sm font-medium">{event.title}</div>
                  </div>
                  <div className="min-w-0 text-sm text-[#d8c19d]">
                    {event.message || "No message"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function SessionPill({
  session,
  selected,
  onSelect,
}: {
  session: AgentSessionSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`panel p-3 text-left transition-colors ${selected ? "border-[#ffac02]/70 bg-[#ffac02]/[0.04]" : "hover:border-[#8a5a16]"}`}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">{session.title}</span>
        <span className={`badge shrink-0 text-[10px] ${session.status === "active" ? "badge-success" : session.status === "closed" ? "badge-danger" : "badge-warning"}`}>
          {session.status}
        </span>
      </div>
      <p className="line-clamp-2 text-xs text-[#9b8460]">{session.objective || "No objective set."}</p>
      <div className="mono mt-3 flex flex-wrap gap-3 text-[10px] uppercase text-[#9b8460]">
        <span>{session.taskCount} tasks</span>
        <span>{session.latestTaskAt ? "active" : "new"}</span>
      </div>
    </button>
  );
}

function KanbanCard({
  task,
  busy,
  onMove,
  onRun,
  onTrace,
}: {
  task: AgentTaskSummary;
  busy: boolean;
  onMove: (task: AgentTaskSummary, status: AgentTaskSummary["boardStatus"]) => void;
  onRun: (task: AgentTaskSummary) => void;
  onTrace: (task: AgentTaskSummary) => void;
}) {
  return (
    <div className="border border-[#4a2b08] bg-[#170d02]/70 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h5 className="text-sm font-semibold leading-snug">{task.title}</h5>
        <span className="mono shrink-0 text-[10px] uppercase text-[#ffac02]">{task.priority}</span>
      </div>
      <p className="line-clamp-3 text-xs text-[#9b8460]">{task.prompt}</p>
      {task.output || task.errorMessage ? (
        <p className="mt-3 line-clamp-2 text-xs text-[#d8c19d]">{task.output || task.errorMessage}</p>
      ) : null}
      <div className="mono mt-3 flex flex-wrap gap-2 text-[10px] uppercase text-[#9b8460]">
        <span>{task.agentName || "unassigned"}</span>
        <span>{task.tokensUsed} tokens</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <button
          onClick={() => onRun(task)}
          disabled={busy || task.status === "running"}
          className="btn btn-primary px-2 py-1 text-[11px]"
        >
          <Play size={12} />
          Run
        </button>
        <button onClick={() => onTrace(task)} className="btn btn-secondary px-2 py-1 text-[11px]">
          <ScrollText size={12} />
          Trace
        </button>
        <select
          value={task.boardStatus}
          onChange={(event) => onMove(task, event.target.value as AgentTaskSummary["boardStatus"])}
          disabled={busy}
          className="rounded-none border border-[#4a2b08] bg-[#120800] px-2 py-1 text-[11px] text-[#fff7e8]"
        >
          {BOARD_COLUMNS.map((column) => (
            <option key={column.id} value={column.id}>
              {column.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  selected,
  onSelect,
  onMemory,
  onSkills,
}: {
  agent: AgentSummary;
  selected: boolean;
  onSelect: () => void;
  onMemory: () => void;
  onSkills: () => void;
}) {
  return (
    <div className={`card group transition-all ${selected ? "border-[#ffac02]/45 bg-[#ffac02]/[0.035]" : "hover:border-[#8a5a16]"}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <button onClick={onSelect} className="flex min-w-0 items-center gap-3 text-left">
          <span className="flex h-10 w-10 items-center justify-center rounded-none border border-[#ffac02]/25 bg-[#ffac02]/10 text-[#ffac02] transition-transform group-hover:scale-105">
            <BrainCircuit size={18} />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{agent.name}</span>
            <span className="block truncate text-xs text-[#9b8460]">{agent.role}</span>
          </span>
        </button>
        <span className={`badge text-[10px] ${agent.status === "active" ? "badge-success" : agent.status === "idle" ? "badge-warning" : "badge-danger"}`}>
          {agent.status}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-2">
        <StatPill label="Model" value={agent.model.split(" / ")[0]} />
        <StatPill label="Today" value={`${agent.tasksToday}`} />
        <StatPill label="Success" value={agent.successRate} highlight />
        <StatPill label="Skills" value={`${agent.skillsLearned}`} />
      </div>

      <div className="mono mb-4 flex flex-wrap items-center gap-2 text-[10px] text-[#9b8460]">
        <span>ID: {agent.paperclipId}</span>
        <span>/</span>
        <span>Heartbeat: {agent.heartbeatInterval}</span>
        <span>/</span>
        <span className={agent.externalAllowed ? "text-[#ffd8b0]" : "text-[#9dffb5]"}>
          {agent.externalAllowed ? "External allowed" : "Local first"}
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#4a2b08] pt-3">
        <div className="text-[11px] text-[#9b8460]">
          {agent.memoryEntries.toLocaleString()} memory entries
        </div>
        <div className="flex gap-1.5">
          <button onClick={onSelect} className="btn btn-secondary px-2 py-1 text-[11px]">
            <Settings2 size={12} />
            Select
          </button>
          <button onClick={onMemory} className="btn btn-secondary px-2 py-1 text-[11px]">
            <Database size={12} />
            Memory
          </button>
          <button onClick={onSkills} className="btn btn-secondary px-2 py-1 text-[11px]">
            <Sparkles size={12} />
            Skills
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: AgentTaskSummary }) {
  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{task.title}</div>
          <div className="mt-1 text-[11px] text-[#9b8460]">{task.agentName || "unassigned"}</div>
        </div>
        <span className={`badge shrink-0 text-[10px] ${task.status === "succeeded" ? "badge-success" : task.status === "failed" ? "badge-danger" : "badge-warning"}`}>
          {task.status}
        </span>
      </div>
      <div className="mono flex flex-wrap gap-3 text-[10px] uppercase text-[#9b8460]">
        <span>{task.iterations} iterations</span>
        <span>{task.tokensUsed} tokens</span>
        <span>{task.durationMs ?? 0} ms</span>
      </div>
      {(task.output || task.errorMessage) && (
        <p className="mt-3 line-clamp-3 whitespace-pre-wrap text-xs text-[#d8c19d]">
          {task.output || task.errorMessage}
        </p>
      )}
    </div>
  );
}

function MiniStat({ label, value, sub, color }: { label: string; value: string; sub: string; color?: string }) {
  const colors: Record<string, string> = { green: "text-[#9dffb5]", yellow: "text-[#ffd8b0]", blue: "text-[#ffd8b0]" };
  return (
    <div className="card py-4 text-center">
      <div className={`text-2xl font-bold ${color ? colors[color] : ""}`}>{value}</div>
      <div className="mt-1 text-xs text-[#9b8460]">{label}</div>
      <div className="text-[10px] text-[#9b8460]/70">{sub}</div>
    </div>
  );
}

function StatPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-none border border-[#4a2b08] bg-[#170d02] p-2 text-center">
      <div className="text-[10px] text-[#9b8460]">{label}</div>
      <div className={`mono mt-0.5 text-sm ${highlight ? "text-[#9dffb5]" : ""}`}>{value}</div>
    </div>
  );
}
