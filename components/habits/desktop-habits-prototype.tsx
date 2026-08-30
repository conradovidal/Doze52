"use client";

import * as React from "react";
import { YearGrid } from "@/components/calendar/year-grid";
import { HabitControls } from "@/components/habits/habit-controls";
import { GuidedToolbarNoticeCard } from "@/components/onboarding/guided-toolbar-notice";
import type { Habit, HabitCheckIn } from "@/lib/types";
import type { GuidedToolbarNotice } from "@/components/onboarding/guided-toolbar-notice";

const noop = () => undefined;

export function DesktopHabitsPrototype({
  year,
  todayIso,
  habits,
  visibleHabits,
  allHabits,
  totalActiveHabits,
  checkIns,
  selectedHabit,
  visibleHabitIds,
  creationDisabled,
  creationDisabledLabel,
  onSelectHabit,
  onToggleDay,
  onOpenDayPicker,
  onRequestCreate,
  isEditing,
  readOnly = false,
  onEditHabit,
  onReorderHabits,
  onToggleEditing,
  onYearChange,
  guidedNotice,
  retrospectiveDates,
  retrospectiveHighlighted = false,
  onDismissGuidedNotice,
  onGuidedNoticeAction,
}: {
  year: number;
  todayIso: string;
  habits: Habit[];
  visibleHabits: Habit[];
  allHabits: Habit[];
  totalActiveHabits: number;
  checkIns: Record<string, HabitCheckIn>;
  selectedHabit: Habit | null;
  visibleHabitIds: ReadonlySet<string>;
  creationDisabled: boolean;
  creationDisabledLabel: string | null;
  onSelectHabit: (habitId: string) => void;
  onToggleDay: (dateIso: string) => void;
  onOpenDayPicker: (dateIso: string, anchor: HTMLElement) => void;
  onRequestCreate: () => void;
  isEditing: boolean;
  readOnly?: boolean;
  onEditHabit: (habitId: string) => void;
  onReorderHabits: (orderedIds: string[]) => void;
  onToggleEditing?: () => void;
  onYearChange: (year: number) => void;
  guidedNotice?: GuidedToolbarNotice | null;
  retrospectiveDates?: ReadonlySet<string>;
  retrospectiveHighlighted?: boolean;
  onDismissGuidedNotice?: () => void;
  onGuidedNoticeAction?: () => void;
}) {
  const scrollRegionRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    if (!retrospectiveDates?.size) return;
    const region = scrollRegionRef.current;
    const target = Array.from(
      region?.querySelectorAll<HTMLElement>(
        '[data-onboarding-retrospective-date="true"]'
      ) ?? []
    ).at(-1);
    target?.scrollIntoView({ block: "center", inline: "center" });
  }, [retrospectiveDates]);

  const controlsNotice =
    guidedNotice?.target === "habit-created" ? null : guidedNotice;
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
        visibleHabitIds={visibleHabitIds}
        creationDisabled={creationDisabled}
        creationDisabledLabel={creationDisabledLabel}
        onSelectHabit={onSelectHabit}
        onToggleHabitVisibility={onSelectHabit}
        onRequestCreate={onRequestCreate}
        isEditing={isEditing}
        readOnly={readOnly}
        onEditHabit={onEditHabit}
        onReorderHabits={onReorderHabits}
        onToggleEditing={onToggleEditing}
        guidedNotice={controlsNotice}
        onDismissGuidedNotice={onDismissGuidedNotice}
        onGuidedNoticeAction={onGuidedNoticeAction}
      />

      <div
        className="min-h-0 flex-1 overflow-hidden pb-1"
      >
        <YearGrid
          year={year}
          onYearChange={onYearChange}
          todayIso={todayIso}
          events={[]}
          onEditEvent={noop}
          creatingRange={null}
          onStartCreateRange={noop}
          onHoverCreateRange={noop}
          onFinishCreateRange={noop}
          onMoveEventByDelta={noop}
          onApplyDayReorder={noop}
          showScaleControl={false}
          scrollViewportRef={scrollRegionRef}
          scrollRegion="habits"
          habitPresentation={{
            habits: visibleHabits,
            allHabits,
            checkIns,
            selectedHabit,
            onToggle: onToggleDay,
            onOpenPicker: onOpenDayPicker,
            onCreateRequest: onRequestCreate,
            isEditing,
            readOnly,
            retrospectiveDates,
            retrospectiveHighlighted,
          }}
        />
      </div>
      {guidedNotice?.target === "habit-created" && onDismissGuidedNotice ? (
        <GuidedToolbarNoticeCard
          notice={guidedNotice}
          onClose={onDismissGuidedNotice}
          onAction={onGuidedNoticeAction}
          placement="viewport"
          portaled
          anchorSelector='[data-onboarding-retrospective-date="true"]'
          anchorMultiple
          anchorPlacement="above-center"
        />
      ) : null}
    </section>
  );
}
