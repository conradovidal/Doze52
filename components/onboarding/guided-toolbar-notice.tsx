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
    | "habit-surface"
    | "habit-showcase"
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

type AnchorPlacement =
  | "below-start"
  | "below-center"
  | "below-end"
  | "right-center"
  | "left-center"
  | "above-center";

export function GuidedToolbarNoticeCard({
  notice,
  onClose,
  onAction,
  align = "start",
  placement = "below",
  portaled = false,
  anchorSelector,
  anchorPlacement = "below-center",
  portalTargetSelector,
}: {
  notice: GuidedToolbarNotice;
  onClose: () => void;
  onAction?: () => void;
  align?: "start" | "end";
  placement?: "below" | "right" | "above" | "viewport" | "panel";
  portaled?: boolean;
  anchorSelector?: string;
  anchorPlacement?: AnchorPlacement;
  portalTargetSelector?: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  const cardRef = React.useRef<HTMLElement | null>(null);
  const [anchorPosition, setAnchorPosition] = React.useState<React.CSSProperties | null>(null);
  React.useEffect(() => setMounted(true), []);

  React.useLayoutEffect(() => {
    if (!mounted || !anchorSelector || !portaled) return;
    const anchor = document.querySelector<HTMLElement>(anchorSelector);
    const cardElement = cardRef.current;
    if (!anchor || !cardElement) return;

    const gap = 12;
    const edge = 12;
    const desktopMedia = window.matchMedia("(min-width: 768px)");
    const opposite: Record<AnchorPlacement, AnchorPlacement> = {
      "below-start": "above-center",
      "below-center": "above-center",
      "below-end": "above-center",
      "right-center": "left-center",
      "left-center": "right-center",
      "above-center": "below-center",
    };
    const calculate = (placement: AnchorPlacement, anchorRect: DOMRect, cardRect: DOMRect) => {
      switch (placement) {
        case "below-start": return { left: anchorRect.left, top: anchorRect.bottom + gap };
        case "below-end": return { left: anchorRect.right - cardRect.width, top: anchorRect.bottom + gap };
        case "right-center": return { left: anchorRect.right + gap, top: anchorRect.top + (anchorRect.height - cardRect.height) / 2 };
        case "left-center": return { left: anchorRect.left - cardRect.width - gap, top: anchorRect.top + (anchorRect.height - cardRect.height) / 2 };
        case "above-center": return { left: anchorRect.left + (anchorRect.width - cardRect.width) / 2, top: anchorRect.top - cardRect.height - gap };
        default: return { left: anchorRect.left + (anchorRect.width - cardRect.width) / 2, top: anchorRect.bottom + gap };
      }
    };
    const overflow = (position: { left: number; top: number }, rect: DOMRect) =>
      Math.max(0, edge - position.left) + Math.max(0, edge - position.top) +
      Math.max(0, position.left + rect.width + edge - window.innerWidth) +
      Math.max(0, position.top + rect.height + edge - window.innerHeight);
    const update = () => {
      if (!desktopMedia.matches) {
        setAnchorPosition(null);
        return;
      }
      const anchorRect = anchor.getBoundingClientRect();
      const cardRect = cardElement.getBoundingClientRect();
      const rootRect = portalTargetSelector
        ? document.querySelector<HTMLElement>(portalTargetSelector)?.getBoundingClientRect()
        : null;
      const preferred = calculate(anchorPlacement, anchorRect, cardRect);
      const alternate = calculate(opposite[anchorPlacement], anchorRect, cardRect);
      const candidate = overflow(preferred, cardRect) <= overflow(alternate, cardRect) ? preferred : alternate;
      const nextPosition = {
        left: Math.min(
          Math.max(rootRect ? rootRect.left + edge : edge, candidate.left),
          (rootRect ? rootRect.right : window.innerWidth) - cardRect.width - edge
        ) - (rootRect?.left ?? 0),
        top: Math.min(
          Math.max(rootRect ? rootRect.top + edge : edge, candidate.top),
          (rootRect ? rootRect.bottom : window.innerHeight) - cardRect.height - edge
        ) - (rootRect?.top ?? 0),
      };
      setAnchorPosition((current) =>
        current &&
        Math.abs(Number(current.left) - nextPosition.left) < 0.5 &&
        Math.abs(Number(current.top) - nextPosition.top) < 0.5
          ? current
          : nextPosition
      );
    };
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    observer.observe(cardElement);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { capture: true, passive: true });
    desktopMedia.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
      desktopMedia.removeEventListener("change", update);
    };
  }, [anchorPlacement, anchorSelector, mounted, portaled, portalTargetSelector]);

  const card = (
    <aside
      ref={cardRef}
      data-guided-toolbar-notice
      data-guided-toolbar-target={notice.target}
      aria-label="Instrução do guia inicial"
      aria-live="polite"
      className={cn(
        "inverse-product-surface fixed top-[calc(env(safe-area-inset-top,0px)+4.6rem)] left-3 z-[90] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-card p-3.5 text-left text-card-foreground shadow-[0_24px_60px_-20px_rgba(15,23,42,0.85)] md:absolute",
        anchorSelector && portaled
          ? cn(
              portalTargetSelector ? "md:absolute" : "md:fixed",
              "md:translate-x-0",
              !anchorPosition && "md:opacity-0"
            )
          : placement === "viewport"
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
      style={anchorSelector && portaled ? (anchorPosition ?? undefined) : undefined}
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
    if (!mounted) return null;
    const portalTarget = portalTargetSelector
      ? document.querySelector<HTMLElement>(portalTargetSelector)
      : document.body;
    return portalTarget ? createPortal(card, portalTarget) : null;
  }
  return card;
}
