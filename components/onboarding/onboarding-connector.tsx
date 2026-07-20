"use client";

import * as React from "react";

type Point = { x: number; y: number };
type ConnectorGeometry = {
  path: string;
};

type OnboardingConnectorProps = {
  sourceSelector: string;
  targetSelector: string;
};

const getAnchors = (rect: DOMRect): Point[] => [
  { x: rect.left + rect.width / 2, y: rect.top },
  { x: rect.right, y: rect.top + rect.height / 2 },
  { x: rect.left + rect.width / 2, y: rect.bottom },
  { x: rect.left, y: rect.top + rect.height / 2 },
];

const getDistance = (a: Point, b: Point) =>
  Math.hypot(b.x - a.x, b.y - a.y);

const buildGeometry = (
  source: HTMLElement,
  target: HTMLElement
): ConnectorGeometry => {
  const sourceAnchors = getAnchors(source.getBoundingClientRect());
  const targetAnchors = getAnchors(target.getBoundingClientRect());
  let start = sourceAnchors[0];
  let end = targetAnchors[0];
  let shortestDistance = Number.POSITIVE_INFINITY;

  for (const sourceAnchor of sourceAnchors) {
    for (const targetAnchor of targetAnchors) {
      const distance = getDistance(sourceAnchor, targetAnchor);
      if (distance >= shortestDistance) continue;
      shortestDistance = distance;
      start = sourceAnchor;
      end = targetAnchor;
    }
  }

  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const path =
    Math.abs(deltaX) >= Math.abs(deltaY)
      ? `M ${start.x} ${start.y} C ${start.x + deltaX * 0.42} ${start.y}, ${end.x - deltaX * 0.42} ${end.y}, ${end.x} ${end.y}`
      : `M ${start.x} ${start.y} C ${start.x} ${start.y + deltaY * 0.42}, ${end.x} ${end.y - deltaY * 0.42}, ${end.x} ${end.y}`;

  return { path };
};

export function OnboardingConnector({
  sourceSelector,
  targetSelector,
}: OnboardingConnectorProps) {
  const markerId = React.useId().replaceAll(":", "");
  const [geometry, setGeometry] = React.useState<ConnectorGeometry | null>(null);

  React.useLayoutEffect(() => {
    let frameId: number | null = null;
    let source: HTMLElement | null = null;
    let target: HTMLElement | null = null;
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => scheduleUpdate());

    const resolveElements = () => {
      const nextSource = document.querySelector<HTMLElement>(sourceSelector);
      const nextTarget = document.querySelector<HTMLElement>(targetSelector);
      if (nextSource !== source) {
        if (source) resizeObserver?.unobserve(source);
        source = nextSource;
        if (source) resizeObserver?.observe(source);
      }
      if (nextTarget !== target) {
        if (target) resizeObserver?.unobserve(target);
        target = nextTarget;
        if (target) resizeObserver?.observe(target);
      }
    };

    const update = () => {
      frameId = null;
      resolveElements();
      if (!source || !target) {
        setGeometry(null);
        return;
      }
      setGeometry(buildGeometry(source, target));
    };

    function scheduleUpdate() {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(update);
    }

    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-onboarding-profile-id",
        "data-onboarding-category-id",
        "data-onboarding-auth-entry",
      ],
    });
    window.addEventListener("resize", scheduleUpdate);
    window.addEventListener("scroll", scheduleUpdate, true);
    scheduleUpdate();

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate, true);
    };
  }, [sourceSelector, targetSelector]);

  if (!geometry) return null;

  return (
    <svg
      data-onboarding-connector
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[49] h-full w-full overflow-visible text-primary"
    >
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>
      <path
        d={geometry.path}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        markerEnd={`url(#${markerId})`}
        className="drop-shadow-[0_2px_4px_hsl(var(--background))]"
      />
    </svg>
  );
}
