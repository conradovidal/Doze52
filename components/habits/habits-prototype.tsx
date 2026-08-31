"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

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

const HABITS_PROTOTYPE_SCROLL_PREFIX = "doze52:habits-prototype:scroll";
const MOBILE_DESKTOP_HINT_STORAGE_KEY = "doze52:mobile-onboarding:desktop-hint-dismissed";
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
  onRequestSignup,
  isAuthenticated = false,
  isEditing = false,
  onYearChange,
  guidedNotice = null,
  showcase = null,
  onDismissGuidedNotice,
  onGuidedNoticeAction,
  onHabitCreated,
  onHabitCheckIn,
  retrospectiveInteracted = false,
  scrollToTodayRequestKey = 0,
}: {
  year: number;
  todayIso: string;
  isMobile: boolean;
  onRequireAuth?: () => void;
  onRequestSignup?: (trigger: HTMLElement) => void;
  isAuthenticated?: boolean;
  isEditing?: boolean;
  onYearChange: (year: number) => void;
  guidedNotice?: import("@/components/onboarding/guided-toolbar-notice").GuidedToolbarNotice | null;
  showcase?: OnboardingHabitShowcase | null;
  onDismissGuidedNotice?: () => void;
  onGuidedNoticeAction?: (input?: { hasExistingHabit: boolean }) => void;
  onHabitCreated?: () => void;
  onHabitCheckIn?: () => void;
  retrospectiveInteracted?: boolean;
  scrollToTodayRequestKey?: number;
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
  const [createHintDismissed, setCreateHintDismissed] = React.useState(false);
  const [markHintDismissed, setMarkHintDismissed] = React.useState(false);
  const [desktopHintDismissed, setDesktopHintDismissed] = React.useState(true);
  const [draftName, setDraftName] = React.useState("");
  const [draftColor, setDraftColor] = React.useState<string>(HABIT_COLORS[0]);
  const scrollRegionRef = React.useRef<HTMLDivElement | null>(null);
  const currentWeekRef = React.useRef<HTMLButtonElement | null>(null);
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

    const regionRect = region.getBoundingClientRect();
    const targetRect = currentWeek.getBoundingClientRect();
    region.scrollTop = Math.max(
      0,
      region.scrollTop +
        (targetRect.top - regionRect.top) -
        region.clientHeight / 3
    );
  }, [selectedHabit, showcaseActive, year]);

  const scrollToToday = React.useCallback(() => {
    if (!todayIso) return;
    const todayYear = Number(todayIso.slice(0, 4));
    if (todayYear !== year) {
      onYearChange(todayYear);
      return;
    }

    const region = scrollRegionRef.current;
    const currentWeek = currentWeekRef.current;
    if (!region || !currentWeek) return;

    const regionRect = region.getBoundingClientRect();
    const targetRect = currentWeek.getBoundingClientRect();
    const targetTop = Math.max(
      0,
      region.scrollTop + (targetRect.top - regionRect.top) - region.clientHeight / 3
    );
    region.scrollTo({ top: targetTop, behavior: "smooth" });
  }, [todayIso, year, onYearChange]);

  const handledScrollToTodayRequestRef = React.useRef(0);
  React.useEffect(() => {
    if (
      scrollToTodayRequestKey <= 0 ||
      scrollToTodayRequestKey === handledScrollToTodayRequestRef.current
    ) {
      return;
    }
    handledScrollToTodayRequestRef.current = scrollToTodayRequestKey;
    scrollToToday();
  }, [scrollToTodayRequestKey, scrollToToday]);

  React.useEffect(() => {
    setShowcaseVisibleHabitIds(showcase?.visibleHabitIds ?? []);
  }, [showcase]);

  React.useEffect(() => {
    if (!isMobile || showcaseActive) return;
    try {
      setDesktopHintDismissed(
        window.localStorage.getItem(MOBILE_DESKTOP_HINT_STORAGE_KEY) === "true"
      );
    } catch {
      setDesktopHintDismissed(false);
    }
  }, [isMobile, showcaseActive]);

  const dismissDesktopHint = React.useCallback(() => {
    setDesktopHintDismissed(true);
    try {
      window.localStorage.setItem(MOBILE_DESKTOP_HINT_STORAGE_KEY, "true");
    } catch {
      // Reaparece na próxima visita se o storage falhar; sem impacto funcional.
    }
  }, []);

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
          checkIns={presentedCheckIns}
          selectedHabit={desktopSelectedHabit}
          visibleHabitIds={presentedVisibleHabitIdSet}
          creationDisabled={creationDisabled}
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

  const hasCompletedAnyCheckIn = Object.values(checkIns).some(
    (checkIn) => checkIn?.completed
  );
  const onboardingBanner = showcaseActive
    ? null
    : activeHabits.length === 0 && !createHintDismissed
      ? {
          message: "Toque em + para criar seu primeiro hábito.",
          onDismiss: () => setCreateHintDismissed(true),
        }
      : activeHabits.length > 0 && !hasCompletedAnyCheckIn && !markHintDismissed
        ? {
            message: "Toque num dia pra marcar.",
            onDismiss: () => setMarkHintDismissed(true),
          }
        : hasCompletedAnyCheckIn && !desktopHintDismissed
          ? {
              message:
                "Isso é só o começo. O ano inteiro mora no computador — aqui, você continua o dia a dia.",
              onDismiss: dismissDesktopHint,
              anchoredToNav: true,
              action:
                !isAuthenticated && onRequestSignup
                  ? {
                      label: "Criar conta",
                      onClick: () => {
                        const trigger = document.querySelector<HTMLElement>(
                          "[data-onboarding-auth-entry]"
                        );
                        if (trigger) onRequestSignup(trigger);
                      },
                    }
                  : undefined,
            }
          : null;

  return (
    <section
      data-habits-prototype
      className="mx-auto flex min-h-0 w-full max-w-[31rem] flex-1 flex-col overflow-hidden pt-12"
    >
      <HabitControls
        habits={activeHabits}
        selectedHabit={selectedHabit}
        mobile
        creationDisabled={creationDisabled}
        onSelectHabit={setSelectedHabitId}
        onRequestCreate={requestCreateHabit}
        isEditing={isEditing}
        onEditHabit={requestEditHabit}
        onReorderHabits={reorderHabits}
      />

      {onboardingBanner && !onboardingBanner.anchoredToNav ? (
        <div
          data-mobile-habits-onboarding-hint
          className="inverse-product-surface mt-2 flex items-start gap-2 rounded-[10px] border border-border bg-card px-3 py-2.5 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.45)]"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[13px] leading-5 text-card-foreground">
              {onboardingBanner.message}
            </p>
          </div>
          <button
            type="button"
            aria-label="Dispensar"
            title="Dispensar"
            className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
            onClick={onboardingBanner.onDismiss}
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}

      {onboardingBanner && onboardingBanner.anchoredToNav && typeof document !== "undefined"
        ? createPortal(
            <div
              data-mobile-habits-onboarding-hint
              className="inverse-product-surface fixed inset-x-3 z-40 flex items-start gap-2 rounded-[10px] border border-border bg-card px-3 py-2.5 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.45)]"
              style={{
                bottom: "calc(4.4rem + env(safe-area-inset-bottom, 0px))",
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-5 text-card-foreground">
                  {onboardingBanner.message}
                </p>
                {onboardingBanner.action ? (
                  <button
                    type="button"
                    className="mt-1.5 text-[13px] font-semibold text-primary underline underline-offset-2"
                    onClick={onboardingBanner.action.onClick}
                  >
                    {onboardingBanner.action.label}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Dispensar"
                title="Dispensar"
                className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
                onClick={onboardingBanner.onDismiss}
              >
                <X className="size-3.5" />
              </button>
            </div>,
            document.body
          )
        : null}

      <div
        data-mobile-habits-grid
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
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
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(4.25rem+env(safe-area-inset-bottom,0px))] pt-2 [scrollbar-width:thin] sm:px-6"
          >
            <div className="mx-auto flex max-w-[20.2rem] items-stretch">
              <div className="flex w-5 shrink-0 flex-col sm:w-6">
                {weeks.map((week) => (
                  <div key={week.id} className="relative h-10 sm:h-11">
                    {week.monthLabel ? (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-0 [writing-mode:vertical-rl] rotate-180 whitespace-nowrap text-[13px] font-semibold uppercase leading-none tracking-[0.08em] text-muted-foreground/40 sm:text-sm"
                      >
                        {week.monthLabel}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="relative grid min-w-0 flex-1 grid-cols-7 overflow-hidden rounded-2xl border border-border/60 bg-card">
                {weeks.map((week, weekIndex) => {
                  const completedFlags = week.days.map((day) => {
                    if (!day.inYear || !selectedHabit) return false;
                    const key = getHabitCheckInKey(selectedHabit.id, day.dateIso);
                    return Boolean(checkIns[key]?.completed);
                  });
                  const isFirstWeek = weekIndex === 0;
                  const isLastWeek = weekIndex === weeks.length - 1;

                  return (
                    <React.Fragment key={week.id}>
                      {week.days.map((day, dayIndex) => {
                        const isWeekend = dayIndex === 5 || dayIndex === 6;
                        const isPast = !day.isToday && !day.isFuture;
                        const completed = completedFlags[dayIndex];
                        const joinLeft = completed && completedFlags[dayIndex - 1];
                        const joinRight = completed && completedFlags[dayIndex + 1];
                        const dividerClass = "border-r-border/40";
                        const cornerClass =
                          isFirstWeek && dayIndex === 0
                            ? "rounded-tl-2xl"
                            : isFirstWeek && dayIndex === 6
                              ? "rounded-tr-2xl"
                              : isLastWeek && dayIndex === 0
                                ? "rounded-bl-2xl"
                                : isLastWeek && dayIndex === 6
                                  ? "rounded-br-2xl"
                                  : undefined;

                        if (!day.inYear) {
                          return (
                            <span
                              key={day.dateIso}
                              aria-hidden="true"
                              className={cn(
                                "h-10 border-b-[1.5px] border-r-[1.5px] sm:h-11",
                                dividerClass,
                                cornerClass
                              )}
                              style={{
                                backgroundColor: `hsl(var(${
                                  isPast
                                    ? "--cal-cell-outside-past"
                                    : "--cal-cell-outside"
                                }))`,
                              }}
                            />
                          );
                        }

                        const dayAction = getHabitDayAction({
                          inYear: day.inYear,
                          isFuture: day.isFuture,
                          hasSelectedHabit: Boolean(selectedHabit),
                        });
                        const disabled = dayAction === "blocked" || isEditing;
                        const dateLabel = formatAccessibleDate(day.dateIso);
                        const actionLabel = completed ? "Desmarcar" : "Marcar";
                        const markerColor =
                          selectedHabit?.color ?? CATEGORY_COLOR_BASE_BLUE;
                        const cellToneVar = isPast
                          ? "--cal-cell-weekday-past"
                          : "--cal-cell-weekday";

                        return (
                          <button
                            key={day.dateIso}
                            ref={day.isToday ? currentWeekRef : undefined}
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
                              "relative grid h-10 place-items-center border-b-[1.5px] border-r-[1.5px] text-[11px] font-medium tabular-nums transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/65 focus-visible:ring-inset sm:h-11 sm:text-xs",
                              dividerClass,
                              cornerClass,
                              disabled ? "cursor-not-allowed" : "hover:brightness-110",
                              "text-foreground/85",
                              day.isToday && "z-10 ring-2 ring-inset ring-destructive"
                            )}
                            style={{ backgroundColor: `hsl(var(${cellToneVar}))` }}
                            onClick={() => {
                              if (isEditing) return;
                              if (dayAction === "toggle" && selectedHabit) {
                                toggleHabitDay(selectedHabit, day.dateIso);
                              } else if (dayAction === "create") {
                                requestCreateHabit();
                              }
                            }}
                          >
                            {isWeekend ? (
                              <span
                                aria-hidden="true"
                                className="absolute inset-0 bg-foreground/[0.08]"
                              />
                            ) : null}
                            {joinLeft ? (
                              <span
                                aria-hidden="true"
                                className="absolute -left-px top-1/2 h-[11px] w-[calc(28%+1px)] -translate-y-1/2"
                                style={{ backgroundColor: markerColor }}
                              />
                            ) : null}
                            {joinRight ? (
                              <span
                                aria-hidden="true"
                                className="absolute -right-px top-1/2 h-[11px] w-[calc(28%+1px)] -translate-y-1/2"
                                style={{ backgroundColor: markerColor }}
                              />
                            ) : null}
                            {completed ? (
                              <span
                                aria-hidden="true"
                                className="absolute inset-[15%] rounded-full"
                                style={{ backgroundColor: markerColor }}
                              />
                            ) : null}
                            <span
                              className={cn(
                                "relative",
                                completed && "text-neutral-950"
                              )}
                            >
                              {day.dayOfMonth}
                            </span>
                            {day.isToday ? (
                              <span className="sr-only">Hoje</span>
                            ) : null}
                            {completed ? (
                              <span className="sr-only">, concluído</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
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
