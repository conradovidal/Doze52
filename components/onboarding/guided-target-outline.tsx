"use client";

import * as React from "react";
import { createPortal } from "react-dom";

const getTargetRect = (selector: string, multiple: boolean) => {
  const elements = multiple
    ? Array.from(document.querySelectorAll<HTMLElement>(selector))
    : [document.querySelector<HTMLElement>(selector)].filter(
        (element): element is HTMLElement => Boolean(element)
      );
  const visibleRects = elements
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0);
  if (visibleRects.length === 0) return null;

  const left = Math.min(...visibleRects.map((rect) => rect.left));
  const top = Math.min(...visibleRects.map((rect) => rect.top));
  const right = Math.max(...visibleRects.map((rect) => rect.right));
  const bottom = Math.max(...visibleRects.map((rect) => rect.bottom));
  return { left, top, width: right - left, height: bottom - top };
};

export function GuidedTargetOutline({
  selector,
  multiple = false,
  padding = 3,
  radius = 13,
}: {
  selector: string;
  multiple?: boolean;
  padding?: number;
  radius?: number;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [rect, setRect] = React.useState<ReturnType<typeof getTargetRect>>(null);

  React.useEffect(() => setMounted(true), []);
  React.useLayoutEffect(() => {
    if (!mounted) return;

    const update = () => setRect(getTargetRect(selector, multiple));
    const frame = requestAnimationFrame(update);
    // O alvo às vezes mora dentro de um modal/painel que ainda está em
    // transição de entrada quando a primeira medição roda (o rAF pega uma
    // posição intermediária da animação) — remede em alguns instantes depois
    // pra assentar na posição final, sem depender só de Resize/Mutation.
    const settleTimeouts = [80, 200, 400].map((delay) =>
      window.setTimeout(update, delay)
    );
    const observer = new ResizeObserver(update);
    const targets = multiple
      ? document.querySelectorAll<HTMLElement>(selector)
      : [document.querySelector<HTMLElement>(selector)].filter(
          (element): element is HTMLElement => Boolean(element)
        );
    targets.forEach((target) => observer.observe(target));
    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(frame);
      settleTimeouts.forEach((timeout) => window.clearTimeout(timeout));
      observer.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [mounted, multiple, selector]);

  if (!mounted || !rect) return null;
  return createPortal(
    <div
      data-guided-target-outline
      aria-hidden="true"
      className="pointer-events-none fixed z-[62] border border-foreground/55"
      style={{
        left: rect.left - padding,
        top: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
        borderRadius: radius,
      }}
    />,
    document.body
  );
}
