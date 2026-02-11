import type { CalendarEvent, CategoryItem } from "@/lib/types";

export type CalendarSnapshot = {
  categories: CategoryItem[];
  events: CalendarEvent[];
};

export const importedFlagKey = (userId: string) => `imported:${userId}`;

export const isLocalImported = (userId: string) => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(importedFlagKey(userId)) === "1";
};

export const markLocalImported = (userId: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(importedFlagKey(userId), "1");
};
