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
        "inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        isLight
          ? "border-foreground/30 bg-foreground text-background shadow-sm"
          : "border-border bg-muted text-muted-foreground hover:bg-accent"
      )}
    >
      {isLight ? <Lightbulb size={15} /> : <LightbulbOff size={15} />}
    </button>
  );
}
