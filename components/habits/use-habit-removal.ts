"use client";

import * as React from "react";
import { useFeedback } from "@/components/ui/feedback-provider";
import { useHabitsStore } from "@/lib/habits-store";

/** Arquivar e excluir hábito, sempre com aviso e "Desfazer". */
export function useHabitRemoval() {
  const { notify } = useFeedback();

  const archive = React.useCallback(
    (habitId: string) => {
      const store = useHabitsStore.getState();
      const habit = store.habits.find((entry) => entry.id === habitId);
      if (!habit) return;
      store.archiveHabit(habitId);
      notify({
        tone: "success",
        title: `Hábito "${habit.name}" arquivado`,
        description: "O histórico fica guardado em Organizar › Arquivados.",
        durationMs: 7000,
        action: {
          label: "Desfazer",
          onClick: () => useHabitsStore.getState().unarchiveHabit(habitId),
        },
      });
    },
    [notify]
  );

  const remove = React.useCallback(
    (habitId: string) => {
      const store = useHabitsStore.getState();
      const habit = store.habits.find((entry) => entry.id === habitId);
      if (!habit) return;
      const removedCheckIns = Object.values(store.checkIns).filter(
        (checkIn) => checkIn.habitId === habitId
      );
      const completed = removedCheckIns.filter((checkIn) => checkIn.completed).length;
      store.deleteHabit(habitId);
      notify({
        tone: "success",
        title: `Hábito "${habit.name}" excluído`,
        description:
          completed > 0
            ? `${completed} ${completed === 1 ? "check-in removido" : "check-ins removidos"}.`
            : undefined,
        durationMs: 7000,
        action: {
          label: "Desfazer",
          onClick: () => useHabitsStore.getState().restoreHabit(habit, removedCheckIns),
        },
      });
    },
    [notify]
  );

  return { archive, remove };
}

export const useHabitCheckInCount = (habitId: string | null) =>
  useHabitsStore((s) =>
    habitId
      ? Object.values(s.checkIns).filter(
          (checkIn) => checkIn.habitId === habitId && checkIn.completed
        ).length
      : 0
  );
