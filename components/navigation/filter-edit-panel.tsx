"use client";

import * as React from "react";
import { Archive, ArrowLeft, CalendarDays, ChevronDown, CircleCheck } from "lucide-react";
import { ProfileBar } from "@/components/profile-bar";
import { CategoryBar } from "@/components/category-bar";
import { CategoryManager } from "@/components/category-manager";
import { CategoryCreationChoice } from "@/components/category-creation-flow";
import { ProfileManager } from "@/components/profile-manager";
import { ArchivedItemsSection } from "@/components/archived-items-section";
import { CollapsibleControlRegion } from "@/components/ui/collapsible-control-region";
import { ViewSwap } from "@/components/ui/view-swap";
import { HabitEditList } from "@/components/habits/habit-edit-list";
import { useHabitCheckInCount, useHabitRemoval } from "@/components/habits/use-habit-removal";
import {
  HABIT_COLORS,
  HabitEditorFields,
} from "@/components/habits/habit-editor-dialog";
import { ProUpgradeDialog } from "@/components/billing/pro-upgrade-dialog";
import {
  GuidedToolbarNoticeCard,
  type GuidedToolbarNotice,
} from "@/components/onboarding/guided-toolbar-notice";
import { WrapUpCategorySuggestions } from "@/components/onboarding/wrap-up-category-suggestions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback-provider";
import { useHabitsStore } from "@/lib/habits-store";
import { useStore } from "@/lib/store";
import {
  orderActiveHabits,
  type OnboardingHabitShowcase,
} from "@/lib/habits-prototype";
import { useBilling } from "@/lib/use-billing";
import { cn } from "@/lib/utils";
import { nudgeProAtLastFreeSlot } from "@/lib/pro-upgrade-nudge";
import type { AnchorPoint } from "@/lib/types";
import type { ProductDestinationId } from "@/lib/product-navigation";

const ORGANIZE_SECTION_OPTIONS = [
  { value: "annual", label: "Anual", icon: CalendarDays },
  { value: "habits", label: "Hábitos", icon: CircleCheck },
] as const satisfies ReadonlyArray<{
  value: ProductDestinationId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}>;

const DETAIL_TITLES = {
  category: "Editar categoria",
  profile: "Editar contexto",
  "category-choice": "Adicionar categoria",
  "category-new": "Nova categoria",
  "profile-new": "Novo contexto",
} as const;

type FilterEditPanelProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeDestination?: ProductDestinationId;
  editingProfileId: string | null;
  onEditingProfileChange: (profileId: string) => void;
  onProfileCreated?: (profileId: string) => void;
  /** Abre o fluxo de criação de categoria fora do painel (calendário pronto e passo guiado). */
  onCreateCategory: (step?: "calendar-packs") => void;
  onCategoryCreated?: (categoryId: string) => void;
  categoryCreateOpen?: boolean;
  highlightedProfileId?: string | null;
  highlightedCategoryId?: string | null;
  highlightedCategoryEffect?: "focus" | "reveal";
  guidedToolbarNotice?: GuidedToolbarNotice | null;
  onDismissGuidedSelection?: () => void;
  onGuidedWrapUpAction?: () => void;
  onRemoveWrapUpCategory?: (categoryId: string) => boolean;
  onRequireAuth?: (anchorPoint?: AnchorPoint) => void;
  // Vitrine de hábitos do ano de exemplo (ver app/page.tsx): mesmos dados
  // que já aparecem no calendário durante o onboarding. `habitShowcaseLocked`
  // reflete o passo em que ela ainda é só demonstrativa (nenhum hábito real
  // criado ainda) — replica showcaseActive/displayShowcase de
  // habits-prototype.tsx para a aba Hábitos deste painel também compor
  // vitrine + reais, em vez de só os reais (hoje sempre vazios nesse passo).
  habitShowcase?: OnboardingHabitShowcase | null;
  habitShowcaseLocked?: boolean;
  // Guia de onboarding ainda em andamento (não finalizado nem fechado) —
  // trava criação e edição de categorias e hábitos aqui dentro, pra não
  // divergir do que o guia está construindo passo a passo. Contextos ficam
  // de fora de propósito.
  guidedOnboardingActive?: boolean;
  // Modo demonstração: edição de categoria/contexto ignora os limites do plano.
  bypassLimits?: boolean;
};

