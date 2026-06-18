"use client";

import * as React from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { mode, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const isLight = mode === "light";
  const nextMode = isLight ? "dark" : "light";
  const label = mounted
    ? isLight
      ? "Ativar tema escuro"
      : "Ativar tema claro"
    : "Alternar tema";
  const title = mounted ? (isLight ? "Tema claro" : "Tema escuro") : "Tema";

  return (
    <button
      type="button"
      onClick={() => setTheme(nextMode)}
      aria-label={label}
      title={title}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border/65 bg-background/70 text-muted-foreground shadow-none transition-colors duration-150",
        "hover:border-border/80 hover:bg-muted/45 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      )}
    >
      <span className="sr-only">
        {mounted
          ? isLight
            ? "Mudar para tema escuro"
            : "Mudar para tema claro"
          : "Alternar tema"}
      </span>
      {!mounted || isLight ? (
        <MoonStar className="h-4 w-4" />
      ) : (
        <SunMedium className="h-4 w-4" />
      )}
    </button>
  );
}
