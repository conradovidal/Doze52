"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Plus,
} from "lucide-react";

import { CollapsibleControlRegion } from "@/components/ui/collapsible-control-region";
import {
  GuidedToolbarNoticeCard,
  type GuidedToolbarNotice,
} from "@/components/onboarding/guided-toolbar-notice";
import { GuidedTargetOutline } from "@/components/onboarding/guided-target-outline";
import { HabitEditList } from "@/components/habits/habit-edit-list";
import { getCategoryColorToken } from "@/lib/category-palette";
import { useTheme } from "@/lib/theme";
import type { Habit } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DESKTOP_CONTROL_DIVIDER_CLASS,
  DESKTOP_CONTROL_GRID_GAP_CLASS,
  DESKTOP_CONTROL_MAX_WIDTH_CLASS,
  DESKTOP_CONTROL_REGION_TOP_GAP_CLASS,
  DESKTOP_CONTROL_ROW_GAP_CLASS,
} from "@/lib/desktop-control-layout";

const HABIT_CONTROLS_EXPANDED_STORAGE_KEY = "doze52:habit-controls:expanded";

type HabitControlsProps = {
  habits: Habit[];
  selectedHabit: Habit | null;
  visibleHabitIds?: ReadonlySet<string>;
  isEditing?: boolean;
  mobile?: boolean;
  creationDisabled: boolean;
  onSelectHabit: (habitId: string) => void;
  onToggleHabitVisibility?: (habitId: string) => void;
  onRequestCreate: () => void;
  onEditHabit?: (habitId: string) => void;
  onReorderHabits?: (orderedIds: string[]) => void;
  guidedNotice?: GuidedToolbarNotice | null;
  onDismissGuidedNotice?: () => void;
  onGuidedNoticeAction?: () => void;
};

