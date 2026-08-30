"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { ProUpgradeDialog } from "@/components/billing/pro-upgrade-dialog";
import { DesktopHabitsPrototype } from "@/components/habits/desktop-habits-prototype";
import { HabitControls } from "@/components/habits/habit-controls";
import { HabitDayPicker } from "@/components/habits/habit-day-picker";
import { HABIT_COLORS, HabitEditorDialog } from "@/components/habits/habit-editor-dialog";
import { useFeedback } from "@/components/ui/feedback-provider";
import { CATEGORY_COLOR_BASE_BLUE } from "@/lib/category-palette";
import {
  buildHabitPrototypeWeeks,
  getDesktopVisibleHabits,
  getHabitDayAction,
  getHabitCheckInKey,
  getHabitRetrospectiveDates,
  orderActiveHabits,
  type OnboardingHabitShowcase,
} from "@/lib/habits-prototype";
import { useHabitsStore } from "@/lib/habits-store";
import type { Habit } from "@/lib/types";
import { useBilling } from "@/lib/use-billing";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const HABITS_PROTOTYPE_SCROLL_PREFIX = "doze52:habits-prototype:scroll";
const ACCESSIBLE_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "full",
  timeZone: "UTC",
});

const formatAccessibleDate = (dateIso: string) =>
  ACCESSIBLE_DATE_FORMATTER.format(new Date(`${dateIso}T12:00:00Z`));

const getHabitScrollStorageKey = (year: number, habitId: string) =>
  `${HABITS_PROTOTYPE_SCROLL_PREFIX}:${year}:${habitId}`;

