"use client";

import * as React from "react";
import { YearGrid } from "@/components/calendar/year-grid";
import { CollapsibleControlRegion } from "@/components/ui/collapsible-control-region";
import { HabitControls } from "@/components/habits/habit-controls";
import { GuidedToolbarNoticeCard } from "@/components/onboarding/guided-toolbar-notice";
import {
  DESKTOP_CONTROL_DIVIDER_CLASS,
  DESKTOP_CONTROL_DIVIDER_COLLAPSED_CLASS,
  DESKTOP_CONTROL_FIXED_HEIGHT_CLASS,
  DESKTOP_CONTROL_GRID_GAP_CLASS,
} from "@/lib/desktop-control-layout";
import type { Habit, HabitCheckIn } from "@/lib/types";
import type { GuidedToolbarNotice } from "@/components/onboarding/guided-toolbar-notice";

const noop = () => undefined;

export function DesktopHabitsPrototype({
  year,
  todayIso,
  habits,
  visibleHabits,
  allHabits,
  checkIns,
  selectedHabit,
  visibleHabitIds,
  creationDisabled,
  onSelectHabit,
  onToggleDay,
  onOpenDayPicker,
  onRequestCreate,
  isEditing,
  headerMinimized = false,
  readOnly = false,
  onEditHabit,
  onReorderHabits,
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
  checkIns: Record<string, HabitCheckIn>;
  selectedHabit: Habit | null;
  visibleHabitIds: ReadonlySet<string>;
  creationDisabled: boolean;
  onSelectHabit: (habitId: string) => void;
  onToggleDay: (dateIso: string) => void;
  onOpenDayPicker: (dateIso: string, anchor: HTMLElement) => void;
  onRequestCreate: () => void;
  isEditing: boolean;
  headerMinimized?: boolean;
  readOnly?: boolean;
  onEditHabit: (habitId: string) => void;
  onReorderHabits: (orderedIds: string[]) => void;
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
      {/* Mesmo mecanismo do Anual, incluindo o wrapper externo
          (data-onboarding-filter-region lá, aqui replicado classe a classe):
          relative isolate + mx-auto + max-w-none + gap-2 estabelecem o mesmo
          contexto de empilhamento/contenção que o Anual usa ao redor do seu
          CollapsibleControlRegion — não é só o componente igual, é a mesma
          moldura ao redor dele. A borda vive no contentClassName (não fixa
          no HabitControls), então ganha o mesmo fade de padding/border-color
          ao recolher em vez de só ser cortada pelo grid-template-rows. O
          mt-2/mb-2 ficam aqui, fora da região que anima (nunca são cortados
          ao recolher) — reproduzem os dois espaços fixos que o <header> do
          Anual já tem prontos (gap acima da faixa de categorias + margem
          abaixo dela), independente de estar expandida ou não. Era só mb-2
          antes, o que não cria espaço nenhum acima (margin-bottom não afeta
          o que vem antes do elemento). */}
      <div
        className={`relative isolate mx-auto mt-2 flex w-full max-w-none flex-col items-center gap-2 ${DESKTOP_CONTROL_GRID_GAP_CLASS}`}
      >
      <CollapsibleControlRegion
        id="habits-header-region"
        expanded={!headerMinimized}
        fixedHeightClassName={DESKTOP_CONTROL_FIXED_HEIGHT_CLASS}
        contentClassName={
          !headerMinimized
            ? DESKTOP_CONTROL_DIVIDER_CLASS
            : DESKTOP_CONTROL_DIVIDER_COLLAPSED_CLASS
        }
      >
        <HabitControls
          habits={habits}
          selectedHabit={selectedHabit}
          visibleHabitIds={visibleHabitIds}
          creationDisabled={creationDisabled}
          onSelectHabit={onSelectHabit}
          onToggleHabitVisibility={onSelectHabit}
          onRequestCreate={onRequestCreate}
          isEditing={isEditing}
          onEditHabit={onEditHabit}
          onReorderHabits={onReorderHabits}
          guidedNotice={controlsNotice}
          onDismissGuidedNotice={onDismissGuidedNotice}
          onGuidedNoticeAction={onGuidedNoticeAction}
        />
      </CollapsibleControlRegion>
      </div>

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
          // Perto de "hoje", não do meio das duas semanas de retrospectiva —
          // é o dia que ela reconhece de cara, o resto do intervalo é só
          // contexto.
          anchorSelector={`[data-day-iso="${todayIso}"]`}
          anchorPlacement="above-center"
        />
      ) : null}
    </section>
  );
}
