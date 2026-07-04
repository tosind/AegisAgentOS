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
      <body className="min-h-screen overflow-x-hidden bg-[#090907] text-[#f5f0e4] antialiased">
        <ToastProvider>
          <Sidebar />
          <main className="min-w-0 pt-[8.75rem] lg:ml-72 lg:pt-0">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
