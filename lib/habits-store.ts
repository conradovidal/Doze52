"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  applyActiveHabitOrder,
  getHabitCheckInKey,
  orderActiveHabits,
} from "./habits-prototype";
import type { Habit, HabitCheckIn } from "./types";

type HabitsStoreState = {
  habits: Habit[];
  checkIns: Record<string, HabitCheckIn>;
  selectedHabitId: string | null;
  visibleHabitIds: string[];
  createHabit: (input: { name: string; color: string }) => string;
  updateHabit: (id: string, patch: { name: string; color: string }) => void;
  reorderHabits: (orderedIds: string[]) => void;
  deleteHabit: (id: string) => void;
  toggleHabitCheckIn: (habitId: string, dateIso: string) => void;
  toggleHabitVisibility: (habitId: string) => void;
  setSelectedHabitId: (id: string | null) => void;
};

export const useHabitsStore = create<HabitsStoreState>()(
  persist(
    (set, get) => ({
      habits: [],
      checkIns: {},
      selectedHabitId: null,
      visibleHabitIds: [],

      createHabit: ({ name, color }) => {
        const timestamp = new Date().toISOString();
        const activeCount = orderActiveHabits(get().habits).length;
        const habit: Habit = {
          id: crypto.randomUUID(),
          name,
          color,
          icon: "circle-check",
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

      updateHabit: (id, { name, color }) => {
        const timestamp = new Date().toISOString();
        set((state) => ({
          habits: state.habits.map((habit) =>
            habit.id === id ? { ...habit, name, color, updatedAt: timestamp } : habit
          ),
        }));
      },

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
      name: "doze52:habits-store:v1",
      partialize: (state) => ({
        habits: state.habits,
        checkIns: state.checkIns,
        selectedHabitId: state.selectedHabitId,
        visibleHabitIds: state.visibleHabitIds,
      }),
    }
  )
);
