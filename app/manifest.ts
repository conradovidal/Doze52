import type { MetadataRoute } from "next";
import { THEME_CHROME_COLOR_FALLBACK } from "@/lib/theme-shared";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Doze 52",
    short_name: "Doze 52",
    description: "Planejamento visual anual com foco semanal.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: THEME_CHROME_COLOR_FALLBACK,
    theme_color: THEME_CHROME_COLOR_FALLBACK,
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/doze52-favicon-light.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
