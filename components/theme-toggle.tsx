"use client";

import { Lightbulb, LightbulbOff } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { mode, toggleTheme } = useTheme();
  const isLight = mode === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isLight ? "Ativar tema escuro" : "Ativar tema claro"}
      aria-pressed={isLight}
      title={isLight ? "Luz acesa (tema claro)" : "Luz apagada (tema escuro)"}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        isLight
          ? "border-amber-300 bg-amber-100 text-amber-700 shadow-[0_0_16px_rgba(245,158,11,0.35)]"
          : "border-border bg-muted text-muted-foreground hover:bg-accent"
      )}
    >
      {isLight ? <Lightbulb size={14} /> : <LightbulbOff size={14} />}
    </button>
  );
}
