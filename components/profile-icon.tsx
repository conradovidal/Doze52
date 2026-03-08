"use client";

import type { LucideIcon } from "lucide-react";
import {
  Baby,
  BookOpen,
  Briefcase,
  Dumbbell,
  Folder,
  GraduationCap,
  Heart,
  Home,
  Plane,
  Stethoscope,
  User,
  Users,
} from "lucide-react";
import type { ProfileIconId } from "@/lib/profile-icons";

const ICON_BY_ID: Record<ProfileIconId, LucideIcon> = {
  briefcase: Briefcase,
  user: User,
  users: Users,
  home: Home,
  heart: Heart,
  "book-open": BookOpen,
  "graduation-cap": GraduationCap,
  plane: Plane,
  stethoscope: Stethoscope,
  baby: Baby,
  dumbbell: Dumbbell,
  folder: Folder,
};

export function ProfileIcon({
  icon,
  size = 14,
  className,
}: {
  icon: ProfileIconId;
  size?: number;
  className?: string;
}) {
  const Icon = ICON_BY_ID[icon] ?? Folder;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
