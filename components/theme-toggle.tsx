"use client";

import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { mode, setTheme } = useTheme();
  const isLight = mode === "light";
  const nextMode = isLight ? "dark" : "light";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextMode)}
      aria-label={isLight ? "Ativar tema escuro" : "Ativar tema claro"}
      title={isLight ? "Tema claro" : "Tema escuro"}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border/65 bg-background/70 text-muted-foreground shadow-none transition-colors duration-150",
        "hover:border-border/80 hover:bg-muted/45 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      )}
    >
      <span className="sr-only">
        {isLight ? "Mudar para tema escuro" : "Mudar para tema claro"}
      </span>
      {isLight ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
    </button>
  );
}
