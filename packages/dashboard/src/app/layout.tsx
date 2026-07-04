import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aegis Agent OS",
  description:
    "Self-hosted enterprise agent command center with Paperclip orchestration, local LLM routing, and audit-first governance",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex bg-[#0a0a0f] text-[#f8f9fa] antialiased">
        <ToastProvider>
          <Sidebar />
          <main className="flex-1 ml-72">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
