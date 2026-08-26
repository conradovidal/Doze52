"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ProUpgradeDialog } from "@/components/billing/pro-upgrade-dialog";
import { DesktopHabitsPrototype } from "@/components/habits/desktop-habits-prototype";
import { HabitControls } from "@/components/habits/habit-controls";
import { useFeedback } from "@/components/ui/feedback-provider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CATEGORY_COLOR_BASE_BLUE,
  CATEGORY_COLOR_BASE_CORAL,
  CATEGORY_COLOR_BASE_GREEN,
  CATEGORY_COLOR_BASE_TEAL,
  CATEGORY_COLOR_BASE_VIOLET,
  CATEGORY_COLOR_BASE_YELLOW,
} from "@/lib/category-palette";
import {
  buildHabitPrototypeWeeks,
  applyActiveHabitOrder,
  getDesktopVisibleHabits,
  getHabitDayAction,
  getHabitCheckInKey,
  orderActiveHabits,
  setHabitArchived,
} from "@/lib/habits-prototype";
import type { Habit, HabitCheckIn } from "@/lib/types";
import { useBilling } from "@/lib/use-billing";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const HABITS_PROTOTYPE_SESSION_KEY = "doze52:habits-prototype:v1";
const HABITS_PROTOTYPE_SCROLL_PREFIX = "doze52:habits-prototype:scroll";
const HABIT_COLORS = [
  CATEGORY_COLOR_BASE_BLUE,
  CATEGORY_COLOR_BASE_TEAL,
  CATEGORY_COLOR_BASE_GREEN,
  CATEGORY_COLOR_BASE_YELLOW,
  CATEGORY_COLOR_BASE_CORAL,
  CATEGORY_COLOR_BASE_VIOLET,
] as const;
const ACCESSIBLE_DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "full",
  timeZone: "UTC",
});

const formatAccessibleDate = (dateIso: string) =>
  ACCESSIBLE_DATE_FORMATTER.format(new Date(`${dateIso}T12:00:00Z`));

type HabitsPrototypeSession = {
  habits: Habit[];
  checkIns: Record<string, HabitCheckIn>;
  selectedHabitId: string | null;
};

const EMPTY_HABITS_SESSION: HabitsPrototypeSession = {
  habits: [],
  checkIns: {},
  selectedHabitId: null,
};

const readHabitsPrototypeSession = (): HabitsPrototypeSession => {
  if (typeof window === "undefined") return EMPTY_HABITS_SESSION;
  try {
    const raw = window.sessionStorage.getItem(HABITS_PROTOTYPE_SESSION_KEY);
    if (!raw) return EMPTY_HABITS_SESSION;
    const parsed = JSON.parse(raw) as Partial<HabitsPrototypeSession>;
    if (!Array.isArray(parsed.habits) || typeof parsed.checkIns !== "object") {
      return EMPTY_HABITS_SESSION;
    }
    return {
      habits: parsed.habits,
      checkIns: (parsed.checkIns ?? {}) as Record<string, HabitCheckIn>,
      selectedHabitId:
        typeof parsed.selectedHabitId === "string" ? parsed.selectedHabitId : null,
    };
  } catch {
    return EMPTY_HABITS_SESSION;
  }
};

const getHabitScrollStorageKey = (year: number, habitId: string) =>
  `${HABITS_PROTOTYPE_SCROLL_PREFIX}:${year}:${habitId}`;

