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
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/80 bg-background text-muted-foreground shadow-sm transition-colors duration-150",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      )}
    >
      <span className="sr-only">
        {isLight ? "Mudar para tema escuro" : "Mudar para tema claro"}
      </span>
      {isLight ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
    </button>
  );
}
