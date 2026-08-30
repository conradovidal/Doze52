"use client";

import * as React from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { useTheme } from "@/lib/theme";
import type { ThemeMode } from "@/lib/theme-shared";
import { cn } from "@/lib/utils";

export function ThemeToggle({
  highlighted = false,
  disabled = false,
  variant = "button",
  onThemeChange,
}: {
  highlighted?: boolean;
  disabled?: boolean;
  variant?: "button" | "bare";
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
        "inline-flex items-center justify-center text-muted-foreground shadow-none transition-colors duration-150",
        variant === "bare"
          ? "size-9 rounded-full hover:bg-muted hover:text-foreground"
          : "h-8 w-8 rounded-[10px] border border-border bg-card hover:border-foreground/18 hover:bg-muted hover:text-foreground md:h-9 md:w-9",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        disabled && "cursor-not-allowed opacity-45",
        highlighted && "product-spotlight-target"
      )}
    >
      <span className="sr-only">
        {isLight ? "Mudar para tema escuro" : "Mudar para tema claro"}
      </span>
      {isLight ? <MoonStar className="h-4 w-4" /> : <SunMedium className="h-4 w-4" />}
    </button>
  );
}
