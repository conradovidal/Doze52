"use client";

import { create } from "zustand";
import { addDays, format, parseISO } from "date-fns";
import { persist } from "zustand/middleware";
import type { CalendarEvent, CategoryItem } from "./types";

export type EventInput = {
  title: string;
  categoryId: string;
  startDate: string;
  endDate: string;
  notes?: string;
};

type StoreState = {
  events: CalendarEvent[];
  categories: CategoryItem[];
  replaceAllData: (payload: { categories: CategoryItem[]; events: CalendarEvent[] }) => void;
  resetToOnboardingData: () => void;
  markLocalImported: (userId: string) => void;
  isLocalImported: (userId: string) => boolean;
  ensureEventMetadata: () => void;
  addEvent: (input: EventInput) => void;
  updateEvent: (id: string, input: EventInput) => void;
  moveEventByDelta: (id: string, deltaDays: number) => void;
  reorderEventInDay: (params: { eventId: string; dayIso: string; toIndex: number }) => void;
  normalizeDayOrder: (dayIso: string, eventIdsInDay: string[]) => void;
  deleteEvent: (id: string) => void;
  getEventById: (id: string) => CalendarEvent | undefined;
  createCategory: (input: { name: string; color: string }) => string;
  addCategory: (name: string, color: string) => void;
  updateCategory: (id: string, patch: Partial<Omit<CategoryItem, "id">>) => void;
  deleteCategory: (id: string) => void;
  toggleCategoryVisibility: (id: string) => void;
  setAllCategoriesVisibility: (visible: boolean) => void;
  setCategoriesOrder: (orderedIds: string[]) => void;
  reorderCategories: (sourceId: string, targetId: string) => void;
};

const uid = () => crypto.randomUUID();
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LEGACY_CATEGORY_ID_MAP: Record<string, string> = {
  personal: "33333333-3333-4333-8333-333333333333",
  travel: "22222222-2222-4222-8222-222222222222",
  birthday: "11111111-1111-4111-8111-111111111111",
  work: "33333333-3333-4333-8333-333333333333",
  health: "33333333-3333-4333-8333-333333333333",
  other: "33333333-3333-4333-8333-333333333333",
};

const isUuid = (value: string) => UUID_RE.test(value);

const mapLegacyCategoryId = (rawId: string | undefined | null) => {
  if (!rawId) return null;
  return LEGACY_CATEGORY_ID_MAP[rawId] ?? rawId;
};

export const ONBOARDING_CATEGORY_IDS = {
  birthday: "11111111-1111-4111-8111-111111111111",
  travel: "22222222-2222-4222-8222-222222222222",
  events: "33333333-3333-4333-8333-333333333333",
} as const;

export const ONBOARDING_DEFAULT_CATEGORY_ID = ONBOARDING_CATEGORY_IDS.events;

export const ONBOARDING_DEFAULT_CATEGORIES: CategoryItem[] = [
  {
    id: ONBOARDING_CATEGORY_IDS.birthday,
    name: "Aniversarios",
    color: "#f59e0b",
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.travel,
    name: "Ferias/Viagens",
    color: "#16a34a",
    visible: true,
  },
  {
    id: ONBOARDING_CATEGORY_IDS.events,
    name: "Eventos",
    color: "#2563eb",
    visible: true,
  },
];

export const getOnboardingDefaultCategories = (): CategoryItem[] =>
  ONBOARDING_DEFAULT_CATEGORIES.map((category) => ({ ...category }));

export const isOnboardingCategoriesSnapshot = (categories: CategoryItem[]) => {
  if (categories.length !== ONBOARDING_DEFAULT_CATEGORIES.length) return false;
  return ONBOARDING_DEFAULT_CATEGORIES.every((expected, index) => {
    const received = categories[index];
    if (!received) return false;
    return (
      received.id === expected.id &&
      received.name === expected.name &&
      received.color.toLowerCase() === expected.color.toLowerCase() &&
      received.visible === expected.visible
    );
  });
};