export function HabitsPrototype({
  year,
  todayIso,
  isMobile,
  onRequireAuth,
  isEditing = false,
  onToggleEditing,
  onYearChange,
  guidedNotice = null,
  showcase = null,
  onDismissGuidedNotice,
  onGuidedNoticeAction,
  onHabitCreated,
  onHabitCheckIn,
  retrospectiveInteracted = false,
}: {
  year: number;
  todayIso: string;
  isMobile: boolean;
  onRequireAuth?: () => void;
  isEditing?: boolean;
  onToggleEditing?: () => void;
  onYearChange: (year: number) => void;
  guidedNotice?: import("@/components/onboarding/guided-toolbar-notice").GuidedToolbarNotice | null;
  showcase?: OnboardingHabitShowcase | null;
  onDismissGuidedNotice?: () => void;
  onGuidedNoticeAction?: (input?: { hasExistingHabit: boolean }) => void;
  onHabitCreated?: () => void;
  onHabitCheckIn?: () => void;
  retrospectiveInteracted?: boolean;
}) {
  const { notify } = useFeedback();
  const { limits, isPro, isLoading: isBillingLoading, error: billingError } =
    useBilling();
  const habits = useHabitsStore((s) => s.habits);
  const checkIns = useHabitsStore((s) => s.checkIns);
  const selectedHabitId = useHabitsStore((s) => s.selectedHabitId);
  const visibleHabitIds = useHabitsStore((s) => s.visibleHabitIds);
  const setSelectedHabitId = useHabitsStore((s) => s.setSelectedHabitId);
  const createHabitInStore = useHabitsStore((s) => s.createHabit);
  const updateHabitInStore = useHabitsStore((s) => s.updateHabit);
  const reorderHabitsInStore = useHabitsStore((s) => s.reorderHabits);
  const deleteHabitInStore = useHabitsStore((s) => s.deleteHabit);
  const toggleHabitCheckInInStore = useHabitsStore((s) => s.toggleHabitCheckIn);
  const toggleHabitVisibilityInStore = useHabitsStore((s) => s.toggleHabitVisibility);
  const [showcaseVisibleHabitIds, setShowcaseVisibleHabitIds] = React.useState<
    string[]
  >(showcase?.visibleHabitIds ?? []);
  const [dayPicker, setDayPicker] = React.useState<{
    dateIso: string;
    anchor: HTMLElement;
  } | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editingHabitId, setEditingHabitId] = React.useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);
  const [draftName, setDraftName] = React.useState("");
  const [draftColor, setDraftColor] = React.useState<string>(HABIT_COLORS[0]);
  const scrollRegionRef = React.useRef<HTMLDivElement | null>(null);
  const currentWeekRef = React.useRef<HTMLDivElement | null>(null);
  const closeDayPicker = React.useCallback(() => {
    setDayPicker((current) => {
      current?.anchor.focus();
      return null;
    });
  }, []);

  const activeHabits = React.useMemo(
    () => orderActiveHabits(habits),
    [habits]
  );
  const showcaseActive = Boolean(showcase);
  const presentedHabits = showcase?.habits ?? activeHabits;
  const presentedCheckIns = showcase?.checkIns ?? checkIns;
  const presentedVisibleHabitIds = showcaseActive
    ? showcaseVisibleHabitIds
    : visibleHabitIds;
  const presentedVisibleHabitIdSet = React.useMemo(
    () => new Set(presentedVisibleHabitIds),
    [presentedVisibleHabitIds]
  );
  const selectedHabit = React.useMemo(
    () =>
      activeHabits.find((habit) => habit.id === selectedHabitId) ??
      activeHabits[0] ??
      null,
    [activeHabits, selectedHabitId]
  );
  const weeks = React.useMemo(
    () => (todayIso ? buildHabitPrototypeWeeks(year, todayIso) : []),
    [todayIso, year]
  );
  const desktopHabits = React.useMemo(
    () =>
      getDesktopVisibleHabits(
        presentedHabits.filter((habit) => presentedVisibleHabitIdSet.has(habit.id))
      ),
    [presentedHabits, presentedVisibleHabitIdSet]
  );
  const desktopAllHabits = React.useMemo(
    () => getDesktopVisibleHabits(presentedHabits),
    [presentedHabits]
  );
  const desktopSelectedHabit = React.useMemo(
    () => (presentedHabits.length === 1 ? presentedHabits[0] ?? null : null),
    [presentedHabits]
  );
  const retrospectiveDates = React.useMemo(
    () =>
      guidedNotice?.target === "habit-created"
        ? new Set(getHabitRetrospectiveDates(year, todayIso))
        : undefined,
    [guidedNotice?.target, todayIso, year]
  );
  const creationUnavailable = isBillingLoading || Boolean(billingError);
  const reachedHabitLimit = activeHabits.length >= limits.maxHabits;
  const creationDisabled = showcaseActive ||
    creationUnavailable || (isPro && reachedHabitLimit);
  const creationDisabledLabel = showcaseActive
    ? null
    : creationUnavailable
    ? "Aguarde a confirmação do seu plano para criar outro hábito."
    : isPro && reachedHabitLimit
      ? "O plano Pro permite até 4 hábitos neste protótipo."
      : null;

  React.useLayoutEffect(() => {
    const region = scrollRegionRef.current;
    const currentWeek = currentWeekRef.current;
    if (!region || !currentWeek) return;

    if (selectedHabit && !showcaseActive) {
      const savedScroll = Number(
        window.sessionStorage.getItem(
          getHabitScrollStorageKey(year, selectedHabit.id)
        )
      );
      if (Number.isFinite(savedScroll) && savedScroll > 0) {
        region.scrollTop = savedScroll;
        return;
      }
    }

    region.scrollTop = Math.max(
      0,
      currentWeek.offsetTop - region.offsetTop - region.clientHeight / 3
    );
  }, [selectedHabit, showcaseActive, year]);

  React.useEffect(() => {
    setShowcaseVisibleHabitIds(showcase?.visibleHabitIds ?? []);
  }, [showcase]);

  const requestCreateHabit = () => {
    if (showcaseActive) return;
    if (creationUnavailable) {
      notify({
        tone: "info",
        title: "Plano ainda não confirmado",
        description:
          "Seus hábitos continuam disponíveis. Tente criar novamente em instantes.",
      });
      return;
    }
    if (reachedHabitLimit) {
      if (!isPro) {
        setUpgradeOpen(true);
      } else {
        notify({
          tone: "info",
          title: "Limite de hábitos atingido",
          description: "O plano Pro permite acompanhar até 4 hábitos.",
        });
      }
      return;
    }
    setDraftName("");
    setEditingHabitId(null);
    setDraftColor(HABIT_COLORS[activeHabits.length % HABIT_COLORS.length]);
    setCreateDialogOpen(true);
  };

  const createHabit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;

    if (editingHabitId) {
      updateHabitInStore(editingHabitId, { name, color: draftColor });
      setCreateDialogOpen(false);
      setEditingHabitId(null);
      return;
    }
    createHabitInStore({ name, color: draftColor });
    setCreateDialogOpen(false);
    onHabitCreated?.();
  };

  const requestEditHabit = (habitId: string) => {
    const habit = habits.find((entry) => entry.id === habitId);
    if (!habit) return;
    setEditingHabitId(habit.id);
    setDraftName(habit.name);
    setDraftColor(habit.color);
    setCreateDialogOpen(true);
  };

  const reorderHabits = (orderedIds: string[]) => {
    reorderHabitsInStore(orderedIds);
  };

  const deleteEditingHabit = () => {
    if (!editingHabitId) return;
    deleteHabitInStore(editingHabitId);
    setCreateDialogOpen(false);
    setEditingHabitId(null);
  };

  const toggleHabitDay = (habit: Habit | null, dateIso: string) => {
    if (!habit || showcaseActive) return;
    toggleHabitCheckInInStore(habit.id, dateIso);
    onHabitCheckIn?.();
  };

  const toggleHabitVisibility = (habitId: string) => {
    if (!showcaseActive && activeHabits.length === 1) return;
    if (showcaseActive) {
      setShowcaseVisibleHabitIds((current) =>
        current.includes(habitId)
          ? current.filter((id) => id !== habitId)
          : [...current, habitId]
      );
      return;
    }
    toggleHabitVisibilityInStore(habitId);
  };

  const createDialog = (
    <HabitEditorDialog
      open={createDialogOpen}
      name={draftName}
      color={draftColor}
      onOpenChange={setCreateDialogOpen}
      onNameChange={setDraftName}
      onColorChange={setDraftColor}
      onSubmit={createHabit}
      editing={Boolean(editingHabitId)}
      onDelete={editingHabitId ? deleteEditingHabit : undefined}
    />
  );

  if (!isMobile) {
    return (
      <>
        <DesktopHabitsPrototype
          year={year}
          todayIso={todayIso}
          habits={desktopAllHabits}
          visibleHabits={desktopHabits}
          allHabits={desktopAllHabits}
          totalActiveHabits={presentedHabits.length}
          checkIns={presentedCheckIns}
          selectedHabit={desktopSelectedHabit}
          visibleHabitIds={presentedVisibleHabitIdSet}
          creationDisabled={creationDisabled}
          creationDisabledLabel={creationDisabledLabel}
          onSelectHabit={toggleHabitVisibility}
          onToggleDay={(dateIso) =>
            toggleHabitDay(desktopSelectedHabit, dateIso)
          }
          onOpenDayPicker={(dateIso, anchor) => {
            if (!showcaseActive) setDayPicker({ dateIso, anchor });
          }}
          onRequestCreate={requestCreateHabit}
          isEditing={showcaseActive ? false : isEditing}
          readOnly={showcaseActive}
          onEditHabit={requestEditHabit}
          onReorderHabits={reorderHabits}
          onToggleEditing={showcaseActive ? undefined : onToggleEditing}
          onYearChange={onYearChange}
          guidedNotice={guidedNotice}
          retrospectiveDates={retrospectiveDates}
          retrospectiveHighlighted={!retrospectiveInteracted}
          onDismissGuidedNotice={onDismissGuidedNotice}
          onGuidedNoticeAction={() =>
            onGuidedNoticeAction?.({ hasExistingHabit: activeHabits.length > 0 })
          }
        />
        {dayPicker ? (
          <HabitDayPicker
            dateIso={dayPicker.dateIso}
            anchor={dayPicker.anchor}
            habits={activeHabits}
            checkIns={checkIns}
            onToggle={toggleHabitDay}
            onClose={closeDayPicker}
          />
        ) : null}
        {createDialog}
        <ProUpgradeDialog
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          reason="habits"
          onRequireAuth={onRequireAuth}
        />
      </>
    );
  }

  return (
    <section
      data-habits-prototype
      className="mx-auto flex min-h-0 w-full max-w-[62rem] flex-1 flex-col overflow-hidden"
    >
      <HabitControls
        habits={activeHabits}
        totalActiveHabits={activeHabits.length}
        selectedHabit={selectedHabit}
        mobile
        creationDisabled={creationDisabled}
        creationDisabledLabel={creationDisabledLabel}
        onSelectHabit={setSelectedHabitId}
        onRequestCreate={requestCreateHabit}
        isEditing={isEditing}
        onEditHabit={requestEditHabit}
        onReorderHabits={reorderHabits}
        onToggleEditing={onToggleEditing}
      />

      <div
        data-mobile-habits-grid
        className="mt-2 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/42 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.5)]"
      >
          <div className="grid shrink-0 grid-cols-7 gap-1 border-b border-border/55 bg-background/78 px-3 py-2 sm:gap-2 sm:px-6">
            {WEEKDAY_LABELS.map((label) => (
              <span
                key={label}
                className="text-center text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground sm:text-xs"
              >
                {label}
              </span>
            ))}
          </div>

          <div
            ref={scrollRegionRef}
            onScroll={(event) => {
              if (!selectedHabit) return;
              try {
                window.sessionStorage.setItem(
                  getHabitScrollStorageKey(year, selectedHabit.id),
                  String(event.currentTarget.scrollTop)
                );
              } catch {
                // A posição volta para a semana atual se o storage falhar.
              }
            }}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [scrollbar-width:thin] sm:px-6 sm:py-5"
          >
            <div className="mx-auto max-w-[34rem] space-y-1.5 sm:space-y-2">
              {weeks.map((week) => {
                const hasToday = week.days.some((day) => day.isToday);
                return (
                  <div
                    key={week.id}
                    ref={hasToday ? currentWeekRef : undefined}
                    data-habit-week={week.id}
                  >
                    {week.monthLabel ? (
                      <p className="mb-1 mt-2 text-[10px] font-semibold uppercase tracking-[0.11em] text-muted-foreground first:mt-0 sm:text-xs">
                        {week.monthLabel}
                      </p>
                    ) : null}
                    <div
                      className={cn(
                        "grid grid-cols-7 gap-1 rounded-xl px-1 py-1 sm:gap-2 sm:px-2",
                        hasToday && "bg-muted/55 ring-1 ring-border/75"
                      )}
                    >
                      {week.days.map((day) => {
                        if (!day.inYear) {
                          return (
                            <span
                              key={day.dateIso}
                              aria-hidden="true"
                              className="mx-auto size-9 rounded-full border border-dashed border-border/45 bg-muted/18 sm:size-10"
                            />
                          );
                        }

                        const key = selectedHabit
                          ? getHabitCheckInKey(selectedHabit.id, day.dateIso)
                          : null;
                        const completed = key
                          ? Boolean(checkIns[key]?.completed)
                          : false;
                        const dayAction = getHabitDayAction({
                          inYear: day.inYear,
                          isFuture: day.isFuture,
                          hasSelectedHabit: Boolean(selectedHabit),
                        });
                        const disabled = dayAction === "blocked" || isEditing;
                        const dateLabel = formatAccessibleDate(day.dateIso);
                        const actionLabel = completed ? "Desmarcar" : "Marcar";

                        return (
                          <button
                            key={day.dateIso}
                            type="button"
                            aria-pressed={completed}
                            aria-label={
                              isEditing
                                ? `${dateLabel}: finalize a edição para registrar hábitos`
                                : disabled
                                ? `${dateLabel}: data futura, indisponível`
                                : selectedHabit
                                  ? `${actionLabel} ${selectedHabit.name} em ${dateLabel}`
                                  : `Criar um hábito para ${dateLabel}`
                            }
                            title={dateLabel}
                            disabled={disabled}
                            className={cn(
                              "relative mx-auto grid size-9 place-items-center rounded-full border text-[11px] font-semibold tabular-nums transition-[transform,background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:size-10 sm:text-xs",
                              completed
                                ? "border-black/10 text-neutral-950 shadow-sm hover:-translate-y-px"
                                : disabled
                                  ? "cursor-not-allowed border-border/45 bg-muted/28 text-muted-foreground/40"
                                  : "border-border bg-background text-muted-foreground hover:-translate-y-px hover:border-foreground/30 hover:text-foreground",
                              day.isToday &&
                                "ring-2 ring-foreground/65 ring-offset-2 ring-offset-background"
                            )}
                            style={
                              completed && selectedHabit
                                ? { backgroundColor: selectedHabit.color }
                                : undefined
                            }
                            onClick={() => {
                              if (isEditing) return;
                              if (dayAction === "toggle" && selectedHabit) {
                                toggleHabitDay(selectedHabit, day.dateIso);
                              } else if (dayAction === "create") {
                                requestCreateHabit();
                              }
                            }}
                          >
                            {completed ? (
                              <Check className="size-4" strokeWidth={2.6} aria-hidden="true" />
                            ) : (
                              day.dayOfMonth
                            )}
                            {day.isToday ? (
                              <span className="sr-only">Hoje</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-border/55 bg-background/78 px-3 py-2 text-[10px] text-muted-foreground sm:text-xs">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-full border border-border bg-background" />
              Disponível
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="grid size-3 place-items-center rounded-full border border-black/10"
                style={{
                  backgroundColor:
                    selectedHabit?.color ?? CATEGORY_COLOR_BASE_BLUE,
                }}
              >
                <Check className="size-2 text-neutral-950" strokeWidth={3} />
              </span>
              Concluído
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-full border border-border/45 bg-muted/35" />
              Futuro
            </span>
          </div>
      </div>

      {createDialog}
      <ProUpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        reason="habits"
        onRequireAuth={onRequireAuth}
      />

      <span className="sr-only" aria-live="polite">
        Visualização mobile de hábitos
      </span>
    </section>
  );
}
