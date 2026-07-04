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
      <div className="fixed inset-x-0 top-0 z-50 max-w-full overflow-hidden border-b border-[#4a2b08] bg-[#170d02]/96 backdrop-blur lg:hidden">
        <div className="px-4 py-3">
          <Link href="/" className="flex items-center gap-3">
            <span className="mono flex h-9 w-9 items-center justify-center rounded-none bg-[#ffac02] text-xs font-black text-[#170d02] shadow-[0_0_28px_rgba(255,172,2,0.18)]">
              AG
            </span>
            <div className="min-w-0">
              <h1 className="display truncate text-sm font-semibold text-[#fff7e8]">
                <span className="text-[#ffac02]">Aegis</span> Agent OS
              </h1>
              <p className="mono truncate text-[10px] uppercase text-[#9b8460]">
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
                className={`mono flex shrink-0 items-center gap-2 rounded-none border px-3 py-2 text-[11px] font-semibold uppercase transition-all ${
                  isActive
                    ? "border-[#ffac02]/30 bg-[#ffac02]/12 text-[#ffd8b0]"
                    : "border-[#4a2b08] bg-[#1c1004]/72 text-[#d8c19d]"
                }`}
              >
                <Icon size={15} className={isActive ? "text-[#ffac02]" : "text-[#9b8460]"} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

    <aside className="fixed z-40 hidden h-full w-72 flex-col border-r border-[#4a2b08] bg-[#170d02]/95 backdrop-blur transition-all lg:flex">
      {/* Brand */}
      <div className="p-5 border-b border-[#4a2b08]">
        <Link href="/" className="block">
          <h1 className="display flex items-center gap-3 text-sm font-semibold text-[#fff7e8]">
            <span className="mono flex h-9 w-9 items-center justify-center rounded-none bg-[#ffac02] text-xs font-black text-[#170d02] shadow-[0_0_28px_rgba(255,172,2,0.18)]">
              AG
            </span>
            <span>
              <span className="text-[#ffac02]">Aegis</span> Agent OS
            </span>
          </h1>
        </Link>
        <p className="mono mt-2 text-[10px] uppercase text-[#9b8460]">
          Paperclip-native enterprise command center
        </p>
      </div>

      <div className="px-4 py-4 border-b border-[#4a2b08]">
        <div className="panel p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="mono flex items-center gap-2 text-[11px] uppercase text-[#d8c19d]">
              <Gauge size={14} className="text-[#ffd8b0]" />
              Runtime posture
            </span>
            <span className="badge badge-warning text-[10px] px-2 py-0.5">Alpha</span>
          </div>
          <div className="hairline my-3" />
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="mono text-sm text-[#fff7e8]">3</div>
              <div className="text-[10px] text-[#9b8460]">Svc</div>
            </div>
            <div>
              <div className="mono text-sm text-[#9dffb5]">0</div>
              <div className="text-[10px] text-[#9b8460]">Leaks</div>
            </div>
            <div>
              <div className="mono text-sm text-[#ffac02]">24/7</div>
              <div className="text-[10px] text-[#9b8460]">Ops</div>
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
              className={`mono flex items-center gap-3 rounded-none px-3 py-2.5 text-[11px] font-semibold uppercase transition-all duration-150 group ${
                isActive
                  ? "bg-[#ffac02]/10 text-[#ffd8b0] border border-[#ffac02]/25"
                  : "text-[#d8c19d] hover:bg-[#ffac02]/[0.06] hover:text-[#fff7e8] border border-transparent"
              }`}
            >
              <Icon size={17} className={isActive ? "text-[#ffac02]" : "text-[#9b8460] group-hover:text-[#ffac02]"} />
              <span>{item.label}</span>
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#ffac02]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-[#4a2b08] space-y-3">
        <Link
          href="/onboarding"
          className="flex items-center gap-2 px-3 py-2 rounded-none text-xs font-medium text-[#ffd8b0] bg-[#ffd8b0]/5 hover:bg-[#ffd8b0]/10 transition-colors border border-[#ffd8b0]/15"
        >
          <Rocket size={14} />
          Getting Started
        </Link>

        {session && (
          <div className="flex items-center gap-3 px-1">
            <div className="w-8 h-8 rounded-none bg-[#ffac02]/15 flex items-center justify-center text-xs font-bold text-[#ffd8b0]">
              {session.name?.[0]?.toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">
                {session.name || session.email}
              </div>
              <div className="text-[10px] text-[#9b8460] truncate">
                {session.roles?.join(", ") || "User"}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-[#9b8460] hover:text-[#ff8a61] transition-colors text-xs"
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Version */}
      <div className="px-5 py-3 border-t border-[#4a2b08]">
        <div className="text-[10px] text-[#9b8460] mono">
          v1.0.0-alpha • Build 1
        </div>
      </div>
    </aside>
    </>
  );
}
