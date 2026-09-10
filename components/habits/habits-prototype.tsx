"use client";

import { trackContinuityMetric } from "@/lib/product-metrics";
import { isAccountContinuityEnabled } from "@/lib/feature-flags";
import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { ProUpgradeDialog } from "@/components/billing/pro-upgrade-dialog";
import { DesktopHabitsPrototype } from "@/components/habits/desktop-habits-prototype";
import { HabitControls } from "@/components/habits/habit-controls";
import { HabitDayPicker } from "@/components/habits/habit-day-picker";
import { HABIT_COLORS, HabitEditorDialog } from "@/components/habits/habit-editor-dialog";
import { GuidedToolbarNoticeCard } from "@/components/onboarding/guided-toolbar-notice";
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
import {
  readMobileHabitsOnboardingStep,
  writeMobileHabitsOnboardingStep,
  type MobileHabitsOnboardingStep,
} from "@/lib/mobile-habits-onboarding";
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
  showcaseDisplay = null,
  onDismissGuidedNotice,
  onGuidedNoticeAction,
  onHabitCreated,
  onHabitCheckIn,
  retrospectiveInteracted = false,
  scrollToTodayRequestKey = 0,
  headerMinimized = false,
  onMobileOnboardingStepChange,
  hasEstablishedAccountData = false,
}: {
  year: number;
  todayIso: string;
  isMobile: boolean;
  onRequireAuth?: () => void;
  onRequestSignup?: (trigger: HTMLElement) => void;
  isAuthenticated?: boolean;
  isEditing?: boolean;
  onYearChange: (year: number) => void;
  headerMinimized?: boolean;
  guidedNotice?: import("@/components/onboarding/guided-toolbar-notice").GuidedToolbarNotice | null;
  showcase?: OnboardingHabitShowcase | null;
  showcaseDisplay?: OnboardingHabitShowcase | null;
  onDismissGuidedNotice?: () => void;
  onGuidedNoticeAction?: (input?: { hasExistingHabit: boolean }) => void;
  onHabitCreated?: () => void;
  onHabitCheckIn?: () => void;
  retrospectiveInteracted?: boolean;
  scrollToTodayRequestKey?: number;
  /**
   * Jornada curta e própria do mobile (ver lib/mobile-habits-onboarding.ts):
   * ela vive inteira dentro deste componente, salva no localStorage. Este
   * callback só existe para app/page.tsx acompanhar o passo atual em tempo
   * real, o suficiente para travar/liberar e destacar o botão Anual da
   * navegação (que não é filho deste componente, então não dá pra travar
   * sozinho a partir daqui).
   */
  onMobileOnboardingStepChange?: (step: MobileHabitsOnboardingStep) => void;
  /**
   * Conta autenticada com dados reais já confirmados pelo servidor (ano
   * montado, categorias criadas) — calculado em app/page.tsx a partir de
   * `remoteReady`. Hábitos não sincronizam entre aparelhos hoje (só o
   * calendário sincroniza), então essa conta pode chegar aqui com zero
   * hábitos NESTE dispositivo mesmo já tendo criado hábitos reais em outro.
   * Isso muda a mensagem do "+": não é mais um convite para começar do zero.
   */
  hasEstablishedAccountData?: boolean;
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

  // Jornada curta e própria do mobile: só corre para quem chega anônimo,
  // sem nenhum hábito ainda — a mesma população que já enxerga a vitrine de
  // exemplo (Parte 1). Quem já tinha hábitos antes desta função existir, ou
  // está autenticado, pula direto para "completed" e nunca vê os cards.
  const [mobileOnboardingStep, setMobileOnboardingStepState] =
    React.useState<MobileHabitsOnboardingStep>(() => {
      const stored = readMobileHabitsOnboardingStep();
      if (stored) return stored;
      return habits.length === 0 ? "create_habit" : "completed";
    });
  const setMobileOnboardingStep = React.useCallback(
    (step: MobileHabitsOnboardingStep) => {
      writeMobileHabitsOnboardingStep(step);
      setMobileOnboardingStepState(step);
      onMobileOnboardingStepChange?.(step);
    },
    [onMobileOnboardingStepChange]
  );
  // app/page.tsx só sabe o passo inicial quando este componente monta pela
  // primeira vez (ele lê o storage de novo por conta própria); espelha aqui
  // pra cobrir esse primeiro instante também.
  React.useEffect(() => {
    onMobileOnboardingStepChange?.(mobileOnboardingStep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Alguém que já chega com hábitos (de antes desta função existir) pula
  // direto para "completed" acima — mas isso existe só em memória até aqui.
  // Grava uma vez para não reabrir a jornada caso a pessoa apague todos os
  // hábitos depois.
  const mobileOnboardingBackfilledRef = React.useRef(false);
  React.useEffect(() => {
    if (mobileOnboardingBackfilledRef.current) return;
    mobileOnboardingBackfilledRef.current = true;
    if (readMobileHabitsOnboardingStep()) return;
    writeMobileHabitsOnboardingStep(mobileOnboardingStep);
  }, [mobileOnboardingStep]);
  const mobileOnboardingActive =
    isMobile &&
    !isAuthenticated &&
    mobileOnboardingStep !== "completed" &&
    mobileOnboardingStep !== "dismissed";

  const showcaseActive = Boolean(showcase);
  // A partir de habit_instruction a vitrine (showcaseDisplay) some do controle
  // de trava, mas continua na tela ao lado do hábito real que a pessoa cria —
  // mesma lógica de "compor, não substituir" usada no Anual com o exemplo.
  const displayShowcase = showcase ?? showcaseDisplay;
  const showcaseHabitIds = React.useMemo(
    () => new Set((displayShowcase?.habits ?? []).map((habit) => habit.id)),
    [displayShowcase]
  );
  const presentedHabits = React.useMemo(
    () =>
      showcaseActive
        ? (showcase?.habits ?? activeHabits)
        : displayShowcase
          ? [...displayShowcase.habits, ...activeHabits]
          : activeHabits,
    [activeHabits, displayShowcase, showcase, showcaseActive]
  );
  const presentedCheckIns = React.useMemo(
    () =>
      showcaseActive
        ? (showcase?.checkIns ?? checkIns)
        : displayShowcase
          ? { ...displayShowcase.checkIns, ...checkIns }
          : checkIns,
    [checkIns, displayShowcase, showcase, showcaseActive]
  );
  const presentedVisibleHabitIds = React.useMemo(
    () =>
      showcaseActive
        ? showcaseVisibleHabitIds
        : displayShowcase
          ? [...displayShowcase.visibleHabitIds, ...visibleHabitIds]
          : visibleHabitIds,
    [displayShowcase, showcaseActive, showcaseVisibleHabitIds, visibleHabitIds]
  );
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
  // O mobile desenha a grade a partir de um único hábito por vez, então ele
  // precisa de um "selecionado" que também enxergue a vitrine — senão a tela
  // abre em branco enquanto a pessoa ainda não criou nada. A preferência é:
  // o que ela escolheu, depois um hábito real dela, e só então a vitrine.
  const presentedSelectedHabit = React.useMemo(
    () =>
      presentedHabits.find((habit) => habit.id === selectedHabitId) ??
      activeHabits[0] ??
      presentedHabits[0] ??
      null,
    [activeHabits, presentedHabits, selectedHabitId]
  );
  const presentedSelectedIsShowcase = Boolean(
    presentedSelectedHabit && showcaseHabitIds.has(presentedSelectedHabit.id)
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
  const desktopSelectedHabit = React.useMemo(() => {
    // Durante o tour, a vitrine soma hábitos decorativos aos reais na tela —
    // mas só o hábito real pode ser marcado, e no plano Free só existe um.
    // Marcar direto nele evita pedir pra "selecionar" entre os que aparecem.
    if (!showcaseActive && displayShowcase && activeHabits.length === 1) {
      return activeHabits[0];
    }
    return presentedHabits.length === 1 ? presentedHabits[0] ?? null : null;
  }, [activeHabits, displayShowcase, presentedHabits, showcaseActive]);
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
  // Enquanto só a vitrine está visível (nenhum hábito real ainda), os dias
  // ficam bloqueados: não há hábito nenhum pra marcar, só o "+" cria um.
  const dayInteractionBlocked =
    showcaseActive || (Boolean(displayShowcase) && activeHabits.length === 0);

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
    if (mobileOnboardingStep === "create_habit") {
      setMobileOnboardingStep("mark_day");
    }
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
    // A vitrine aparece na mesma lista dos hábitos reais; os ids dela não
    // existem no store, então saem antes de chegar lá.
    reorderHabitsInStore(orderedIds.filter((id) => !showcaseHabitIds.has(id)));
  };

  const deleteEditingHabit = () => {
    if (!editingHabitId) return;
    deleteHabitInStore(editingHabitId);
    setCreateDialogOpen(false);
    setEditingHabitId(null);
  };

  const toggleHabitDay = (habit: Habit | null, dateIso: string) => {
    if (!habit || showcaseActive || showcaseHabitIds.has(habit.id)) return;
    toggleHabitCheckInInStore(habit.id, dateIso);
    if (mobileOnboardingStep === "mark_day") {
      if (isAccountContinuityEnabled) trackContinuityMetric("save_invited");
      setMobileOnboardingStep(isAccountContinuityEnabled ? "save_progress" : "goto_annual");
    }
    onHabitCheckIn?.();
  };

  const toggleHabitVisibility = (habitId: string) => {
    if (showcaseActive) {
      setShowcaseVisibleHabitIds((current) =>
        current.includes(habitId)
          ? current.filter((id) => id !== habitId)
          : [...current, habitId]
      );
      return;
    }
    if (showcaseHabitIds.has(habitId)) return;
    if (activeHabits.length === 1) return;
    toggleHabitVisibilityInStore(habitId);
  };

  // Os três passos usam o mesmo card do tour desktop (GuidedToolbarNoticeCard),
  // só o conteúdo muda. Nenhum tem botão: os dois primeiros avançam sozinhos
  // quando a pessoa cria o hábito e marca o primeiro dia (ver
  // createHabit/toggleHabitDay acima); o terceiro termina quando ela toca no
  // próprio botão Anual da navegação (ver app/page.tsx), não num botão do
  // card. Nenhum toque de "Continuar" no meio do caminho.
  const mobileOnboardingNotice = React.useMemo(():
    | import("@/components/onboarding/guided-toolbar-notice").GuidedToolbarNotice
    | null => {
    if (!mobileOnboardingActive) return null;
    if (mobileOnboardingStep === "create_habit") {
      return {
        // Mesmo alvo do desktop: destaca o "+" com o fundo tonal do guia.
        target: "habit",
        title: "Assim funcionam os hábitos.",
        instruction: "Estes dois são só exemplo. Toque no + e crie o seu.",
        stepLabel: "Passo 1 de 3",
      };
    }
    if (mobileOnboardingStep === "mark_day") {
      return {
        target: "habit-created",
        title: "Agora é seu.",
        instruction:
          "Toque em um dia recente para marcar que você cumpriu. Esse é o gesto principal do app.",
        stepLabel: "Passo 2 de 3",
      };
    }
    if (mobileOnboardingStep === "goto_annual") {
      return {
        // Destaca o botão Anual da navegação inferior.
        target: "mobile-goto-annual",
        title: "Isto é Hábitos.",
        instruction:
          "A visão Anual, com seus eventos, complementa esta aqui. Toque em Anual para conhecer.",
        stepLabel: "Passo 3 de 3",
      };
    }
    return null;
  }, [mobileOnboardingActive, mobileOnboardingStep]);

  const dismissMobileOnboarding = React.useCallback(() => {
    setMobileOnboardingStep("dismissed");
    // Dispensar o guia novo significa "sem dica nenhuma agora". Sem isso, a
    // pessoa cairia de volta nas dicas antigas (visual diferente) pelo resto
    // da criação do hábito. Se quiser ajuda de novo, o "+" e a grade
    // continuam funcionando normalmente, só sem avisos.
    setCreateHintDismissed(true);
    setMarkHintDismissed(true);
    dismissDesktopHint();
  }, [dismissDesktopHint, setMobileOnboardingStep]);

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
            if (!dayInteractionBlocked) setDayPicker({ dateIso, anchor });
          }}
          onRequestCreate={requestCreateHabit}
          isEditing={showcaseActive ? false : isEditing}
          headerMinimized={headerMinimized}
          readOnly={dayInteractionBlocked}
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
  // Enquanto a jornada própria do mobile está no ar, ela já cobre as três
  // mensagens abaixo (criar, marcar, continuar no desktop) com o card
  // reutilizado do desktop — a dica antiga fica de fora para não duplicar.
  const onboardingBanner = showcaseActive || mobileOnboardingActive
    ? null
    : activeHabits.length === 0 &&
        isAuthenticated &&
        hasEstablishedAccountData &&
        !createHintDismissed
      ? {
          // Hábitos não sincronizam entre aparelhos hoje — "crie seu
          // primeiro hábito" seria enganoso para quem já tem hábitos reais
          // no computador e só está vendo este aparelho vazio.
          message:
            isAccountContinuityEnabled ? "Seus hábitos acompanham sua conta. Toque no + para começar." : "Hábitos ainda não sincronizam entre aparelhos. Toque no + para acompanhar por aqui também.",
          onDismiss: () => setCreateHintDismissed(true),
        }
      : activeHabits.length === 0 && !createHintDismissed
        ? {
            message: "Toque no + para criar seu primeiro hábito.",
            onDismiss: () => setCreateHintDismissed(true),
          }
        : activeHabits.length > 0 && !hasCompletedAnyCheckIn && !markHintDismissed
          ? {
              message: "Toque num dia para marcar.",
              onDismiss: () => setMarkHintDismissed(true),
            }
          : hasCompletedAnyCheckIn && !desktopHintDismissed
            ? {
                message:
                  "Isso é só o começo. O ano completo mora no computador. Aqui, você continua o dia a dia.",
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
        habits={presentedHabits}
        selectedHabit={presentedSelectedHabit}
        mobile
        creationDisabled={creationDisabled}
        onSelectHabit={setSelectedHabitId}
        onRequestCreate={requestCreateHabit}
        isEditing={isEditing}
        onEditHabit={requestEditHabit}
        onReorderHabits={reorderHabits}
        // Só para forçar a lista aberta e marcar o "+" com
        // data-onboarding-habit-create quando o passo aponta pra ele — não
        // passamos onDismissGuidedNotice/onGuidedNoticeAction de propósito,
        // pra não duplicar o card (a jornada mobile renderiza o dela mesma,
        // logo abaixo, em vez do card interno deste componente).
        guidedNotice={mobileOnboardingNotice}
      />

      {isAccountContinuityEnabled && mobileOnboardingActive && mobileOnboardingStep === "save_progress" ? (
        <section aria-label="Guardar progresso" className="inverse-product-surface mx-3 my-2 rounded-xl border bg-card p-4 text-card-foreground">
          <h2 className="font-semibold">Seu primeiro passo já está registrado.</h2>
          <p className="mt-1 text-sm">Crie sua conta para guardar seu hábito e continuar em outro aparelho.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button className="rounded-lg bg-primary px-3 py-2 text-primary-foreground" onClick={(event) => onRequestSignup?.(event.currentTarget)}>Criar conta e salvar</button>
            <button className="underline" onClick={() => setMobileOnboardingStep("completed")}>Continuar sem conta</button>
          </div>
        </section>
      ) : null}
      {mobileOnboardingNotice ? (
        mobileOnboardingNotice.target === "mobile-goto-annual" ? (
          // Este passo aponta pro botão Anual da navegação, lá embaixo — o
          // card fica perto dele, não grudado no topo como os dois de cima
          // (cujo alvo, a vitrine e o "+", também fica no topo).
          <GuidedToolbarNoticeCard
            notice={mobileOnboardingNotice}
            onClose={dismissMobileOnboarding}
            mobilePlacement="bottom"
          />
        ) : (
          <div className="mt-2">
            <GuidedToolbarNoticeCard
              notice={mobileOnboardingNotice}
              onClose={dismissMobileOnboarding}
              inline
            />
          </div>
        )
      ) : null}

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
                    if (!day.inYear || !presentedSelectedHabit) return false;
                    const key = getHabitCheckInKey(
                      presentedSelectedHabit.id,
                      day.dateIso
                    );
                    return Boolean(presentedCheckIns[key]?.completed);
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
                          hasSelectedHabit: Boolean(presentedSelectedHabit),
                        });
                        // A vitrine é ilustrativa: os dias dela ficam visíveis
                        // (é o que mostra o gesto do produto) mas não marcáveis.
                        const disabled =
                          dayAction === "blocked" ||
                          isEditing ||
                          presentedSelectedIsShowcase;
                        const dateLabel = formatAccessibleDate(day.dateIso);
                        const actionLabel = completed ? "Desmarcar" : "Marcar";
                        const markerColor =
                          presentedSelectedHabit?.color ?? CATEGORY_COLOR_BASE_BLUE;
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
                                : presentedSelectedIsShowcase
                                  ? `${dateLabel}: exemplo, não editável`
                                  : presentedSelectedHabit
                                    ? `${actionLabel} ${presentedSelectedHabit.name} em ${dateLabel}`
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
                              if (dayAction === "toggle" && presentedSelectedHabit) {
                                toggleHabitDay(presentedSelectedHabit, day.dateIso);
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