const defaultCategories: CategoryItem[] = getOnboardingDefaultCategories();
const defaultCategoryId = ONBOARDING_DEFAULT_CATEGORY_ID;

const normalizePersistedCategories = (
  persistedCategories: CategoryItem[] | undefined
) => {
  const source =
    persistedCategories && persistedCategories.length > 0
      ? persistedCategories
      : defaultCategories;
  const seen = new Set<string>();
  const next: CategoryItem[] = [];

  for (const category of source) {
    const mapped = mapLegacyCategoryId(category.id);
    const normalizedId =
      mapped && mapped.trim() && isUuid(mapped) ? mapped : uid();
    if (seen.has(normalizedId)) continue;
    seen.add(normalizedId);
    next.push({
      ...category,
      id: normalizedId,
      name: category.name?.trim() || "Categoria",
      color:
        typeof category.color === "string" && category.color.trim().length > 0
          ? category.color
          : "#2563eb",
      visible: typeof category.visible === "boolean" ? category.visible : true,
    });
  }

  return next.length > 0 ? next : getOnboardingDefaultCategories();
};

const normalizeEventDayOrder = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Math.max(0, Math.trunc(Number(value)));
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const candidates = Object.values(value)
      .filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry))
      .map((entry) => Math.trunc(entry))
      .filter((entry) => entry >= 0);
    if (candidates.length > 0) return Math.min(...candidates);
  }
  return 0;
};

const isSingleDayEvent = (evt: Pick<CalendarEvent, "startDate" | "endDate">) =>
  evt.startDate === evt.endDate;

const nextSingleDayOrder = (events: CalendarEvent[], dayIso: string) => {
  const maxValue = events
    .filter((evt) => isSingleDayEvent(evt) && evt.startDate === dayIso)
    .reduce((acc, evt) => Math.max(acc, normalizeEventDayOrder(evt.dayOrder)), -1);
  return maxValue + 1;
};

const nextMultiDayOrder = (events: CalendarEvent[]) => {
  const maxValue = events
    .filter((evt) => !isSingleDayEvent(evt))
    .reduce((acc, evt) => Math.max(acc, normalizeEventDayOrder(evt.dayOrder)), -1);
  return maxValue + 1;
};

