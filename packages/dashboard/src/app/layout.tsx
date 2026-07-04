import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Enterprise Agent OS",
  description:
    "Self-hosted AI agent platform — internal agents, zero data leakage, 24/7 enterprise workforce",
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
          <main className="flex-1 ml-64">{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
