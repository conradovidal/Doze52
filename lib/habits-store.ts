"use client";

import { isAccountContinuityEnabled } from "./feature-flags";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  applyActiveHabitOrder,
  getHabitCheckInKey,
  orderActiveHabits,
  setHabitArchived,
} from "./habits-prototype";
import {
  createDefaultHabitContext,
  getHabitContexts,
  resolveHabitContextId,
  resolveSelectedHabitContextId,
} from "./habit-contexts";
import type { Habit, HabitCheckIn, HabitContext, HabitContextIconId } from "./types";

type HabitsStoreState = {
  habits: Habit[];
  checkIns: Record<string, HabitCheckIn>;
  /** Vazio = só o contexto "Hábitos" padrão, ainda virtual (ver habit-contexts). */
  contexts: HabitContext[];
  selectedContextId: string | null;
  selectedHabitId: string | null;
  visibleHabitIds: string[];
  /**
   * Desktop: "focus" mostra um hábito com a sequência e marca com um clique
   * (o padrão, igual ao mobile); "overview" mostra todos do contexto.
   */
  desktopHabitView: "focus" | "overview";
  setDesktopHabitView: (view: "focus" | "overview") => void;
  createHabit: (input: { name: string; color: string; contextId?: string }) => string;
  updateHabit: (
    id: string,
    patch: { name: string; color: string; contextId?: string }
  ) => void;
  createContext: (input: { name: string; icon: HabitContextIconId }) => string;
  updateContext: (id: string, patch: { name: string; icon: HabitContextIconId }) => void;
  reorderContexts: (orderedIds: string[]) => void;
  /**
   * Exclui o contexto. Os hábitos dele vão para `moveToContextId` ou, sem
   * destino, são excluídos junto (com os check-ins).
   */
  deleteContext: (id: string, moveToContextId: string | null) => void;
  /** Desfaz uma exclusão de contexto: reinsere contexto, hábitos e check-ins. */
  restoreContext: (context: HabitContext, habits: Habit[], checkIns: HabitCheckIn[]) => void;
  setSelectedContextId: (id: string) => void;
  reorderHabits: (orderedIds: string[]) => void;
  deleteHabit: (id: string) => void;
  archiveHabit: (id: string) => void;
  unarchiveHabit: (id: string) => void;
  /** Desfaz uma exclusão: reinsere o hábito e seus check-ins. */
  restoreHabit: (habit: Habit, checkIns: HabitCheckIn[]) => void;
  toggleHabitCheckIn: (habitId: string, dateIso: string) => void;
  toggleHabitVisibility: (habitId: string) => void;
  setSelectedHabitId: (id: string | null) => void;
};

