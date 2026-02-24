import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { EnvBadge } from "@/components/env-badge";

export const metadata: Metadata = {
  title: "doze 52 | Sistema de estruturação de foco",
  description: "Planejamento visual anual com revisao mensal e habitos.",
  icons: {
    icon: [
      { url: "/icon.svg?v=20260224b", type: "image/svg+xml" },
      { url: "/favicon.ico?v=20260224b", sizes: "any" },
    ],
    shortcut: ["/favicon.ico?v=20260224b"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">
        <AuthProvider>
          {children}
          <EnvBadge />
        </AuthProvider>
      </body>
    </html>
  );
}
