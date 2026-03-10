"use client";

import * as React from "react";
import { Lightbulb, LightbulbOff } from "lucide-react";
import { useTheme } from "@/lib/theme";
import type { ThemeMode } from "@/lib/theme-shared";
import { cn } from "@/lib/utils";

const TOGGLE_WIDTH_PX = 84;
const TOGGLE_HEIGHT_PX = 40;
const TRACK_INSET_PX = 2;
const KNOB_SIZE_PX = TOGGLE_HEIGHT_PX - TRACK_INSET_PX * 2;
const KNOB_OFFSET_PX = TOGGLE_WIDTH_PX - KNOB_SIZE_PX - TRACK_INSET_PX * 2;
const EXPAND_MS = 170;
const COLLAPSE_MS = 180;

export function ThemeToggle() {
  const { mode, setTheme } = useTheme();
  const isLight = mode === "light";
  const [phase, setPhase] = React.useState<"idle" | "expand" | "collapse">("idle");
  const [pendingMode, setPendingMode] = React.useState<ThemeMode | null>(null);
  const expandTimerRef = React.useRef<number | null>(null);
  const collapseTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (expandTimerRef.current !== null) {
        window.clearTimeout(expandTimerRef.current);
      }
      if (collapseTimerRef.current !== null) {
        window.clearTimeout(collapseTimerRef.current);
      }
    };
  }, []);

  const isAnimating = phase !== "idle";
  const nextMode = mode === "light" ? "dark" : "light";
  const iconMode = phase === "expand" ? mode : (pendingMode ?? mode);
  const knobTintClass =
    iconMode === "light"
      ? "bg-foreground text-background"
      : "bg-background text-foreground";

  const knobWidth = phase === "expand" ? TOGGLE_WIDTH_PX - TRACK_INSET_PX * 2 : KNOB_SIZE_PX;
  const knobLeft =
    phase === "expand"
      ? TRACK_INSET_PX
      : (pendingMode ?? mode) === "light"
        ? TRACK_INSET_PX
        : TRACK_INSET_PX + KNOB_OFFSET_PX;

  const handleClick = () => {
    if (isAnimating) return;
    const targetMode = nextMode;
    setPendingMode(targetMode);
    setPhase("expand");

    expandTimerRef.current = window.setTimeout(() => {
      setTheme(targetMode);
      setPhase("collapse");

      collapseTimerRef.current = window.setTimeout(() => {
        setPhase("idle");
        setPendingMode(null);
      }, COLLAPSE_MS);
    }, EXPAND_MS);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isLight ? "Ativar tema escuro" : "Ativar tema claro"}
      aria-pressed={isLight}
      title={isLight ? "Luz acesa (tema claro)" : "Luz apagada (tema escuro)"}
      disabled={isAnimating}
      className={cn(
        "relative inline-flex h-10 items-center overflow-hidden rounded-full border transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70",
        "border-border bg-neutral-100 text-muted-foreground shadow-sm",
        "hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700",
        isAnimating ? "cursor-default" : "cursor-pointer"
      )}
      style={{ width: `${TOGGLE_WIDTH_PX}px` }}
    >
      <span className="sr-only">
        {isLight ? "Mudar para tema escuro" : "Mudar para tema claro"}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-0 rounded-full shadow-sm transition-[left,width,transform,background-color,color] duration-180 ease-out",
          knobTintClass
        )}
        style={{
          left: `${knobLeft}px`,
          width: `${knobWidth}px`,
          height: `${KNOB_SIZE_PX}px`,
          top: `${TRACK_INSET_PX}px`,
          transitionDuration: `${phase === "expand" ? EXPAND_MS : COLLAPSE_MS}ms`,
        }}
      >
        <span className="flex h-full w-full items-center justify-center">
          {iconMode === "light" ? <Lightbulb size={15} /> : <LightbulbOff size={15} />}
        </span>
      </span>
    </button>
  );
}
