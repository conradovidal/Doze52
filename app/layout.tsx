import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { FAVICON_URL } from "@/lib/theme-shared";
import { ThemeProvider } from "@/lib/theme";
import { FeedbackProvider } from "@/components/ui/feedback-provider";
import { ThemeInitScript } from "@/components/theme-init-script";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  applicationName: "Doze 52",
  title: "Doze 52 | Sistema de estruturação de foco",
  description: "Planejamento visual anual com revisao mensal e habitos.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Doze 52",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      {
        url: FAVICON_URL,
        type: "image/svg+xml",
      },
    ],
    apple: [
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="h-dvh overflow-hidden bg-background text-foreground md:h-auto md:min-h-screen md:overflow-visible">
        <ThemeInitScript />
        <ThemeProvider>
          <FeedbackProvider>
            <AuthProvider>
              <div className="flex h-dvh flex-col overflow-hidden md:h-auto md:min-h-screen md:overflow-visible">
                <div className="min-h-0 flex-1 overflow-hidden md:overflow-visible">
                  {children}
                </div>
                <SiteFooter />
              </div>
            </AuthProvider>
          </FeedbackProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
