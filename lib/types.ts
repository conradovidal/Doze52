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
  /** Quando arquivada, a categoria sai dos seletores e filtros; guarda os eventos. */
  archivedAt?: string;
  /** Arquivada: 'show' mantém os eventos no calendário, 'hide' os esconde. */
  archiveDisplay?: "show" | "hide";
  calendarPackGroupId?: string;
  calendarPackVariantId?: string;
  calendarPackCategoryKey?: string;
  calendarPackVersion?: number;
};

export type RecurrenceType = "weekly" | "biweekly" | "monthly" | "yearly";

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
  calendarPackGroupId?: string;
  calendarPackEventKey?: string;
};

export type CalendarRenderEvent = CalendarEvent & {
  sourceEventId: string;
  isOccurrence: boolean;
};

export type AnchorPoint = {
  x: number;
  y: number;
};

/** Ícone de um contexto de hábitos: o "Hábitos" padrão ou um dos contextos de Eventos. */
export type HabitContextIconId = "circle-check" | ProfileIconId;

/**
 * Agrupa hábitos na tela de Hábitos, como o contexto agrupa categorias nos
 * Eventos. Separado dos contextos de Eventos de propósito: "Pessoal" e
 * "Profissional" organizam datas, não rotinas.
 */
export type HabitContext = {
  id: string;
  name: string;
  icon: HabitContextIconId;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type Habit = {
  id: string;
  userId?: string;
  name: string;
  color: string;
  icon: "circle-check";
  /** Sem valor (hábitos anteriores aos contextos) = contexto padrão. */
  contextId?: string;
  position: number;
  archivedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type HabitCheckIn = {
  habitId: string;
  date: string; // ISO yyyy-MM-dd
  completed: boolean;
  updatedAt: string;
};

export type MonthlyReview = {
  id: string;
  month: string; // yyyy-MM
  score: number; // 1-10
  answers: Record<string, string>;
};
