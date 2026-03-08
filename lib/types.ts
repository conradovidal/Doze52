import type { ProfileIconId } from "./profile-icons";

export type CalendarProfile = {
  id: string;
  userId?: string;
  name: string;
  color: string;
  icon: ProfileIconId;
  position: number;
};

export type CategoryItem = {
  id: string;
  userId?: string;
  profileId: string;
  name: string;
  color: string;
  visible: boolean;
};

export type RecurrenceType = "weekly" | "monthly" | "yearly";

export type CalendarEvent = {
  id: string;
  title: string;
  userId?: string;
  categoryId: string;
  color: string;
  startDate: string; // ISO yyyy-MM-dd
  endDate: string; // ISO yyyy-MM-dd
  notes?: string;
  recurrenceType?: RecurrenceType;
  recurrenceUntil?: string; // ISO yyyy-MM-dd
  createdAt: string; // ISO datetime
  dayOrder: number; // manual tie-break order for same-day events (0-based)
};

export type CalendarRenderEvent = CalendarEvent & {
  sourceEventId: string;
  isOccurrence: boolean;
};

export type AnchorPoint = {
  x: number;
  y: number;
};

export type Habit = {
  id: string;
  title: string;
  color: string;
  active: boolean;
};

export type MonthlyReview = {
  id: string;
  month: string; // yyyy-MM
  score: number; // 1-10
  answers: Record<string, string>;
};
