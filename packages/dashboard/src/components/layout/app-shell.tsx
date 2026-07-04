"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const authRoute = pathname.startsWith("/auth");

  if (authRoute) {
    return <main className="min-h-screen min-w-0">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="min-w-0 pt-[8.75rem] lg:ml-72 lg:pt-0">{children}</main>
    </>
  );
}
