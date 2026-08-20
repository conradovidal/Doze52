"use client";

import { LazyMotion, MotionConfig } from "motion/react";

const loadMotionFeatures = () =>
  import("@/lib/motion-features").then((module) => module.default);

export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion strict features={loadMotionFeatures}>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
