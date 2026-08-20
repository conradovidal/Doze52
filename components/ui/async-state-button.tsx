"use client";

import * as React from "react";
import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

import { MOTION_DURATION, MOTION_EASE } from "@/lib/motion";
import { Button } from "@/components/ui/button";

export type AsyncButtonState = "idle" | "pending" | "success" | "error";

export type AsyncStateButtonProps = React.ComponentProps<typeof Button> & {
  state: AsyncButtonState;
  pendingLabel?: React.ReactNode;
  successLabel?: React.ReactNode;
  errorLabel?: React.ReactNode;
};

const stateIcons: Record<Exclude<AsyncButtonState, "idle">, React.ReactNode> = {
  pending: (
    <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
  ),
  success: <Check aria-hidden="true" />,
  error: <TriangleAlert aria-hidden="true" />,
};

export function AsyncStateButton({
  state,
  pendingLabel = "Processando…",
  successLabel = "Concluído",
  errorLabel = "Tentar novamente",
  children,
  disabled,
  size = "default",
  ...props
}: AsyncStateButtonProps) {
  const isIconOnly = typeof size === "string" && size.startsWith("icon");
  const labels: Record<AsyncButtonState, React.ReactNode> = {
    idle: children,
    pending: pendingLabel,
    success: successLabel,
    error: errorLabel,
  };

  const activeContent = (
    <>
      {state !== "idle" ? stateIcons[state] : null}
      {labels[state]}
    </>
  );

  return (
    <Button
      {...props}
      size={size}
      disabled={disabled || state === "pending"}
      aria-busy={state === "pending" || undefined}
    >
      <span className="relative inline-grid min-w-0 place-items-center overflow-hidden">
        {!isIconOnly
          ? Object.entries(labels).map(([labelState, label]) => (
              <span
                key={labelState}
                aria-hidden="true"
                className="invisible col-start-1 row-start-1 inline-flex items-center gap-2"
              >
                {labelState !== "idle"
                  ? stateIcons[labelState as Exclude<AsyncButtonState, "idle">]
                  : null}
                {label}
              </span>
            ))
          : null}
        <AnimatePresence mode="popLayout" initial={false}>
          <m.span
            key={state}
            className="col-start-1 row-start-1 inline-flex items-center gap-2"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: MOTION_DURATION.micro, ease: MOTION_EASE }}
          >
            {isIconOnly
              ? state === "idle"
                ? children
                : stateIcons[state]
              : activeContent}
          </m.span>
        </AnimatePresence>
      </span>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {state === "idle" ? null : labels[state]}
      </span>
    </Button>
  );
}
