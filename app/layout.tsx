import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { BillingProvider } from "@/lib/use-billing";
import {
  FAVICON_URL,
  THEME_CHROME_COLOR_DARK,
  THEME_CHROME_COLOR_LIGHT,
} from "@/lib/theme-shared";
import { ThemeProvider } from "@/lib/theme";
import { FeedbackProvider } from "@/components/ui/feedback-provider";
import { ThemeInitScript } from "@/components/theme-init-script";
import { SiteFooter } from "@/components/site-footer";
import { CalendarCatalogProvider } from "@/lib/calendar-catalog/runtime";
import { MotionProvider } from "@/components/ui/motion-provider";

export const metadata: Metadata = {
  applicationName: "Doze 52",
  title: "Doze 52 | Seu ano em uma página",
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

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    {
      media: "(prefers-color-scheme: light)",
      color: THEME_CHROME_COLOR_LIGHT,
    },
    {
      media: "(prefers-color-scheme: dark)",
      color: THEME_CHROME_COLOR_DARK,
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="h-dvh overflow-hidden bg-background text-foreground">
        <ThemeInitScript />
        <ThemeProvider>
          <MotionProvider>
            <FeedbackProvider>
              <AuthProvider>
                <BillingProvider>
                  <CalendarCatalogProvider>
                    <div className="flex h-dvh flex-col overflow-hidden">
                      <div className="min-h-0 flex-1 overflow-auto">
                        {children}
                      </div>
                      <SiteFooter />
                    </div>
                  </CalendarCatalogProvider>
                </BillingProvider>
              </AuthProvider>
            </FeedbackProvider>
          </MotionProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
