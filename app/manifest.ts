import type { MetadataRoute } from "next";
import { THEME_CHROME_COLOR_FALLBACK } from "@/lib/theme-shared";

export default function manifest(): MetadataRoute.Manifest {
  return {
    // `id` é a identidade do app instalado (e do futuro TWA): nunca mudar.
    id: "/",
    name: "Doze 52",
    short_name: "Doze 52",
    description: "Planejamento visual anual com foco semanal.",
    lang: "pt-BR",
    dir: "ltr",
    categories: ["productivity", "lifestyle"],
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    // O manifest não tem variante escura; o tema escuro vem do <meta
    // theme-color> por media query (ver `viewport` em app/layout.tsx).
    background_color: THEME_CHROME_COLOR_FALLBACK,
    theme_color: THEME_CHROME_COLOR_FALLBACK,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
