import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { THEME_FAVICON_URLS } from "@/lib/theme-shared";
import { ThemeProvider } from "@/lib/theme";
import { FeedbackProvider } from "@/components/ui/feedback-provider";
import { ThemeInitScript } from "@/components/theme-init-script";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Doze 52 | Sistema de estruturação de foco",
  description: "Planejamento visual anual com revisao mensal e habitos.",
  icons: {
    icon: [
      {
        url: THEME_FAVICON_URLS.light,
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: THEME_FAVICON_URLS.dark,
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
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
      <body className="min-h-screen bg-background text-foreground">
        <ThemeInitScript />
        <ThemeProvider>
          <FeedbackProvider>
            <AuthProvider>
              <div className="flex min-h-screen flex-col">
                <div className="flex-1">{children}</div>
                <SiteFooter />
              </div>
            </AuthProvider>
          </FeedbackProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
