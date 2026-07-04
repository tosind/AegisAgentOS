"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { getStoredSession, clearSession } from "@/lib/auth-helpers";

const NAV_ITEMS = [
  { href: "/", icon: "⌂", label: "Dashboard" },
  { href: "/agents", icon: "◈", label: "Agents" },
  { href: "/policies", icon: "◆", label: "Policies" },
  { href: "/audit", icon: "◫", label: "Audit Logs" },
  { href: "/integrations", icon: "⬡", label: "Integrations" },
  { href: "/settings", icon: "⚙", label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useMemo(() => {
    if (typeof window === "undefined") return null;
    return getStoredSession();
  }, []);

  const handleLogout = () => {
    clearSession();
    router.push("/auth/login");
  };

  return (
    <aside className="w-64 bg-[#0d0d16] border-r border-[#1e1e2e] flex flex-col fixed h-full z-40 transition-all">
      {/* Brand */}
      <div className="p-6 border-b border-[#1e1e2e]">
        <Link href="/" className="block">
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-[#4c6ef5] flex items-center justify-center text-xs font-black">
              E
            </span>
            <span>
              <span className="text-[#4c6ef5]">Enterprise</span> Agent OS
            </span>
          </h1>
        </Link>
        <p className="text-[10px] text-[#6c757d] mt-1.5 uppercase tracking-widest font-medium">
          Self-Hosted AI Platform
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? "bg-[#4c6ef5]/10 text-[#4c6ef5] border border-[#4c6ef5]/20"
                  : "text-[#9ca3af] hover:bg-white/[0.03] hover:text-white border border-transparent"
              }`}
            >
              <span
                className={`text-base transition-transform duration-150 ${
                  isActive ? "scale-110" : "group-hover:scale-105"
                }`}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#4c6ef5]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-[#1e1e2e] space-y-3">
        <Link
          href="/onboarding"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#4c6ef5] bg-[#4c6ef5]/5 hover:bg-[#4c6ef5]/10 transition-colors border border-[#4c6ef5]/10"
        >
          <span>🚀</span>
          Getting Started
        </Link>

        {session && (
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-full bg-[#4c6ef5]/20 flex items-center justify-center text-xs font-bold text-[#4c6ef5]">
              {session.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">
                {session.name || session.email}
              </div>
              <div className="text-[10px] text-[#6c757d] truncate">
                {session.roles?.join(", ") || "User"}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-[#6c757d] hover:text-[#f03e3e] transition-colors text-xs"
              title="Sign Out"
            >
              ↵
            </button>
          </div>
        )}
      </div>

      {/* Version */}
      <div className="px-6 py-3 border-t border-[#1e1e2e]">
        <div className="text-[10px] text-[#6c757d] font-mono">
          v1.0.0-alpha • Build 1
        </div>
      </div>
    </aside>
  );
}
