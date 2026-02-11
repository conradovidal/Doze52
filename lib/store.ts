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
};

type StoreState = {
  events: CalendarEvent[];
  categories: CategoryItem[];
  replaceAllData: (payload: { categories: CategoryItem[]; events: CalendarEvent[] }) => void;
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
const defaultCategories: CategoryItem[] = [
  { id: "personal", name: "Pessoal", color: "#2563eb", visible: true },
  { id: "travel", name: "Viagens", color: "#16a34a", visible: true },
  { id: "birthday", name: "Aniversarios", color: "#f59e0b", visible: true },
];
const defaultCategoryId = "personal";

type LegacyEvent = Partial<CalendarEvent> & { category?: string };
type PersistedState = {
  categories?: CategoryItem[];
  events?: LegacyEvent[];
};

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      events: [],
      categories: defaultCategories,
      replaceAllData: ({ categories, events }) =>
        set({
          categories,
          events,
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
            const createdAt =
              evt.createdAt ?? new Date(Date.UTC(2024, 0, 1, 0, 0, idx)).toISOString();
            const dayOrder = evt.dayOrder ?? {};
            if (evt.createdAt === createdAt && evt.dayOrder === dayOrder) return evt;
            changed = true;
            return { ...evt, createdAt, dayOrder };
          });
          return changed ? { events: nextEvents } : state;
        }),
      addEvent: (input) =>
        set((state) => ({
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
              createdAt: new Date().toISOString(),
              dayOrder: {},
            },
          ],
        })),
      updateEvent: (id, input) =>
        set((state) => ({
          events: state.events.map((evt) =>
            evt.id === id
              ? {
                  ...evt,
                  title: input.title.trim(),
                  categoryId: input.categoryId,
                  color:
                    state.categories.find((c) => c.id === input.categoryId)?.color ??
                    evt.color,
                  startDate: input.startDate,
                  endDate: input.endDate,
                  createdAt: evt.createdAt,
                  dayOrder: evt.dayOrder ?? {},
                }
              : evt
          ),
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
      reorderEventInDay: ({ eventId, dayIso, toIndex }) =>
        set((state) => ({
          events: state.events.map((evt) =>
            evt.id === eventId
              ? {
                  ...evt,
                  dayOrder: {
                    ...(evt.dayOrder ?? {}),
                    [dayIso]: Math.max(0, toIndex),
                  },
                }
              : evt
          ),
        })),
      normalizeDayOrder: (dayIso, eventIdsInDay) =>
        set((state) => {
          const eventSet = new Set(eventIdsInDay);
          const byId = new Map(state.events.map((evt) => [evt.id, evt]));
          const ordered = [...eventIdsInDay]
            .map((id) => byId.get(id))
            .filter(Boolean)
            .sort((a, b) => {
              const aOrder = a!.dayOrder?.[dayIso];
              const bOrder = b!.dayOrder?.[dayIso];
              if (aOrder !== undefined && bOrder !== undefined) return aOrder - bOrder;
              if (aOrder !== undefined) return -1;
              if (bOrder !== undefined) return 1;
              return a!.createdAt.localeCompare(b!.createdAt);
            });

          const normalized = new Map<string, number>();
          ordered.forEach((evt, idx) => normalized.set(evt!.id, idx));

          return {
            events: state.events.map((evt) => {
              if (!eventSet.has(evt.id)) return evt;
              return {
                ...evt,
                dayOrder: {
                  ...(evt.dayOrder ?? {}),
                  [dayIso]: normalized.get(evt.id) ?? 0,
                },
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
      version: 1,
      migrate: (state: unknown) => {
        const persisted = (state ?? {}) as PersistedState;
        const categories = persisted.categories ?? defaultCategories;
        const events =
          persisted.events?.map((evt, idx) => {
            const createdAt =
              evt.createdAt ??
              new Date(Date.UTC(2024, 0, 1, 0, 0, idx)).toISOString();
            const dayOrder = evt.dayOrder ?? {};

            if (evt.categoryId) {
              return {
                ...evt,
                createdAt,
                dayOrder,
              };
            }
            const legacy = evt.category;
            const mappedId =
              legacy === "personal"
                ? "personal"
                : legacy === "work"
                  ? "personal"
                  : legacy === "health"
                    ? "personal"
                    : legacy === "other"
                      ? "personal"
                      : defaultCategoryId;
            return {
              ...evt,
              categoryId: mappedId,
              createdAt,
              dayOrder,
              color:
                categories.find((c: CategoryItem) => c.id === mappedId)?.color ??
                evt.color ??
                "#2563eb",
            };
          }) ?? [];
        return { ...persisted, categories, events };
      },
    }
  )
);
