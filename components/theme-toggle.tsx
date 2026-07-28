"use client";

import * as React from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "@/lib/theme";
import type { ThemeMode } from "@/lib/theme-shared";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  highlighted = false,
  disabled = false,
  onThemeChange,
}: {
  highlighted?: boolean;
  disabled?: boolean;
  onThemeChange?: (mode: ThemeMode) => void;
}) {
  const { mode, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  const renderedMode = mounted ? mode : "light";
  const isLight = renderedMode === "light";
  const nextMode = isLight ? "dark" : "light";

  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <button
      type="button"
      disabled={disabled}
      data-onboarding-theme-control
      data-onboarding-highlighted={highlighted ? "true" : undefined}
      onClick={() => {
        setTheme(nextMode);
        onThemeChange?.(nextMode);
      }}
      aria-label={isLight ? "Ativar tema escuro" : "Ativar tema claro"}
      title={isLight ? "Tema claro" : "Tema escuro"}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-border bg-card text-muted-foreground shadow-none transition-colors duration-150 md:h-9 md:w-9",
        "hover:border-foreground/18 hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        disabled && "cursor-not-allowed opacity-45",
        highlighted &&
          "border-primary text-primary ring-4 ring-primary/18 animate-pulse motion-reduce:animate-none"
      )}
    >
      <span className="sr-only">
        {isLight ? "Mudar para tema escuro" : "Mudar para tema claro"}
      </span>
      {isLight ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
    </button>
  );
}