export const useHabitsStore = create<HabitsStoreState>()(
  persist(
    (set, get) => ({
      habits: [],
      checkIns: {},
      contexts: [],
      selectedContextId: null,
      selectedHabitId: null,
      visibleHabitIds: [],
      desktopHabitView: "focus",

      setDesktopHabitView: (view) => set({ desktopHabitView: view }),

      createHabit: ({ name, color, contextId }) => {
        const timestamp = new Date().toISOString();
        const state = get();
        const orderedContexts = getHabitContexts(state.contexts);
        const targetContextId = resolveHabitContextId(
          {
            contextId:
              contextId ??
              resolveSelectedHabitContextId(state.selectedContextId, orderedContexts),
          },
          orderedContexts
        );
        const activeCount = orderActiveHabits(state.habits).length;
        const habit: Habit = {
          id: crypto.randomUUID(),
          name,
          color,
          icon: "circle-check",
          contextId: targetContextId,
          position: activeCount,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((state) => ({
          habits: [...state.habits, habit],
          selectedHabitId: habit.id,
          visibleHabitIds: [...new Set([...state.visibleHabitIds, habit.id])],
        }));
        return habit.id;
      },

      updateHabit: (id, { name, color, contextId }) => {
        const timestamp = new Date().toISOString();
        set((state) => {
          const habit = state.habits.find((entry) => entry.id === id);
          if (!habit) return state;
          const orderedContexts = getHabitContexts(state.contexts);
          const moving =
            contextId !== undefined &&
            contextId !== resolveHabitContextId(habit, orderedContexts);
          return {
            habits: state.habits.map((entry) =>
              entry.id === id
                ? {
                    ...entry,
                    name,
                    color,
                    ...(moving
                      ? {
                          contextId,
                          // Entra no fim do contexto de destino.
                          position: orderActiveHabits(state.habits).length,
                        }
                      : {}),
                    updatedAt: timestamp,
                  }
                : entry
            ),
          };
        });
      },

      createContext: ({ name, icon }) => {
        const timestamp = new Date().toISOString();
        const context: HabitContext = {
          id: crypto.randomUUID(),
          name,
          icon,
          position: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        set((state) => {
          // O padrão deixa de ser virtual no momento em que ganha um vizinho —
          // senão ele sumiria da lista (e os hábitos dele junto).
          const existing = state.contexts.length
            ? state.contexts
            : [createDefaultHabitContext(timestamp)];
          return {
            contexts: [
              ...existing,
              { ...context, position: getHabitContexts(existing).length },
            ],
            selectedContextId: context.id,
          };
        });
        return context.id;
      },

      updateContext: (id, { name, icon }) => {
        const timestamp = new Date().toISOString();
        set((state) => {
          const existing = getHabitContexts(state.contexts);
          if (!existing.some((context) => context.id === id)) return state;
          return {
            contexts: existing.map((context) =>
              context.id === id
                ? { ...context, name, icon, updatedAt: timestamp }
                : context
            ),
          };
        });
      },

      reorderContexts: (orderedIds) => {
        const timestamp = new Date().toISOString();
        set((state) => ({
          contexts: getHabitContexts(state.contexts).map((context) => {
            const position = orderedIds.indexOf(context.id);
            return position >= 0 && position !== context.position
              ? { ...context, position, updatedAt: timestamp }
              : context;
          }),
        }));
      },

      deleteContext: (id, moveToContextId) => {
        const timestamp = new Date().toISOString();
        set((state) => {
          const orderedContexts = getHabitContexts(state.contexts);
          if (orderedContexts.length <= 1) return state;
          if (!orderedContexts.some((context) => context.id === id)) return state;
          const remaining = orderedContexts.filter((context) => context.id !== id);
          const target =
            moveToContextId && remaining.some((context) => context.id === moveToContextId)
              ? moveToContextId
              : null;
          const affectedIds = new Set(
            state.habits
              .filter((habit) => resolveHabitContextId(habit, orderedContexts) === id)
              .map((habit) => habit.id)
          );
          const nextHabits = target
            ? state.habits.map((habit, index) =>
                affectedIds.has(habit.id)
                  ? {
                      ...habit,
                      contextId: target,
                      position: state.habits.length + index,
                      updatedAt: timestamp,
                    }
                  : habit
              )
            : state.habits.filter((habit) => !affectedIds.has(habit.id));
          const nextSelectedContextId =
            state.selectedContextId === id || !state.selectedContextId
              ? (target ?? remaining[0].id)
              : state.selectedContextId;
          const nextActive = orderActiveHabits(nextHabits);
          return {
            contexts: remaining,
            habits: nextHabits,
            checkIns: target
              ? state.checkIns
              : Object.fromEntries(
                  Object.entries(state.checkIns).filter(
                    ([, checkIn]) => !affectedIds.has(checkIn.habitId)
                  )
                ),
            selectedContextId: nextSelectedContextId,
            selectedHabitId:
              state.selectedHabitId && nextActive.some((habit) => habit.id === state.selectedHabitId)
                ? state.selectedHabitId
                : (nextActive[0]?.id ?? null),
            visibleHabitIds: target
              ? state.visibleHabitIds
              : state.visibleHabitIds.filter((habitId) => !affectedIds.has(habitId)),
          };
        });
      },

      restoreContext: (context, habits, checkIns) => {
        set((state) => {
          const existingContexts = getHabitContexts(state.contexts);
          const contexts = existingContexts.some((entry) => entry.id === context.id)
            ? existingContexts
            : [...existingContexts, context];
          const restoredIds = new Set(habits.map((habit) => habit.id));
          return {
            contexts,
            habits: [
              ...state.habits.filter((habit) => !restoredIds.has(habit.id)),
              ...habits,
            ],
            checkIns: {
              ...state.checkIns,
              ...Object.fromEntries(
                checkIns.map((checkIn) => [
                  getHabitCheckInKey(checkIn.habitId, checkIn.date),
                  checkIn,
                ])
              ),
            },
            selectedContextId: context.id,
            visibleHabitIds: [
              ...new Set([
                ...state.visibleHabitIds,
                ...habits.filter((habit) => !habit.archivedAt).map((habit) => habit.id),
              ]),
            ],
          };
        });
      },

      setSelectedContextId: (id) => set({ selectedContextId: id }),

      reorderHabits: (orderedIds) => {
        const timestamp = new Date().toISOString();
        set((state) => ({
          habits: applyActiveHabitOrder(state.habits, orderedIds, timestamp),
        }));
      },

      deleteHabit: (id) => {
        set((state) => {
          const nextActive = orderActiveHabits(state.habits).filter(
            (habit) => habit.id !== id
          );
          const nextCheckIns = Object.fromEntries(
            Object.entries(state.checkIns).filter(([, checkIn]) => checkIn.habitId !== id)
          );
          return {
            habits: state.habits.filter((habit) => habit.id !== id),
            checkIns: nextCheckIns,
            selectedHabitId:
              state.selectedHabitId === id
                ? (nextActive[0]?.id ?? null)
                : state.selectedHabitId,
            visibleHabitIds: state.visibleHabitIds.filter((habitId) => habitId !== id),
          };
        });
      },

      archiveHabit: (id) => {
        const timestamp = new Date().toISOString();
        set((state) => {
          const nextActive = orderActiveHabits(state.habits).filter(
            (habit) => habit.id !== id
          );
          return {
            habits: setHabitArchived(state.habits, id, timestamp, timestamp),
            selectedHabitId:
              state.selectedHabitId === id
                ? (nextActive[0]?.id ?? null)
                : state.selectedHabitId,
            visibleHabitIds: state.visibleHabitIds.filter((habitId) => habitId !== id),
          };
        });
      },

      unarchiveHabit: (id) => {
        const timestamp = new Date().toISOString();
        set((state) => {
          const position = orderActiveHabits(state.habits).length;
          return {
            habits: setHabitArchived(state.habits, id, undefined, timestamp, position),
            selectedHabitId: state.selectedHabitId ?? id,
            visibleHabitIds: [...new Set([...state.visibleHabitIds, id])],
          };
        });
      },

      restoreHabit: (habit, checkIns) => {
        set((state) => {
          if (state.habits.some((candidate) => candidate.id === habit.id)) return state;
          return {
            habits: [...state.habits, habit],
            checkIns: {
              ...state.checkIns,
              ...Object.fromEntries(
                checkIns.map((checkIn) => [
                  getHabitCheckInKey(checkIn.habitId, checkIn.date),
                  checkIn,
                ])
              ),
            },
            selectedHabitId: state.selectedHabitId ?? habit.id,
            visibleHabitIds: habit.archivedAt
              ? state.visibleHabitIds
              : [...new Set([...state.visibleHabitIds, habit.id])],
          };
        });
      },

      toggleHabitCheckIn: (habitId, dateIso) => {
        const key = getHabitCheckInKey(habitId, dateIso);
        set((state) => {
          const completed = !state.checkIns[key]?.completed;
          return {
            checkIns: {
              ...state.checkIns,
              [key]: {
                habitId,
                date: dateIso,
                completed,
                updatedAt: new Date().toISOString(),
              },
            },
          };
        });
      },

      toggleHabitVisibility: (habitId) => {
        set((state) => ({
          visibleHabitIds: state.visibleHabitIds.includes(habitId)
            ? state.visibleHabitIds.filter((id) => id !== habitId)
            : [...state.visibleHabitIds, habitId],
        }));
      },

      setSelectedHabitId: (id) => set({ selectedHabitId: id }),
    }),
    {
      name: isAccountContinuityEnabled ? "doze52:habits-view:v2" : "doze52:habits-store:v1",
      partialize: (state) => ({
        habits: state.habits,
        checkIns: state.checkIns,
        contexts: state.contexts,
        selectedContextId: state.selectedContextId,
        desktopHabitView: state.desktopHabitView,
        selectedHabitId: state.selectedHabitId,
        visibleHabitIds: state.visibleHabitIds,
      }),
    }
  )
);
