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
    <div className="flex min-h-screen items-center justify-center bg-[#170d02] px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="display mb-7 text-xs font-semibold text-[#ffac02]">
            Paperclip<span className="mx-3 inline-block h-1.5 w-1.5 bg-[#ffac02] align-middle" />Enterprise
          </div>
          <h1 className="display text-3xl font-semibold text-[#fff7e8]">
            <span className="text-[#ffac02]">Aegis</span> Agent OS
          </h1>
          <p className="mt-2 text-sm text-[#9b8460]">
            Sign in to the enterprise agent command center
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-none bg-[#ff8a61]/10 border border-[#ff8a61]/20 text-[#ff8a61] text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="mono mb-1.5 block text-[11px] uppercase text-[#d8c19d]">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-none border border-[#4a2b08] bg-[#120800] px-3 py-2.5 text-sm text-[#fff7e8] focus:border-[#ffac02] focus:outline-none"
                placeholder="admin@enterprise.local"
                required
              />
            </div>

            <div>
              <label className="mono mb-1.5 block text-[11px] uppercase text-[#d8c19d]">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-none border border-[#4a2b08] bg-[#120800] px-3 py-2.5 text-sm text-[#fff7e8] focus:border-[#ffac02] focus:outline-none"
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

          <div className="mt-6 border-t border-[#4a2b08] pt-6">
            <p className="mono text-center text-[10px] uppercase text-[#9b8460]">
              Local admin: admin@enterprise.local / DASHBOARD_ADMIN_PASSWORD
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
      className="mono flex w-full items-center justify-center gap-2 rounded-none border border-[#4a2b08] px-4 py-2.5 text-[11px] uppercase transition-colors hover:bg-white/[0.02]"
      disabled
    >
      Continue with {provider}
      <span className="text-[10px] text-[#9b8460] mono">(SSO)</span>
    </button>
  );
}
