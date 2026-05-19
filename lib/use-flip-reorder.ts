"use client";

import * as React from "react";

type FlipOptions = {
  durationMs?: number;
  easing?: string;
};

const DEFAULT_DURATION_MS = 160;
const DEFAULT_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

export function useFlipReorder(
  orderedIds: readonly string[],
  { durationMs = DEFAULT_DURATION_MS, easing = DEFAULT_EASING }: FlipOptions = {}
) {
  const nodesRef = React.useRef(new Map<string, HTMLElement>());
  const previousRectsRef = React.useRef(new Map<string, DOMRect>());
  const orderSignature = JSON.stringify(orderedIds);

  const registerNode = React.useCallback((id: string, node: HTMLElement | null) => {
    if (node) {
      nodesRef.current.set(id, node);
      return;
    }
    nodesRef.current.delete(id);
  }, []);

  React.useLayoutEffect(() => {
    const ids: string[] = JSON.parse(orderSignature);
    const nextRects = new Map<string, DOMRect>();
    const animations: Animation[] = [];

    for (const id of ids) {
      const node = nodesRef.current.get(id);
      if (!node) continue;

      const currentRect = node.getBoundingClientRect();
      nextRects.set(id, currentRect);

      const previousRect = previousRectsRef.current.get(id);
      if (!previousRect) continue;

      const dx = previousRect.left - currentRect.left;
      const dy = previousRect.top - currentRect.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) continue;

      const animation = node.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: durationMs,
          easing,
        }
      );
      animations.push(animation);
    }

    previousRectsRef.current = nextRects;

    return () => {
      for (const animation of animations) {
        animation.cancel();
      }
    };
  }, [orderSignature, durationMs, easing]);

  return registerNode;
}
