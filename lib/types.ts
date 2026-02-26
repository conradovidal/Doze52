export type CategoryItem = {
  id: string;
  userId?: string;
  name: string;
  color: string;
  visible: boolean;
};

export type CalendarEvent = {
  id: string;
  title: string;
  userId?: string;
  categoryId: string;
  color: string;
  startDate: string; // ISO yyyy-MM-dd
  endDate: string; // ISO yyyy-MM-dd
  notes?: string;
  createdAt: string; // ISO datetime
  dayOrder: number; // manual tie-break order for same-day events (0-based)
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