function HabitEditorDialog({
  open,
  name,
  color,
  onOpenChange,
  onNameChange,
  onColorChange,
  onSubmit,
  editing,
  onArchive,
}: {
  open: boolean;
  name: string;
  color: string;
  onOpenChange: (open: boolean) => void;
  onNameChange: (name: string) => void;
  onColorChange: (color: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  editing: boolean;
  onArchive?: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[430px]">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar hábito" : "Novo hábito"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Atualize nome ou cor sem perder o histórico já registrado."
                : "Só o essencial agora. O registro diário será feito direto na grade."}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="habit-prototype-name" className="text-sm font-medium">
                Nome do hábito
              </label>
              <Input
                id="habit-prototype-name"
                value={name}
                maxLength={80}
                autoFocus
                placeholder="Ex.: Caminhar"
                onChange={(event) => onNameChange(event.target.value)}
              />
            </div>

            <fieldset>
              <legend className="text-sm font-medium">Cor</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {HABIT_COLORS.map((habitColor) => (
                  <button
                    key={habitColor}
                    type="button"
                    aria-label={`Usar cor ${habitColor}`}
                    aria-pressed={color === habitColor}
                    className="grid size-9 place-items-center rounded-full border border-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 aria-pressed:ring-2 aria-pressed:ring-foreground/65 aria-pressed:ring-offset-2"
                    style={{ backgroundColor: habitColor }}
                    onClick={() => onColorChange(habitColor)}
                  >
                    {color === habitColor ? (
                      <Check className="size-4 text-slate-950" strokeWidth={2.6} />
                    ) : null}
                  </button>
                ))}
                <label className="relative grid size-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-border bg-background text-[10px] font-semibold text-muted-foreground focus-within:ring-2 focus-within:ring-ring/60 focus-within:ring-offset-2">
                  <span aria-hidden="true">+</span>
                  <span className="sr-only">Escolher outra cor</span>
                  <input
                    type="color"
                    value={color}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(event) => onColorChange(event.target.value)}
                  />
                </label>
              </div>
            </fieldset>
          </div>

          <DialogFooter className="mt-6">
            {editing && onArchive ? (
              <Button type="button" variant="ghost" className="sm:mr-auto" onClick={onArchive}>
                Arquivar
              </Button>
            ) : null}
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="premium" disabled={!name.trim()}>
              {editing ? "Salvar alterações" : "Criar hábito"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function HabitsPrototype({
  year,
  todayIso,
  isMobile,
  onRequireAuth,
  isEditing = false,
  onToggleEditing,
  onYearChange,
  guidedNotice = null,
  onDismissGuidedNotice,
  onGuidedNoticeAction,
  onHabitCreated,
}: {
  year: number;
  todayIso: string;
  isMobile: boolean;
  onRequireAuth?: () => void;
  isEditing?: boolean;
  onToggleEditing?: () => void;
  onYearChange: (year: number) => void;
  guidedNotice?: import("@/components/onboarding/guided-toolbar-notice").GuidedToolbarNotice | null;
  onDismissGuidedNotice?: () => void;
  onGuidedNoticeAction?: () => void;
  onHabitCreated?: () => void;
}) {
  const { notify } = useFeedback();
  const { limits, isPro, isLoading: isBillingLoading, error: billingError } =
    useBilling();
  const [initialSession] = React.useState(readHabitsPrototypeSession);
  const [habits, setHabits] = React.useState<Habit[]>(initialSession.habits);
  const [checkIns, setCheckIns] = React.useState<Record<string, HabitCheckIn>>(
    initialSession.checkIns
  );
  const [selectedHabitId, setSelectedHabitId] = React.useState<string | null>(
    initialSession.selectedHabitId
  );
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [editingHabitId, setEditingHabitId] = React.useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);
  const [draftName, setDraftName] = React.useState("");
  const [draftColor, setDraftColor] = React.useState<string>(HABIT_COLORS[0]);
  const scrollRegionRef = React.useRef<HTMLDivElement | null>(null);
  const currentWeekRef = React.useRef<HTMLDivElement | null>(null);

  const activeHabits = React.useMemo(
    () => orderActiveHabits(habits),
    [habits]
  );
  const archivedHabits = React.useMemo(
    () => habits.filter((habit) => Boolean(habit.archivedAt)),
    [habits]
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
    () => getDesktopVisibleHabits(activeHabits),
    [activeHabits]
  );
  const desktopSelectedHabit = React.useMemo(
    () =>
      desktopHabits.find((habit) => habit.id === selectedHabitId) ??
      desktopHabits[0] ??
      null,
    [desktopHabits, selectedHabitId]
  );
  const creationUnavailable = isBillingLoading || Boolean(billingError);
  const reachedHabitLimit = activeHabits.length >= limits.maxHabits;
  const creationDisabled =
    creationUnavailable || (isPro && reachedHabitLimit);
  const creationDisabledLabel = creationUnavailable
    ? "Aguarde a confirmação do seu plano para criar outro hábito."
    : isPro && reachedHabitLimit
      ? "O plano Pro permite até 4 hábitos neste protótipo."
      : null;

  React.useLayoutEffect(() => {
    const region = scrollRegionRef.current;
    const currentWeek = currentWeekRef.current;
    if (!region || !currentWeek) return;

    if (selectedHabit) {
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
  }, [selectedHabit, year]);

  React.useEffect(() => {
    try {
      window.sessionStorage.setItem(
        HABITS_PROTOTYPE_SESSION_KEY,
        JSON.stringify({ habits, checkIns, selectedHabitId })
      );
    } catch {
      // O protótipo continua funcional na memória quando o storage não está disponível.
    }
  }, [checkIns, habits, selectedHabitId]);

  const requestCreateHabit = () => {
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

    const timestamp = new Date().toISOString();
    if (editingHabitId) {
      setHabits((current) =>
        current.map((habit) =>
          habit.id === editingHabitId
            ? { ...habit, name, color: draftColor, updatedAt: timestamp }
            : habit
        )
      );
      setCreateDialogOpen(false);
      setEditingHabitId(null);
      return;
    }
    const habit: Habit = {
      id: crypto.randomUUID(),
      name,
      color: draftColor,
      icon: "circle-check",
      position: activeHabits.length,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    setHabits((current) => [...current, habit]);
    setSelectedHabitId(habit.id);
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
    const timestamp = new Date().toISOString();
    setHabits((current) => applyActiveHabitOrder(current, orderedIds, timestamp));
  };

  const archiveEditingHabit = () => {
    if (!editingHabitId) return;
    const timestamp = new Date().toISOString();
    const nextActive = activeHabits.filter((habit) => habit.id !== editingHabitId);
    setHabits((current) =>
      setHabitArchived(current, editingHabitId, timestamp, timestamp)
    );
    if (selectedHabitId === editingHabitId) {
      setSelectedHabitId(nextActive[0]?.id ?? null);
    }
    setCreateDialogOpen(false);
    setEditingHabitId(null);
  };

  const reactivateHabit = (habitId: string) => {
    if (creationUnavailable) {
      notify({
        tone: "info",
        title: "Plano ainda não confirmado",
        description: "Tente restaurar o hábito novamente em instantes.",
      });
      return;
    }
    if (reachedHabitLimit) {
      if (!isPro) setUpgradeOpen(true);
      else
        notify({
          tone: "info",
          title: "Limite de hábitos atingido",
          description: "Arquive um hábito ativo antes de restaurar este.",
        });
      return;
    }
    const timestamp = new Date().toISOString();
    setHabits((current) =>
      setHabitArchived(
        current,
        habitId,
        undefined,
        timestamp,
        activeHabits.length
      )
    );
    setSelectedHabitId(habitId);
  };

  const toggleHabitDay = (habit: Habit | null, dateIso: string) => {
    if (!habit) return;
    const key = getHabitCheckInKey(habit.id, dateIso);
    setCheckIns((current) => {
      const completed = !current[key]?.completed;
      return {
        ...current,
        [key]: {
          habitId: habit.id,
          date: dateIso,
          completed,
          updatedAt: new Date().toISOString(),
        },
      };
    });
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
      onArchive={editingHabitId ? archiveEditingHabit : undefined}
    />
  );

  if (!isMobile) {
    return (
      <>
        <DesktopHabitsPrototype
          year={year}
          todayIso={todayIso}
          habits={desktopHabits}
          totalActiveHabits={activeHabits.length}
          checkIns={checkIns}
          selectedHabit={desktopSelectedHabit}
          creationDisabled={creationDisabled}
          creationDisabledLabel={creationDisabledLabel}
          onSelectHabit={setSelectedHabitId}
          onToggleDay={(dateIso) =>
            toggleHabitDay(desktopSelectedHabit, dateIso)
          }
          onRequestCreate={requestCreateHabit}
          isEditing={isEditing}
          archivedHabits={archivedHabits}
          onEditHabit={requestEditHabit}
          onReorderHabits={reorderHabits}
          onReactivateHabit={reactivateHabit}
          onToggleEditing={onToggleEditing}
          onYearChange={onYearChange}
          guidedNotice={guidedNotice}
          onDismissGuidedNotice={onDismissGuidedNotice}
          onGuidedNoticeAction={onGuidedNoticeAction}
        />
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
        archivedHabits={archivedHabits}
        onEditHabit={requestEditHabit}
        onReorderHabits={reorderHabits}
        onReactivateHabit={reactivateHabit}
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
                                ? "border-black/10 text-slate-950 shadow-sm hover:-translate-y-px"
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
                <Check className="size-2 text-slate-950" strokeWidth={3} />
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
