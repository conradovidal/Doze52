import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { ThemeInitScript } from "@/components/theme-init-script";
import { SiteFooter } from "@/components/site-footer";

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
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col bg-background text-foreground">
        <ThemeInitScript />
        <ThemeProvider>
          <AuthProvider>
            <div className="flex min-h-screen flex-1 flex-col">
              <div className="flex-1">{children}</div>
              <SiteFooter />
            </div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
