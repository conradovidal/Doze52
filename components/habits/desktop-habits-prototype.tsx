"use client";

import { YearGrid } from "@/components/calendar/year-grid";
import { HabitControls } from "@/components/habits/habit-controls";
import type { Habit, HabitCheckIn } from "@/lib/types";

const noop = () => undefined;

export function DesktopHabitsPrototype({
  year,
  todayIso,
  habits,
  totalActiveHabits,
  checkIns,
  selectedHabit,
  creationDisabled,
  creationDisabledLabel,
  onSelectHabit,
  onToggleDay,
  onRequestCreate,
  isEditing,
  archivedHabits,
  onEditHabit,
  onMoveHabit,
  onReactivateHabit,
}: {
  year: number;
  todayIso: string;
  habits: Habit[];
  totalActiveHabits: number;
  checkIns: Record<string, HabitCheckIn>;
  selectedHabit: Habit | null;
  creationDisabled: boolean;
  creationDisabledLabel: string | null;
  onSelectHabit: (habitId: string) => void;
  onToggleDay: (dateIso: string) => void;
  onRequestCreate: () => void;
  isEditing: boolean;
  archivedHabits: Habit[];
  onEditHabit: (habitId: string) => void;
  onMoveHabit: (habitId: string, direction: -1 | 1) => void;
  onReactivateHabit: (habitId: string) => void;
}) {
  return (
    <section
      data-habits-prototype
      data-habits-layout="desktop-year"
      className="flex min-h-0 flex-1 flex-col"
    >
      <HabitControls
        habits={habits}
        totalActiveHabits={totalActiveHabits}
        selectedHabit={selectedHabit}
        creationDisabled={creationDisabled}
        creationDisabledLabel={creationDisabledLabel}
        onSelectHabit={onSelectHabit}
        onRequestCreate={onRequestCreate}
        isEditing={isEditing}
        archivedHabits={archivedHabits}
        onEditHabit={onEditHabit}
        onMoveHabit={onMoveHabit}
        onReactivateHabit={onReactivateHabit}
      />

      <div
        data-desktop-habits-scroll-region
        className="min-h-0 flex-1 overflow-auto pb-1 [scrollbar-gutter:stable_both-edges]"
      >
        <YearGrid
          year={year}
          todayIso={todayIso}
          events={[]}
          onEditEvent={noop}
          creatingRange={null}
          onStartCreateRange={noop}
          onHoverCreateRange={noop}
          onFinishCreateRange={noop}
          onMoveEventByDelta={noop}
          onApplyDayReorder={noop}
          habitPresentation={{
            habits,
            checkIns,
            selectedHabit,
            onToggle: onToggleDay,
            onCreateRequest: onRequestCreate,
            isEditing,
          }}
        />
      </div>
    </section>
  );
}
