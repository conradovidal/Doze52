"use client";

import * as m from "motion/react-m";

import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

export type AnimatedProgressProps = {
  value: number;
  label: string;
  statusText?: string;
  // Para quando o contexto ao redor já diz o que a barra mede: o texto sai
  // da tela, mas `label`/`statusText` seguem descrevendo a barra para
  // leitores de tela.
  hideLabel?: boolean;
  className?: string;
};

export function AnimatedProgress({
  value,
  label,
  statusText,
  hideLabel = false,
  className,
}: AnimatedProgressProps) {
  const normalizedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn(!hideLabel && "space-y-2", className)}>
      {hideLabel ? null : (
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="font-medium text-foreground">{label}</span>
          {statusText ? (
            <span className="text-muted-foreground">{statusText}</span>
          ) : null}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(normalizedValue)}
        aria-valuetext={statusText}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <m.div
          className="h-full origin-left rounded-full bg-primary"
          initial={false}
          animate={{ scaleX: normalizedValue / 100 }}
          transition={{ duration: MOTION_DURATION.transition, ease: MOTION_EASE }}
        />
      </div>
    </div>
  );
}