export function HabitControls({
  habits,
  selectedHabit,
  visibleHabitIds,
  isEditing = false,
  mobile = false,
  creationDisabled,
  onSelectHabit,
  onToggleHabitVisibility,
  onRequestCreate,
  onEditHabit,
  onReorderHabits,
  guidedNotice = null,
  onDismissGuidedNotice,
  onGuidedNoticeAction,
}: HabitControlsProps) {
  const { mode: themeMode } = useTheme();
  const [expanded, setExpanded] = React.useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const stored = window.localStorage.getItem(HABIT_CONTROLS_EXPANDED_STORAGE_KEY);
      return stored === null ? true : stored === "true";
    } catch {
      return true;
    }
  });
  const setExpandedPersisted = React.useCallback(
    (updater: boolean | ((current: boolean) => boolean)) => {
      setExpanded((current) => {
        const next = typeof updater === "function" ? updater(current) : updater;
        try {
          window.localStorage.setItem(
            HABIT_CONTROLS_EXPANDED_STORAGE_KEY,
            String(next)
          );
        } catch {
          // Sem persistência entre navegações se o storage falhar; sem impacto na sessão atual.
        }
        return next;
      });
    },
    []
  );
  const controlsId = React.useId();

  const habitButtons = (
    <div
      className={cn(
        mobile
          ? "grid w-full grid-cols-2 gap-1.5 min-[430px]:grid-cols-3"
          : "flex min-h-8 w-max shrink-0 flex-nowrap items-center gap-1.5 sm:gap-2"
      )}
    >
      {habits.map((habit) => {
        const selected = mobile
          ? selectedHabit?.id === habit.id
          : visibleHabitIds?.has(habit.id) ?? true;
        const colorToken = getCategoryColorToken(habit.color, themeMode);

        return (
          <button
            key={habit.id}
            type="button"
            aria-pressed={selected}
            data-habit-filter={habit.id}
            title={habit.name}
            className={cn(
              "inline-flex items-center overflow-hidden border text-[0.78rem] font-semibold shadow-none transition-[background-color,border-color,color,transform] duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
              mobile
                ? "h-10 w-full justify-start rounded-[8px] pr-2 text-left"
                : "h-8 shrink-0 rounded-[10px]",
              selected
                ? "hover:brightness-[0.985]"
                : "border-border bg-card text-muted-foreground/75 hover:border-foreground/18 hover:bg-muted hover:text-foreground"
            )}
            style={
              selected
                ? {
                    backgroundColor: colorToken.soft,
                    borderColor: colorToken.border,
                    color: colorToken.text,
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.42)",
                  }
                : undefined
            }
            onClick={() => {
              if (!mobile && onToggleHabitVisibility) {
                onToggleHabitVisibility(habit.id);
                return;
              }
              onSelectHabit(habit.id);
            }}
          >
            <span
              className="inline-flex h-8 w-7 shrink-0 items-center justify-center"
              aria-hidden="true"
            >
              <span
                className="size-2.5 rounded-full"
                style={{
                  backgroundColor: colorToken.indicator,
                  opacity: selected ? 0.95 : 0.52,
                }}
              />
            </span>
            <span
              className={cn(
                "min-w-0 truncate pl-1 pr-3",
                mobile && "text-left text-[0.74rem] leading-[0.84rem]"
              )}
            >
              {habit.name}
            </span>
          </button>
        );
      })}

      {!creationDisabled ? (
        <button
          type="button"
          data-onboarding-habit-create={guidedNotice?.target === "habit" ? "true" : undefined}
          aria-label="Criar novo hábito"
          title="Criar novo hábito"
          className={cn(
            "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card text-foreground shadow-none transition-all duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-foreground/20 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45",
            mobile && "h-10 w-full rounded-[8px]",
          )}
          onClick={onRequestCreate}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );

  return (
    <section
      data-habit-controls
      data-onboarding-habit-controls
      data-onboarding-habit-showcase={
        guidedNotice?.target === "habit-showcase" ? "true" : undefined
      }
      data-habit-controls-layout={mobile ? "mobile" : "desktop"}
      className={cn(
        "shrink-0",
        mobile
          ? "w-full overflow-hidden rounded-[10px] border border-border bg-card"
          : cn(
              "mx-auto flex w-full flex-col items-center",
              DESKTOP_CONTROL_MAX_WIDTH_CLASS,
              DESKTOP_CONTROL_DIVIDER_CLASS,
              DESKTOP_CONTROL_ROW_GAP_CLASS,
              DESKTOP_CONTROL_REGION_TOP_GAP_CLASS,
              DESKTOP_CONTROL_GRID_GAP_CLASS
            )
      )}
    >
      <h1 className="sr-only">Hábitos</h1>

      {mobile ? (
        <div className="m-[3px] flex h-10 w-[calc(100%-6px)] items-center gap-1 rounded-[8px] px-2.5">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center text-foreground/72">
              <CircleCheck className="size-3.5" aria-hidden="true" />
            </span>
            <span className="truncate text-[13px] font-semibold leading-4 text-foreground">
              Hábitos
            </span>
          </span>
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-border bg-card text-foreground/70 shadow-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out hover:border-foreground/18 hover:bg-muted hover:text-foreground active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
              aria-expanded={expanded}
              aria-controls={controlsId}
              aria-label={expanded ? "Recolher hábitos" : "Mostrar hábitos"}
              onClick={() => setExpandedPersisted((current) => !current)}
            >
              <ChevronDown
                className={cn("size-4 transition-transform duration-300", expanded && "rotate-180")}
              />
            </button>
          </span>
        </div>
      ) : (
        <div className="relative -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 pb-0.5 doze52-scrollbar-none sm:mx-0 sm:w-full sm:px-0">
          <div className="flex w-max min-w-full flex-nowrap items-center justify-center gap-x-2 gap-y-1.5 sm:gap-x-2.5">
            <div className="inline-flex h-8 shrink-0 items-center overflow-hidden rounded-[10px] border border-primary bg-primary text-[0.78rem] font-semibold text-primary-foreground">
              <span className="inline-flex h-8 w-7 items-center justify-center" aria-hidden="true">
                <CircleCheck className="size-3.5" />
              </span>
              <span className="pr-2.5">Hábitos</span>
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-foreground/70 shadow-none transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
              aria-expanded={expanded}
              aria-controls={controlsId}
              aria-label={expanded ? "Recolher hábitos" : "Mostrar hábitos"}
              title={expanded ? "Recolher hábitos" : "Mostrar hábitos"}
              onClick={() => setExpandedPersisted((current) => !current)}
            >
              {expanded ? (
                <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>

            {expanded ? habitButtons : null}
          </div>
        </div>
      )}

      {mobile ? (
        <CollapsibleControlRegion
          id={controlsId}
          expanded={expanded || isEditing}
          contentClassName={cn(
            "px-2",
            expanded ? "border-t border-border/55 py-2" : "border-0 py-0"
          )}
        >
          {isEditing ? (
            <HabitEditList
              habits={habits}
              selectedHabit={selectedHabit}
              mobile
              creationDisabled={creationDisabled}
              onSelectHabit={onSelectHabit}
              onRequestCreate={onRequestCreate}
              onEditHabit={onEditHabit}
              onReorderHabits={onReorderHabits}
            />
          ) : (
            habitButtons
          )}
        </CollapsibleControlRegion>
      ) : null}

      {guidedNotice && onDismissGuidedNotice ? (
        <>
          {guidedNotice.target === "habit" ? (
            <GuidedTargetOutline selector="[data-onboarding-habit-create]" />
          ) : null}
          <GuidedToolbarNoticeCard
            notice={guidedNotice}
            onClose={onDismissGuidedNotice}
            onAction={onGuidedNoticeAction}
            placement="viewport"
            portaled
            anchorSelector={
              guidedNotice.target === "habit"
                ? "[data-onboarding-habit-create]"
                : "[data-onboarding-habit-controls]"
            }
            anchorPlacement="below-center"
          />
        </>
      ) : null}
    </section>
  );
}