export function FilterEditPanel({
  open,
  onOpenChange,
  activeDestination = "annual",
  editingProfileId,
  onEditingProfileChange,
  onProfileCreated,
  onCreateCategory,
  onCategoryCreated,
  categoryCreateOpen = false,
  highlightedProfileId,
  highlightedCategoryId,
  highlightedCategoryEffect,
  guidedToolbarNotice,
  onDismissGuidedSelection,
  onGuidedWrapUpAction,
  onRemoveWrapUpCategory,
  onRequireAuth,
  habitShowcase = null,
  habitShowcaseLocked = false,
  guidedOnboardingActive = false,
  bypassLimits = false,
}: FilterEditPanelProps) {
  const highlightCreate = guidedToolbarNotice?.target === "calendars";
  const showWrapUpNotice =
    guidedToolbarNotice?.target === "wrap-up" && Boolean(onGuidedWrapUpAction);

  const [section, setSection] = React.useState<ProductDestinationId>(
    activeDestination
  );
  const wasOpenRef = React.useRef(false);
  const wasWrapUpNoticeRef = React.useRef(false);
  React.useEffect(() => {
    // Só re-sincroniza a aba (Anual/Hábitos) com o destino ativo no momento
    // em que o painel abre, ou quando o aviso de "wrap up" liga (ele exige
    // Anual) — não a cada mudança de activeDestination enquanto o painel já
    // está aberto, senão uma navegação de fundo (como o guia de onboarding
    // trocando de superfície) troca a aba escolhida pela pessoa sem que ela
    // tenha pedido isso.
    const justOpened = open && !wasOpenRef.current;
    const wrapUpNoticeJustAppeared = showWrapUpNotice && !wasWrapUpNoticeRef.current;
    if (open && (justOpened || wrapUpNoticeJustAppeared)) {
      setSection(showWrapUpNotice ? "annual" : activeDestination);
    }
    wasOpenRef.current = open;
    wasWrapUpNoticeRef.current = showWrapUpNotice;
  }, [open, activeDestination, showWrapUpNotice]);

  const wrapUpSuggestionsVisible = Boolean(
    showWrapUpNotice &&
      section === "annual" &&
      editingProfileId &&
      guidedToolbarNotice?.categorySuggestions?.length
  );
  const wrapUpCard = showWrapUpNotice ? (
    <GuidedToolbarNoticeCard
      notice={guidedToolbarNotice!}
      onClose={() => onDismissGuidedSelection?.()}
      onAction={onGuidedWrapUpAction}
      inline
      // Este card vive dentro do próprio painel "Organizar" (claro), não
      // flutuando sobre a grade do ano — a inversão padrão lia como uma
      // caixa escura fora de lugar aqui.
      surface="plain"
    />
  ) : null;

  const { notify } = useFeedback();
  const { limits, isPro, isLoading: isBillingLoading, error: billingError } =
    useBilling();
  const habits = useHabitsStore((s) => s.habits);
  const selectedHabitId = useHabitsStore((s) => s.selectedHabitId);
  const createHabitInStore = useHabitsStore((s) => s.createHabit);
  const updateHabitInStore = useHabitsStore((s) => s.updateHabit);
  const habitRemoval = useHabitRemoval();
  const reorderHabitsInStore = useHabitsStore((s) => s.reorderHabits);
  const toggleHabitVisibilityInStore = useHabitsStore(
    (s) => s.toggleHabitVisibility
  );

  const activeHabits = React.useMemo(() => orderActiveHabits(habits), [habits]);
  const selectedHabit = React.useMemo(
    () => activeHabits.find((habit) => habit.id === selectedHabitId) ?? null,
    [activeHabits, selectedHabitId]
  );

  // Mesma composição de habits-prototype.tsx: enquanto travada, a vitrine
  // substitui a lista (ainda não existe hábito real); depois, soma aos
  // reais em vez de sumir. Os ids da vitrine não existem no store, então
  // ficam de fora de tudo que grava (seleção, reordenação).
  const showcaseHabitIds = React.useMemo(
    () => new Set((habitShowcase?.habits ?? []).map((habit) => habit.id)),
    [habitShowcase]
  );
  const presentedHabits = React.useMemo(() => {
    if (!habitShowcase) return activeHabits;
    return habitShowcaseLocked
      ? habitShowcase.habits
      : [...habitShowcase.habits, ...activeHabits];
  }, [activeHabits, habitShowcase, habitShowcaseLocked]);

  const [habitDialogOpen, setHabitDialogOpen] = React.useState(false);
  // Editar/criar categoria e contexto troca a tela dentro do próprio painel
  // (mesmo padrão da edição de hábito) em vez de empilhar outro pop-up.
  const [detail, setDetail] = React.useState<
    | { kind: "category"; id: string }
    | { kind: "profile"; id: string }
    | { kind: "category-choice" }
    | { kind: "category-new" }
    | { kind: "profile-new"; previousSelectedProfileIds: string[] }
    | null
  >(null);
  const detailId = detail && "id" in detail ? detail.id : null;
  const profileIntent = React.useMemo(
    () =>
      detail?.kind === "profile" && detailId
        ? ({ mode: "edit", profileId: detailId } as const)
        : detail?.kind === "profile-new"
          ? ({ mode: "create" } as const)
          : null,
    // Estável por identidade: um objeto novo a cada render faria o
    // formulário reiniciar enquanto a pessoa digita.
    [detail?.kind, detailId]
  );
  const [archivedOpen, setArchivedOpen] = React.useState(false);
  const archivedCategoryCount = useStore(
    (s) => s.categories.filter((category) => category.archivedAt).length
  );
  const archivedCount =
    archivedCategoryCount + habits.filter((habit) => habit.archivedAt).length;
  const [editingHabitId, setEditingHabitId] = React.useState<string | null>(null);
  const editingHabitCheckIns = useHabitCheckInCount(editingHabitId);
  const [draftName, setDraftName] = React.useState("");
  const [draftColor, setDraftColor] = React.useState<string>(HABIT_COLORS[0]);
  const [upgradeOpen, setUpgradeOpen] = React.useState(false);

  React.useEffect(() => {
    // Fechar o painel inteiro (Escape, clique fora) não deve deixar a
    // próxima abertura caindo direto na edição de hábito.
    if (!open) {
      setHabitDialogOpen(false);
      setEditingHabitId(null);
      setDetail(null);
    }
  }, [open]);

  const creationUnavailable = isBillingLoading || Boolean(billingError);
  const reachedHabitLimit = activeHabits.length >= limits.maxHabits;
  const habitCreationDisabled =
    habitShowcaseLocked || creationUnavailable || (isPro && reachedHabitLimit);

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
    setHabitDialogOpen(true);
  };

  const requestEditHabit = (habitId: string) => {
    const habit = habits.find((entry) => entry.id === habitId);
    if (!habit) return;
    setEditingHabitId(habit.id);
    setDraftName(habit.name);
    setDraftColor(habit.color);
    setHabitDialogOpen(true);
  };

  const submitHabit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;

    if (editingHabitId) {
      updateHabitInStore(editingHabitId, { name, color: draftColor });
      setHabitDialogOpen(false);
      setEditingHabitId(null);
      return;
    }
    createHabitInStore({ name, color: draftColor });
    setHabitDialogOpen(false);
    if (!guidedOnboardingActive) {
      nudgeProAtLastFreeSlot({
        reason: "habits",
        countAfter: activeHabits.length + 1,
        limit: limits.maxHabits,
        isPro,
        notify,
      });
    }
  };

  const deleteEditingHabit = () => {
    if (!editingHabitId) return;
    habitRemoval.remove(editingHabitId);
    setHabitDialogOpen(false);
    setEditingHabitId(null);
  };

  const archiveEditingHabit = () => {
    if (!editingHabitId) return;
    habitRemoval.archive(editingHabitId);
    setHabitDialogOpen(false);
    setEditingHabitId(null);
  };

  const selectHabit = (habitId: string) => {
    if (showcaseHabitIds.has(habitId)) return;
    toggleHabitVisibilityInStore(habitId);
  };

  const reorderHabits = (orderedIds: string[]) => {
    reorderHabitsInStore(orderedIds.filter((id) => !showcaseHabitIds.has(id)));
  };

  const view = habitDialogOpen
    ? "habit"
    : detail
      ? `detail-${detail.kind}-${detailId ?? ""}`
      : section;
  const viewIsDetail = habitDialogOpen || Boolean(detail);
  // Entrar numa tela de edição desliza para a esquerda (a nova vem da
  // direita); voltar faz o caminho inverso. Trocar de aba só faz fade.
  const viewDepth = !viewIsDetail ? 0 : detail?.kind === "category-new" ? 2 : 1;
  const closeDetail = () => setDetail(null);
  // Passar a vez para o fluxo de criação (calendários prontos) e voltar dele
  // troca um modal pelo outro no mesmo recorte: a moldura não anima, só o
  // conteúdo — senão os dois scrims se cruzam e a tela pisca. A saída pula a
  // animação enquanto o fluxo está aberto; a entrada de volta fica sem
  // animação até o painel fechar de verdade (tirar a classe com o painel
  // aberto reiniciaria a animação de entrada).
  const [skipEnterMotion, setSkipEnterMotion] = React.useState(false);
  if (categoryCreateOpen && !skipEnterMotion) setSkipEnterMotion(true);
  if (!open && !categoryCreateOpen && skipEnterMotion) setSkipEnterMotion(false);
  const shellMotionClass = cn(
    skipEnterMotion && "data-[state=open]:animate-none",
    categoryCreateOpen && "data-[state=closed]:animate-none"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-filter-edit-panel
        overlayClassName={shellMotionClass}
        // Ancorado pelo topo: o cabeçalho e a linha abaixo dele ficam no mesmo
        // lugar em todas as telas; só a parte de baixo cresce ou encolhe.
        className={cn(
          "flex min-h-[min(28rem,80dvh)] max-h-[80dvh] sm:max-h-[80dvh] w-[min(30rem,calc(100vw-3rem))] max-w-[30rem] flex-col gap-0 overflow-hidden p-0",
          shellMotionClass
        )}
      >
        <DialogDescription className="sr-only">
          Gerencie contextos, categorias e hábitos.
        </DialogDescription>
        <div className="flex h-full min-h-0 flex-col">
          <header className="grid h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-border px-5">
            {viewIsDetail ? (
              <div className="col-span-3 flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="-ml-1.5"
                  aria-label="Voltar"
                  onClick={() => {
                    if (habitDialogOpen) setHabitDialogOpen(false);
                    else if (detail?.kind === "category-new")
                      setDetail({ kind: "category-choice" });
                    else closeDetail();
                  }}
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <DialogTitle className="text-base font-semibold">
                  {habitDialogOpen
                    ? editingHabitId
                      ? "Editar hábito"
                      : "Novo hábito"
                    : detail
                      ? DETAIL_TITLES[detail.kind]
                      : null}
                </DialogTitle>
              </div>
            ) : (
              <>
                <DialogTitle className="text-base font-semibold">
                  Organizar
                </DialogTitle>
                {/* Mesmo padrão da navegação do topo do app (ícone, ativo em
                    primeiro plano, inativo esmaecido), em vez de um controle
                    segmentado que não aparece em nenhum outro lugar. */}
                <div
                  role="tablist"
                  aria-label="Visão a organizar"
                  className="flex items-center gap-1 justify-self-center"
                >
                  {ORGANIZE_SECTION_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const active = section === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => setSection(option.value)}
                        className={cn(
                          "inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                          active
                            ? "text-foreground"
                            : "text-muted-foreground/55 hover:bg-muted/45 hover:text-foreground/80"
                        )}
                      >
                        <Icon className="size-[18px]" aria-hidden="true" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                <span aria-hidden="true" />
              </>
            )}
          </header>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-5 py-5">
            {/* key troca a cada alvo (edição de hábito vs. aba Anual/Hábitos)
                para a entrada reanimar a cada troca, em vez de saltar
                instantaneamente de um conteúdo para o outro. */}
            <ViewSwap view={view} depth={viewDepth}>
            {detail?.kind === "category" ? (
              <CategoryManager
                embedded
                mode="edit"
                open
                onOpenChange={(next) => {
                  if (!next) closeDetail();
                }}
                categoryId={detail.id}
                bypassLimits={bypassLimits}
              />
            ) : detail?.kind === "category-new" ? (
              <CategoryManager
                embedded
                mode="create"
                open
                onOpenChange={(next) => {
                  if (!next) closeDetail();
                }}
                profileId={editingProfileId ?? undefined}
                lockProfile
                onCreated={(categoryId) => {
                  const state = useStore.getState();
                  if (editingProfileId) state.setSelectedProfiles([editingProfileId]);
                  state.setCategoriesVisibility([categoryId], true);
                  onCategoryCreated?.(categoryId);
                }}
                onRequireAuth={onRequireAuth ? () => onRequireAuth() : undefined}
                bypassLimits={bypassLimits}
              />
            ) : detail?.kind === "category-choice" ? (
              <CategoryCreationChoice
                disabled={!editingProfileId}
                onCustom={() => setDetail({ kind: "category-new" })}
                onCalendarPacks={() => onCreateCategory("calendar-packs")}
              />
            ) : detail?.kind === "profile" || detail?.kind === "profile-new" ? (
              <ProfileManager
                embedded
                open
                onOpenChange={(next) => {
                  if (!next) closeDetail();
                }}
                intent={profileIntent}
                onRequireAuth={onRequireAuth ? () => onRequireAuth() : undefined}
                bypassLimits={bypassLimits}
                onCreated={(profileId) => {
                  // Criar um contexto não muda o filtro do calendário; o novo
                  // contexto só passa a ser o que está sendo organizado.
                  if (detail.kind === "profile-new") {
                    useStore
                      .getState()
                      .setSelectedProfiles(detail.previousSelectedProfileIds);
                  }
                  onEditingProfileChange(profileId);
                  onProfileCreated?.(profileId);
                }}
              />
            ) : habitDialogOpen ? (
              <HabitEditorFields
                dialogSemantics={false}
                name={draftName}
                color={draftColor}
                onNameChange={setDraftName}
                onColorChange={setDraftColor}
                onSubmit={submitHabit}
                editing={Boolean(editingHabitId)}
                onDelete={editingHabitId ? deleteEditingHabit : undefined}
                onArchive={editingHabitId ? archiveEditingHabit : undefined}
                checkInCount={editingHabitCheckIns}
                onCancel={() => setHabitDialogOpen(false)}
              />
            ) : section === "annual" ? (
              <>
                <section>
                  <ProfileBar
                    isInlineEditMode
                    editingProfileId={editingProfileId}
                    onEditingProfileChange={onEditingProfileChange}
                    onCreateProfile={() =>
                      setDetail({
                        kind: "profile-new",
                        previousSelectedProfileIds: [
                          ...useStore.getState().selectedProfileIds,
                        ],
                      })
                    }
                    onEditProfile={(profileId) => setDetail({ kind: "profile", id: profileId })}
                    highlightedProfileId={highlightedProfileId}
                  />
                </section>

                <section className="relative mt-6 border-t border-border/55 pt-5">
                  {wrapUpSuggestionsVisible ? (
                    <WrapUpCategorySuggestions
                      profileId={editingProfileId!}
                      suggestions={guidedToolbarNotice!.categorySuggestions!}
                      cap={limits.maxCategories}
                      onRemoveCategory={onRemoveWrapUpCategory}
                      onRequireAuth={onRequireAuth ? () => onRequireAuth() : undefined}
                      noticeSlot={wrapUpCard}
                    >
                      <CategoryBar
                        isInlineEditMode
                        editingProfileId={editingProfileId}
                        onCreateCategory={
                        // No passo guiado de calendários segue o fluxo antigo:
                        // o card do guia e os ganchos do onboarding dependem dele.
                        highlightCreate
                          ? () => onCreateCategory()
                          : () => setDetail({ kind: "category-choice" })
                      }
                        onEditCategory={(categoryId) => setDetail({ kind: "category", id: categoryId })}
                        highlightedCategoryId={highlightedCategoryId}
                        highlightedCategoryEffect={highlightedCategoryEffect}
                        // Este bloco só existe durante o resumo do guia
                        // (wrapUpSuggestionsVisible) — é o passo que pede
                        // pra arrastar categorias, travar aqui bloquearia a
                        // própria ação que o card está ensinando.
                        locked={false}
                      />
                    </WrapUpCategorySuggestions>
                  ) : (
                    <CategoryBar
                      isInlineEditMode
                      editingProfileId={editingProfileId}
                      onCreateCategory={
                        // No passo guiado de calendários segue o fluxo antigo:
                        // o card do guia e os ganchos do onboarding dependem dele.
                        highlightCreate
                          ? () => onCreateCategory()
                          : () => setDetail({ kind: "category-choice" })
                      }
                      onEditCategory={(categoryId) => setDetail({ kind: "category", id: categoryId })}
                      highlightedCategoryId={highlightedCategoryId}
                      highlightedCategoryEffect={highlightedCategoryEffect}
                      highlightCreate={highlightCreate}
                      // Neste passo (calendar_instruction) o próprio guia
                      // manda usar o "+" — travar aqui bloquearia a ação que
                      // ele está pedindo.
                      locked={guidedOnboardingActive && !highlightCreate}
                    />
                  )}
                  {highlightCreate && !categoryCreateOpen && onDismissGuidedSelection ? (
                    <GuidedToolbarNoticeCard
                      notice={guidedToolbarNotice!}
                      onClose={onDismissGuidedSelection}
                      placement="viewport"
                      portaled
                      anchorSelector="[data-onboarding-calendar-control]"
                      anchorPlacement="below-center"
                    />
                  ) : null}
                </section>
              </>
            ) : (
              <section>
                <HabitEditList
                  habits={presentedHabits}
                  selectedHabit={selectedHabit}
                  creationDisabled={habitCreationDisabled}
                  locked={guidedOnboardingActive}
                  onSelectHabit={selectHabit}
                  onRequestCreate={requestCreateHabit}
                  onEditHabit={requestEditHabit}
                  onReorderHabits={reorderHabits}
                />
              </section>
            )}
            </ViewSwap>
            {!viewIsDetail && archivedCount > 0 ? (
              <section className="mt-6 border-t border-border/55 pt-3">
                <button
                  type="button"
                  aria-expanded={archivedOpen}
                  aria-controls="organize-archived-items"
                  onClick={() => setArchivedOpen((current) => !current)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="inline-flex items-center gap-2">
                    <Archive className="size-4" aria-hidden="true" />
                    Arquivados
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-xs tabular-nums">
                      {archivedCount}
                    </span>
                  </span>
                  <ChevronDown
                    className={`size-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${archivedOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                <CollapsibleControlRegion
                  id="organize-archived-items"
                  expanded={archivedOpen}
                >
                  <div className="pt-2">
                    <ArchivedItemsSection />
                  </div>
                </CollapsibleControlRegion>
              </section>
            ) : null}
            {wrapUpCard && !wrapUpSuggestionsVisible ? (
              // Com as sugestões na tela o card vive entre elas e o ano (ver
              // wrapUpSuggestionsVisible acima). Fora disso — na aba Hábitos,
              // por exemplo — ele continua aqui, no fim do painel: é o resumo
              // do guia inteiro, não de uma aba só, e trocar de aba não pode
              // fazer o card sumir.
              <div className="mt-4">{wrapUpCard}</div>
            ) : null}
          </div>
        </div>
      </DialogContent>

      <ProUpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        reason="habits"
        onRequireAuth={onRequireAuth}
      />
    </Dialog>
  );
}
