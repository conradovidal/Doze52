"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  PencilLine,
  Plus,
  RotateCcw,
} from "lucide-react";

import { getCategoryColorToken } from "@/lib/category-palette";
import { useTheme } from "@/lib/theme";
import type { Habit } from "@/lib/types";
import { cn } from "@/lib/utils";

type HabitControlsProps = {
  habits: Habit[];
  totalActiveHabits: number;
  selectedHabit: Habit | null;
  archivedHabits?: Habit[];
  isEditing?: boolean;
  mobile?: boolean;
  creationDisabled: boolean;
  creationDisabledLabel: string | null;
  onSelectHabit: (habitId: string) => void;
  onRequestCreate: () => void;
  onEditHabit?: (habitId: string) => void;
  onMoveHabit?: (habitId: string, direction: -1 | 1) => void;
  onReactivateHabit?: (habitId: string) => void;
};

export function HabitControls({
  habits,
  totalActiveHabits,
  selectedHabit,
  archivedHabits = [],
  isEditing = false,
  mobile = false,
  creationDisabled,
  creationDisabledLabel,
  onSelectHabit,
  onRequestCreate,
  onEditHabit,
  onMoveHabit,
  onReactivateHabit,
}: HabitControlsProps) {
  const { mode: themeMode } = useTheme();
  const [expanded, setExpanded] = React.useState(true);
  const controlsId = React.useId();

  const habitButtons = (
    <div
      className={cn(
        mobile
          ? "grid w-full grid-cols-2 gap-1.5 min-[430px]:grid-cols-3"
          : "flex min-h-8 w-max min-w-full flex-nowrap items-center justify-start gap-1.5 sm:w-full sm:flex-wrap sm:justify-center sm:gap-2"
      )}
    >
      {habits.map((habit) => {
        const selected = selectedHabit?.id === habit.id;
        const colorToken = getCategoryColorToken(habit.color, themeMode);

        if (!mobile && isEditing) {
          const habitIndex = habits.findIndex((entry) => entry.id === habit.id);
          return (
            <div
              key={habit.id}
              data-habit-edit-chip={habit.id}
              className={cn(
                "inline-flex h-8 shrink-0 items-center overflow-hidden rounded-[10px] border bg-card text-[0.78rem] font-semibold",
                selected ? "border-foreground/30" : "border-border"
              )}
            >
              <button
                type="button"
                aria-label={`Selecionar hábito ${habit.name}`}
                className="flex h-8 min-w-0 items-center gap-2 px-2.5 hover:bg-muted"
                onClick={() => onSelectHabit(habit.id)}
              >
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: colorToken.indicator }}
                  aria-hidden="true"
                />
                <span className="max-w-32 truncate">{habit.name}</span>
              </button>
              <button
                type="button"
                aria-label={`Mover ${habit.name} para a esquerda`}
                disabled={habitIndex === 0}
                className="grid size-7 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25"
                onClick={() => onMoveHabit?.(habit.id, -1)}
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Mover ${habit.name} para a direita`}
                disabled={habitIndex === habits.length - 1}
                className="grid size-7 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25"
                onClick={() => onMoveHabit?.(habit.id, 1)}
              >
                <ChevronRight className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Editar hábito ${habit.name}`}
                className="grid size-7 place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => onEditHabit?.(habit.id)}
              >
                <PencilLine className="size-3.5" />
              </button>
            </div>
          );
        }

        return (
          <button
            key={habit.id}
            type="button"
            aria-pressed={selected}
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
            onClick={() => onSelectHabit(habit.id)}
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

      <button
        type="button"
        aria-label="Criar novo hábito"
        title={creationDisabledLabel ?? "Criar novo hábito"}
        disabled={creationDisabled}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card text-foreground shadow-none transition-all duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-foreground/20 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 disabled:cursor-not-allowed disabled:text-muted-foreground/55 disabled:hover:border-border disabled:hover:bg-card",
          mobile && "h-10 w-full rounded-[8px]"
        )}
        onClick={onRequestCreate}
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <section
      data-habit-controls
      data-habit-controls-layout={mobile ? "mobile" : "desktop"}
      className={cn(
        "shrink-0",
        mobile
          ? "w-full overflow-hidden rounded-[10px] border border-border bg-card"
          : "mb-2 flex w-full flex-col items-center gap-1.5"
      )}
    >
      <h1 className="sr-only">Hábitos</h1>

      {mobile ? (
        <button
          type="button"
          className="m-[3px] flex h-10 w-[calc(100%-6px)] items-center justify-between gap-3 rounded-[8px] px-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/45"
          aria-expanded={expanded}
          aria-controls={controlsId}
          aria-label={expanded ? "Recolher hábitos" : "Mostrar hábitos"}
          onClick={() => setExpanded((current) => !current)}
        >
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="grid size-7 shrink-0 place-items-center text-foreground/72">
              <CircleCheck className="size-3.5" aria-hidden="true" />
            </span>
            <span className="truncate text-[13px] font-semibold leading-4 text-foreground">
              Hábitos
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              expanded && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>
      ) : (
        <div className="flex items-center justify-center gap-1.5">
          <div className="inline-flex h-8 items-center overflow-hidden rounded-[10px] border border-primary bg-primary text-[0.78rem] font-semibold text-primary-foreground">
            <span className="inline-flex h-8 w-7 items-center justify-center" aria-hidden="true">
              <CircleCheck className="size-3.5" />
            </span>
            <span className="pr-2.5">Hábitos</span>
          </div>
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-[10px] border border-border bg-card text-foreground/70 transition-colors hover:border-foreground/18 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
            aria-expanded={expanded}
            aria-controls={controlsId}
            aria-label={expanded ? "Recolher hábitos" : "Mostrar hábitos"}
            title={expanded ? "Recolher hábitos" : "Mostrar hábitos"}
            onClick={() => setExpanded((current) => !current)}
          >
            <ChevronDown
              className={cn("size-3.5 transition-transform", expanded && "rotate-180")}
              aria-hidden="true"
            />
          </button>
        </div>
      )}

      <div
        id={controlsId}
        aria-hidden={!expanded}
        inert={!expanded ? true : undefined}
        className={cn(
          "grid w-full transition-[grid-template-rows,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
          expanded
            ? "grid-rows-[1fr] translate-y-0 opacity-100"
            : "pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0"
        )}
      >
        <div
          className={cn(
            "min-h-0 overflow-hidden",
            mobile
              ? cn(
                  "px-2 transition-[padding,border-color]",
                  expanded ? "border-t border-border/55 py-2" : "border-0 py-0"
                )
              : "-mx-4 overflow-x-auto px-4 pb-0.5 doze52-scrollbar-none sm:mx-0 sm:px-0 md:overflow-visible"
          )}
        >
          {habitButtons}
          {!mobile && isEditing && archivedHabits.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5" data-archived-habits>
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Arquivados
              </span>
              {archivedHabits.map((habit) => (
                <button
                  key={habit.id}
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-dashed border-border px-2.5 text-[0.75rem] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => onReactivateHabit?.(habit.id)}
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  {habit.name}
                </button>
              ))}
            </div>
          ) : null}
          {totalActiveHabits > habits.length ? (
            <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
              Mostrando os 4 primeiros hábitos nesta grade.
            </p>
          ) : null}
          {creationDisabledLabel ? (
            <p role="status" className="mt-1.5 text-center text-[10px] text-muted-foreground">
              {creationDisabledLabel}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
