import type { Transition } from "motion/react";

export const MOTION_DURATION = {
  micro: 0.16,
  transition: 0.22,
} as const;

export const MOTION_EASE = [0.22, 1, 0.36, 1] as const;

export const MOTION_SPRING: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.7,
};
