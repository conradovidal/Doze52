"use client";

import * as React from "react";

const FADE_SIZE_PX = 28;

/**
 * Fades the edges of a horizontally-scrollable element toward transparent
 * wherever there is more content to scroll to, instead of clipping it with
 * a hard edge. Only the sides that actually have overflow get a fade, so a
 * fully-visible row stays flat.
 *
 * Uses a callback ref (rather than a plain object ref) so the observers are
 * re-attached whenever React swaps the underlying DOM node — an object ref's
 * mutation doesn't trigger effects, which would silently leave the fade
 * watching a detached element.
 */
export function useScrollEdgeFade<T extends HTMLElement>() {
  const [node, setNode] = React.useState<T | null>(null);
  const [mask, setMask] = React.useState<string | undefined>(undefined);

  const ref = React.useCallback((el: T | null) => {
    setNode(el);
  }, []);

  const update = React.useCallback(() => {
    if (!node) return;
    const { scrollLeft, scrollWidth, clientWidth } = node;
    const canScroll = scrollWidth > clientWidth + 1;
    if (!canScroll) {
      setMask(undefined);
      return;
    }
    const fadeStart = !(scrollLeft <= 1);
    const fadeEnd = !(scrollLeft >= scrollWidth - clientWidth - 1);
    if (!fadeStart && !fadeEnd) {
      setMask(undefined);
      return;
    }
    const startStop = fadeStart ? `${FADE_SIZE_PX}px` : "0px";
    const endStop = fadeEnd ? `calc(100% - ${FADE_SIZE_PX}px)` : "100%";
    setMask(
      `linear-gradient(to right, ${fadeStart ? "transparent" : "black"}, black ${startStop}, black ${endStop}, ${fadeEnd ? "transparent" : "black"})`
    );
  }, [node]);

  React.useEffect(() => {
    if (!node) return;
    update();

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(node);
    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(node, { childList: true, subtree: true });

    node.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      node.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [node, update]);

  const style = mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined;

  return { ref, style };
}
