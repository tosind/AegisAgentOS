"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
        return;
      }

      // Store session in localStorage for the UI
      localStorage.setItem("user", JSON.stringify(data.user));

      // Redirect to dashboard
      router.push("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#090907] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">
            <span className="text-[#e3a21a]">Aegis</span> Agent OS
          </h1>
          <p className="text-[#8a8171] text-sm mt-2">
            Sign in to the enterprise agent command center
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-[#f03e3e]/10 border border-[#f03e3e]/20 text-[#f03e3e] text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#090907] border border-[#332d20] rounded-lg px-3 py-2.5 text-sm focus:border-[#e3a21a] focus:outline-none"
                placeholder="admin@enterprise.local"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#090907] border border-[#332d20] rounded-lg px-3 py-2.5 text-sm focus:border-[#e3a21a] focus:outline-none"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full justify-center py-2.5"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[#332d20]">
            <p className="text-xs text-[#8a8171] text-center">
              Default local admin: admin@enterprise.local / change-me-now
            </p>

            <div className="mt-4 space-y-2">
              <OIDCButton provider="Google" />
              <OIDCButton provider="Microsoft (Azure AD)" />
              <OIDCButton provider="Okta" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function OIDCButton({ provider }: { provider: string }) {
  return (
    <button
      type="button"
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[#332d20] text-sm hover:bg-white/[0.02] transition-colors"
      disabled
    >
      Continue with {provider}
      <span className="text-[10px] text-[#8a8171] mono">(SSO)</span>
    </button>
  );
}
