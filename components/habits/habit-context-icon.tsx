"use client";

import { CircleCheck } from "lucide-react";
import { ProfileIcon } from "@/components/profile-icon";
import type { HabitContextIconId } from "@/lib/types";

export function HabitContextIcon({
  icon,
  size = 14,
  className,
}: {
  icon: HabitContextIconId;
  size?: number;
  className?: string;
}) {
  if (icon === "circle-check") {
    return <CircleCheck size={size} className={className} aria-hidden="true" />;
  }
  return <ProfileIcon icon={icon} size={size} className={className} />;
}