type LegacyEvent = Partial<CalendarEvent> & { category?: string };
type PersistedState = {
  categories?: CategoryItem[];
  events?: LegacyEvent[];
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      events: [],
      categories: getOnboardingDefaultCategories(),
      replaceAllData: ({ categories, events }) =>
        set({
          categories,
          events,
        }),
      resetToOnboardingData: () =>
        set({
          categories: getOnboardingDefaultCategories(),
          events: [],
        }),
      markLocalImported: (userId) => {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(`imported:${userId}`, "1");
      },
      isLocalImported: (userId) => {
        if (typeof window === "undefined") return false;
        return window.localStorage.getItem(`imported:${userId}`) === "1";
      },
      ensureEventMetadata: () =>
        set((state) => {
          let changed = false;
          const nextEvents = state.events.map((evt, idx) => {
            const id = evt.id ?? uid();
            const createdAt =
              evt.createdAt ?? new Date(Date.UTC(2024, 0, 1, 0, 0, idx)).toISOString();
            const dayOrder = normalizeEventDayOrder(evt.dayOrder);
            const notes =
              typeof evt.notes === "string" && evt.notes.trim().length > 0
                ? evt.notes.trim()
                : undefined;
            if (
              evt.id === id &&
              evt.createdAt === createdAt &&
              evt.dayOrder === dayOrder &&
              evt.notes === notes
            ) {
              return evt;
            }
            changed = true;
            return { ...evt, id, createdAt, dayOrder, notes };
          });
          return changed ? { events: nextEvents } : state;
        }),
      addEvent: (input) =>
        set((state) => {
          const isSingleDay = input.startDate === input.endDate;
          const dayOrder = isSingleDay
            ? nextSingleDayOrder(state.events, input.startDate)
            : nextMultiDayOrder(state.events);
          return {
            events: [
              ...state.events,
              {
                id: uid(),
                title: input.title.trim(),
                categoryId: input.categoryId,
                color:
                  state.categories.find((c) => c.id === input.categoryId)?.color ??
                  "#2563eb",
                startDate: input.startDate,
                endDate: input.endDate,
                notes: input.notes?.trim() || undefined,
                createdAt: new Date().toISOString(),
                dayOrder,
              },
            ],
          };
        }),
      updateEvent: (id, input) =>
        set((state) => ({
          events: state.events.map((evt) => {
            if (evt.id !== id) return evt;
            const prevIsSingleDay = isSingleDayEvent(evt);
            const nextIsSingleDay = input.startDate === input.endDate;
            const mustRecalculateOrder = prevIsSingleDay !== nextIsSingleDay;
            const nextOrder = mustRecalculateOrder
              ? nextIsSingleDay
                ? nextSingleDayOrder(
                    state.events.filter((entry) => entry.id !== id),
                    input.startDate
                  )
                : nextMultiDayOrder(state.events.filter((entry) => entry.id !== id))
              : normalizeEventDayOrder(evt.dayOrder);
            return {
              ...evt,
              title: input.title.trim(),
              categoryId: input.categoryId,
              color:
                state.categories.find((c) => c.id === input.categoryId)?.color ??
                evt.color,
              startDate: input.startDate,
              endDate: input.endDate,
              notes: input.notes?.trim() || undefined,
              createdAt: evt.createdAt,
              dayOrder: nextOrder,
            };
          }),
        })),
      moveEventByDelta: (id, deltaDays) =>
        set((state) => {
          if (deltaDays === 0) return state;
          return {
            events: state.events.map((evt) => {
              if (evt.id !== id) return evt;
              const movedStart = addDays(parseISO(evt.startDate), deltaDays);
              const movedEnd = addDays(parseISO(evt.endDate), deltaDays);
              return {
                ...evt,
                startDate: format(movedStart, "yyyy-MM-dd"),
                endDate: format(movedEnd, "yyyy-MM-dd"),
              };
            }),
          };
        }),
      reorderEventInDay: ({ eventId, dayIso: _dayIso, toIndex }) =>
        set((state) => {
          void _dayIso;
          return {
            events: state.events.map((evt) =>
              evt.id === eventId
                ? {
                    ...evt,
                    dayOrder: Math.max(0, toIndex),
                  }
                : evt
            ),
          };
        }),
      normalizeDayOrder: (_dayIso, eventIdsInDay) =>
        set((state) => {
          void _dayIso;
          const eventSet = new Set(eventIdsInDay);
          const normalized = new Map<string, number>();
          eventIdsInDay.forEach((id, idx) => normalized.set(id, idx));

          return {
            events: state.events.map((evt) => {
              if (!eventSet.has(evt.id)) return evt;
              return {
                ...evt,
                dayOrder: normalized.get(evt.id) ?? 0,
              };
            }),
          };
        }),
      deleteEvent: (id) =>
        set((state) => ({
          events: state.events.filter((evt) => evt.id !== id),
        })),
      getEventById: (id) => get().events.find((evt) => evt.id === id),
      createCategory: (input) => {
        const name = input.name.trim();
        if (!name) return "";
        const id = uid();
        set((state) => ({
          categories: [
            ...state.categories,
            { id, name, color: input.color, visible: true },
          ],
        }));
        return id;
      },
      addCategory: (name, color) =>
        get().createCategory({ name, color }),
      updateCategory: (id, patch) =>
        set((state) => {
          const nextCategories = state.categories.map((c) =>
            c.id === id ? { ...c, ...patch } : c
          );
          const nextColor = nextCategories.find((c) => c.id === id)?.color;
          return {
            categories: nextCategories,
            events:
              patch.color && nextColor
                ? state.events.map((evt) =>
                    evt.categoryId === id ? { ...evt, color: nextColor } : evt
                  )
                : state.events,
          };
        }),
      deleteCategory: (id) =>
        set((state) => {
          if (state.categories.length <= 1) return state;
          const nextCategories = state.categories.filter((c) => c.id !== id);
          const fallbackId = nextCategories[0]?.id ?? defaultCategoryId;
          const fallbackColor =
            nextCategories.find((c) => c.id === fallbackId)?.color ?? "#2563eb";
          return {
            categories: nextCategories,
            events: state.events.map((evt) =>
              evt.categoryId === id
                ? { ...evt, categoryId: fallbackId, color: fallbackColor }
                : evt
            ),
          };
        }),
      toggleCategoryVisibility: (id) =>
        set((state) => ({
          categories: state.categories.map((c) =>
            c.id === id ? { ...c, visible: !c.visible } : c
          ),
        })),
      setAllCategoriesVisibility: (visible) =>
        set((state) => ({
          categories: state.categories.map((c) =>
            c.visible === visible ? c : { ...c, visible }
          ),
        })),
      setCategoriesOrder: (orderedIds) =>
        set((state) => {
          const byId = new Map(state.categories.map((c) => [c.id, c]));
          const next: CategoryItem[] = [];
          for (const id of orderedIds) {
            const found = byId.get(id);
            if (!found) continue;
            next.push(found);
            byId.delete(id);
          }
          for (const category of state.categories) {
            if (byId.has(category.id)) next.push(category);
          }
          return { categories: next };
        }),
      reorderCategories: (sourceId, targetId) =>
        set((state) => {
          const sourceIndex = state.categories.findIndex((c) => c.id === sourceId);
          const targetIndex = state.categories.findIndex((c) => c.id === targetId);
          if (
            sourceIndex === -1 ||
            targetIndex === -1 ||
            sourceIndex === targetIndex
          ) {
            return state;
          }
          const next = [...state.categories];
          const [moved] = next.splice(sourceIndex, 1);
          next.splice(targetIndex, 0, moved);
          return { categories: next };
        }),
    }),
    {
      name: "yiv-store",
      version: 3,
      migrate: (state: unknown) => {
        const persisted = (state ?? {}) as PersistedState;
        const categories = normalizePersistedCategories(persisted.categories);
        const categoryIds = new Set(categories.map((category) => category.id));
        const fallbackCategoryId = categoryIds.has(defaultCategoryId)
          ? defaultCategoryId
          : (categories[0]?.id ?? defaultCategoryId);
        const fallbackColor =
          categories.find((category) => category.id === fallbackCategoryId)?.color ??
          "#2563eb";
        const events =
          persisted.events?.map((evt, idx) => {
            const createdAt =
              evt.createdAt ??
              new Date(Date.UTC(2024, 0, 1, 0, 0, idx)).toISOString();
            const dayOrder = normalizeEventDayOrder(evt.dayOrder);
            const notes =
              typeof evt.notes === "string" && evt.notes.trim().length > 0
                ? evt.notes.trim()
                : undefined;
            const mappedCategoryId =
              mapLegacyCategoryId(evt.categoryId) ??
              mapLegacyCategoryId(evt.category) ??
              fallbackCategoryId;
            const categoryId = categoryIds.has(mappedCategoryId)
              ? mappedCategoryId
              : fallbackCategoryId;
            const normalizedId =
              typeof evt.id === "string" && evt.id.trim() && isUuid(evt.id)
                ? evt.id
                : uid();
            return {
              ...evt,
              id: normalizedId,
              categoryId,
              createdAt,
              dayOrder,
              notes,
              color:
                categories.find((c: CategoryItem) => c.id === categoryId)?.color ??
                evt.color ??
                fallbackColor,
            };
          }) ?? [];
        return { ...persisted, categories, events };
      },
    }
  )
);
