"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { getStoredSession, clearSession } from "@/lib/auth-helpers";
import {
  Cable,
  Gauge,
  LayoutDashboard,
  LogOut,
  Rocket,
  ScrollText,
  Settings,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "Command" },
  { href: "/agents", icon: UsersRound, label: "Agents" },
  { href: "/policies", icon: ShieldCheck, label: "Policies" },
  { href: "/audit", icon: ScrollText, label: "Audit" },
  { href: "/integrations", icon: Cable, label: "Integrations" },
  { href: "/settings", icon: Settings, label: "Settings" },
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
    <>
    <div className="fixed inset-x-0 top-0 z-50 max-w-full overflow-hidden border-b border-[#332d20] bg-[#0c0b08]/96 backdrop-blur lg:hidden">
      <div className="px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e3a21a] text-xs font-black text-[#160f02] shadow-[0_0_28px_rgba(227,162,26,0.18)]">
            AG
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold">
              <span className="text-[#e3a21a]">Aegis</span> Agent OS
            </h1>
            <p className="truncate text-[11px] font-medium text-[#8a8171]">
              Enterprise command center
            </p>
          </div>
        </Link>
      </div>
      <nav className="flex max-w-full gap-2 overflow-x-auto px-3 pb-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                isActive
                  ? "border-[#e3a21a]/30 bg-[#e3a21a]/12 text-[#f2c566]"
                  : "border-[#332d20] bg-[#14120d]/72 text-[#c8bea9]"
              }`}
            >
              <Icon size={15} className={isActive ? "text-[#e3a21a]" : "text-[#8a8171]"} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>

    <aside className="fixed z-40 hidden h-full w-72 flex-col border-r border-[#332d20] bg-[#0c0b08]/95 backdrop-blur transition-all lg:flex">
      {/* Brand */}
      <div className="p-5 border-b border-[#332d20]">
        <Link href="/" className="block">
          <h1 className="text-lg font-bold flex items-center gap-3">
            <span className="w-9 h-9 rounded-lg bg-[#e3a21a] text-[#160f02] flex items-center justify-center text-xs font-black shadow-[0_0_28px_rgba(227,162,26,0.18)]">
              AG
            </span>
            <span>
              <span className="text-[#e3a21a]">Aegis</span> Agent OS
            </span>
          </h1>
        </Link>
        <p className="text-[11px] text-[#8a8171] mt-2 font-medium">
          Paperclip-native enterprise command center
        </p>
      </div>

      <div className="px-4 py-4 border-b border-[#332d20]">
        <div className="panel p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[#c8bea9] flex items-center gap-2">
              <Gauge size={14} className="text-[#4fbcba]" />
              Runtime posture
            </span>
            <span className="badge badge-warning text-[10px] px-2 py-0.5">Alpha</span>
          </div>
          <div className="hairline my-3" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="mono text-sm text-[#f5f0e4]">3</div>
              <div className="text-[10px] text-[#8a8171]">Svc</div>
            </div>
            <div>
              <div className="mono text-sm text-[#77d28d]">0</div>
              <div className="text-[10px] text-[#8a8171]">Leaks</div>
            </div>
            <div>
              <div className="mono text-sm text-[#e3a21a]">24/7</div>
              <div className="text-[10px] text-[#8a8171]">Ops</div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                isActive
                  ? "bg-[#e3a21a]/10 text-[#f2c566] border border-[#e3a21a]/25"
                  : "text-[#c8bea9] hover:bg-[#e3a21a]/[0.06] hover:text-[#f5f0e4] border border-transparent"
              }`}
            >
              <Icon size={17} className={isActive ? "text-[#e3a21a]" : "text-[#8a8171] group-hover:text-[#e3a21a]"} />
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#e3a21a]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-[#332d20] space-y-3">
        <Link
          href="/onboarding"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#86d9d8] bg-[#4fbcba]/5 hover:bg-[#4fbcba]/10 transition-colors border border-[#4fbcba]/15"
        >
          <Rocket size={14} />
          Getting Started
        </Link>

        {session && (
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-lg bg-[#e3a21a]/15 flex items-center justify-center text-xs font-bold text-[#f2c566]">
              {session.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">
                {session.name || session.email}
              </div>
              <div className="text-[10px] text-[#8a8171] truncate">
                {session.roles?.join(", ") || "User"}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-[#8a8171] hover:text-[#ff8b6b] transition-colors text-xs"
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Version */}
      <div className="px-5 py-3 border-t border-[#332d20]">
        <div className="text-[10px] text-[#8a8171] mono">
          v1.0.0-alpha • Build 1
        </div>
      </div>
    </aside>
    </>
  );
}
