"use client";

import * as React from "react";
import * as m from "motion/react-m";

import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type SegmentedControlOption<T extends string> = {
  value: T;
  label: React.ReactNode;
};

export type SegmentedControlProps<T extends string> = {
  value: T;
  options: readonly SegmentedControlOption<T>[];
  onValueChange: (value: T) => void;
  "aria-label": string;
  className?: string;
};

export function SegmentedControl<T extends string>({
  value,
  options,
  onValueChange,
  "aria-label": ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );

  function selectByIndex(index: number) {
    const normalizedIndex = (index + options.length) % options.length;
    const option = options[normalizedIndex];
    if (!option) return;
    onValueChange(option.value);
    refs.current[normalizedIndex]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-grid min-w-56 grid-flow-col auto-cols-fr rounded-xl border border-border/70 bg-muted/55 p-1",
        className
      )}
    >
      <m.span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 rounded-lg bg-background shadow-sm ring-1 ring-border/60"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})` }}
        initial={false}
        animate={{ x: `${activeIndex * 100}%` }}
        transition={{ duration: MOTION_DURATION.transition, ease: MOTION_EASE }}
      />
      {options.map((option, index) => (
        <button
          key={option.value}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={value === option.value ? 0 : -1}
          className="relative z-10 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 aria-checked:text-foreground"
          onClick={() => onValueChange(option.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              selectByIndex(index + 1);
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              selectByIndex(index - 1);
            } else if (event.key === "Home") {
              event.preventDefault();
              selectByIndex(0);
            } else if (event.key === "End") {
              event.preventDefault();
              selectByIndex(options.length - 1);
            }
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
