"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GuidedToolbarNotice = {
  target:
    | "edit"
    | "calendars"
    | "year"
    | "period-navigation"
    | "habit"
    | "habit-created"
    | "profile"
    | "appearance"
    | "theme";
  title: string;
  instruction: string;
  actionLabel?: string;
  stepLabel?: string;
};

export function GuidedToolbarNoticeCard({
  notice,
  onClose,
  onAction,
  align = "start",
  placement = "below",
  portaled = false,
}: {
  notice: GuidedToolbarNotice;
  onClose: () => void;
  onAction?: () => void;
  align?: "start" | "end";
  placement?: "below" | "right" | "above" | "viewport" | "panel";
  portaled?: boolean;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const card = (
    <aside
      data-guided-toolbar-notice
      data-guided-toolbar-target={notice.target}
      aria-label="Instrução do guia inicial"
      aria-live="polite"
      className={cn(
        "inverse-product-surface fixed top-[calc(env(safe-area-inset-top,0px)+4.6rem)] left-3 z-[90] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-card p-3.5 text-left text-card-foreground shadow-[0_24px_60px_-20px_rgba(15,23,42,0.85)] md:absolute",
        placement === "viewport"
          ? "md:fixed md:top-auto md:bottom-6 md:left-1/2 md:-translate-x-1/2"
          : placement === "panel"
            ? "md:absolute md:top-auto md:right-6 md:bottom-6 md:left-auto md:translate-x-0"
          : placement === "right"
          ? "md:top-0 md:left-[calc(100%+0.75rem)]"
          : placement === "above"
            ? "md:top-auto md:bottom-[calc(100%+0.6rem)] md:left-1/2 md:-translate-x-1/2"
            : "md:top-[calc(100%+0.6rem)]",
        placement === "below" &&
          (align === "start" ? "md:left-0" : "md:right-0 md:left-auto")
      )}
    >
      <div className="pr-7">
        <div className="min-w-0">
          {notice.stepLabel ? (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
              {notice.stepLabel}
            </p>
          ) : null}
          <p className="text-base font-semibold leading-5">
            {notice.title}
          </p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {notice.instruction}
          </p>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="absolute top-2.5 right-2.5 rounded-full"
        aria-label="Encerrar guia inicial"
        onClick={onClose}
      >
        <X />
      </Button>
      {notice.actionLabel && onAction ? (
        <Button
          type="button"
          variant="premium"
          size="sm"
          className="mt-3 w-full"
          onClick={onAction}
        >
          <Check className="size-4" aria-hidden="true" />
          {notice.actionLabel}
        </Button>
      ) : null}
    </aside>
  );

  if (portaled) {
    return mounted ? createPortal(card, document.body) : null;
  }
  return card;
}
