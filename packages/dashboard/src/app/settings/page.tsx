"use client";

import { useToast } from "@/components/ui/toast";

export default function SettingsPage() {
  const { addToast } = useToast();

  return (
    <div className="p-8 space-y-8 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
        <p className="text-[#9b8460] text-sm mt-1">Configure your enterprise agent platform</p>
      </div>

      {/* LLM Configuration */}
      <Section title="LLM Configuration" icon="🧠">
        <SettingRow label="Default Backend" value="vllm" type="select" options={["vllm", "ollama"]} />
        <SettingRow label="vLLM Server URL" value="http://localhost:8000/v1" type="text" />
        <SettingRow label="Ollama Server URL" value="http://localhost:11434" type="text" />
        <SettingRow label="Default Model" value="meta-llama/Llama-3.1-70B-Instruct" type="text" />
        <SettingRow label="Max Tokens Per Request" value="32768" type="number" />
        <SettingRow label="Fallback Model" value="llama3.1:70b" type="text" />
      </Section>

      {/* External API */}
      <Section title="External API Access" icon="🌐">
        <SettingToggle label="Allow External API Calls" enabled={false} detail="When disabled, all LLM calls use local vLLM/Ollama only" />
        <SettingRow label="OpenAI API Key" value="" type="text" placeholder="sk-..." />
        <SettingRow label="Anthropic API Key" value="" type="text" placeholder="sk-ant-..." />
      </Section>

      {/* Agent Defaults */}
      <Section title="Agent Defaults" icon="🤖">
        <SettingRow label="Heartbeat Interval" value="300" type="number" suffix="seconds" />
        <SettingRow label="Max Task Iterations" value="10" type="number" />
        <SettingToggle label="Skill Learning" enabled={true} detail="Agents auto-learn skills from completed tasks" />
        <SettingToggle label="Memory System" enabled={true} detail="Vector-based memory for contextual recall" />
      </Section>

      {/* Data & Retention */}
      <Section title="Data & Retention" icon="💾">
        <SettingRow label="Audit Log Retention" value="90" type="number" suffix="days" />
        <SettingRow label="Agent Memory Retention" value="365" type="number" suffix="days" />
        <SettingToggle label="Auto-scrub PII from Logs" enabled={true} detail="Automatically remove sensitive data after retention" />
      </Section>

      {/* Save */}
      <div className="flex gap-3">
        <button onClick={() => addToast("success", "Settings saved")} className="btn btn-primary">
          Save Settings
        </button>
        <button onClick={() => addToast("info", "Settings reset")} className="btn btn-secondary">
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
        <span>{icon}</span>
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function SettingRow({
  label, value, type, options, placeholder, suffix,
}: {
  label: string; value: string; type: "text" | "number" | "select";
  options?: string[]; placeholder?: string; suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm flex-1">{label}</label>
      <div className="flex items-center gap-2">
        {type === "select" && options ? (
          <select defaultValue={value} className="bg-[#170d02] border border-[#4a2b08] rounded-none px-3 py-1.5 text-sm text-[#d8c19d]">
            {options.map((o) => <option key={o}>{o}</option>)}
          </select>
        ) : (
          <input
            type={type}
            defaultValue={value}
            placeholder={placeholder}
            className="bg-[#170d02] border border-[#4a2b08] rounded-none px-3 py-1.5 text-sm text-[#d8c19d] font-mono w-64"
          />
        )}
        {suffix && <span className="text-xs text-[#9b8460]">{suffix}</span>}
      </div>
    </div>
  );
}

function SettingToggle({ label, enabled, detail }: { label: string; enabled: boolean; detail: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <div>
        <div className="text-sm">{label}</div>
        <div className="text-[10px] text-[#9b8460] mt-0.5">{detail}</div>
      </div>
      <div className={`w-9 h-5 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${enabled ? "bg-[#ffac02]" : "bg-[#4a2b08]"}`}>
        <div className={`w-4 h-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
      </div>
    </div>
  );
}
