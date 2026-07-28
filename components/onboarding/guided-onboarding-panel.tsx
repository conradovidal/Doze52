"use client";

import * as React from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Flag,
  Gift,
  Layers3,
  Plane,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { CategoryColorPicker } from "@/components/category-color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { GuidedSelectionNotice } from "@/components/onboarding/guided-selection-notice";
import {
  ONBOARDING_CATEGORY_IDS,
  getOnboardingCategoryDefinition,
} from "@/lib/store";
import type {
  GuidedOnboardingState,
  OnboardingCategoryChoice,
  OnboardingContext,
} from "@/lib/onboarding";
import {
  CATEGORY_COLOR_BASE_AMBER,
  CATEGORY_COLOR_BASE_BLUE,
  CATEGORY_COLOR_BASE_CYAN,
  CATEGORY_COLOR_BASE_GRAPHITE,
  CATEGORY_COLOR_BASE_GREEN,
  CATEGORY_COLOR_BASE_ORANGE,
  CATEGORY_COLOR_BASE_RED,
  CATEGORY_COLOR_BASE_VIOLET,
} from "@/lib/category-palette";

const ONBOARDING_QUICK_COLORS = [
  CATEGORY_COLOR_BASE_AMBER,
  CATEGORY_COLOR_BASE_ORANGE,
  CATEGORY_COLOR_BASE_RED,
  CATEGORY_COLOR_BASE_VIOLET,
  CATEGORY_COLOR_BASE_BLUE,
  CATEGORY_COLOR_BASE_CYAN,
  CATEGORY_COLOR_BASE_GREEN,
  CATEGORY_COLOR_BASE_GRAPHITE,
] as const;

export type GuidedCalendarDraft = {
  startDate: string;
  endDate: string;
};

type GuidedOnboardingPanelProps = {
  state: GuidedOnboardingState;
  draft: GuidedCalendarDraft | null;
  onClose: () => void;
  onConfigureContext: (context: OnboardingContext) => void;
  onContinueFromProfile: () => void;
  onChooseCategory: (
    intent: "date" | "period",
    choice: OnboardingCategoryChoice,
    color: string
  ) => void;
  onChangeDraft: (draft: GuidedCalendarDraft) => void;
  onSaveDraft: (title: string) => void;
  onComplete: (next: "explore" | "category") => void;
};

const CONTEXT_OPTIONS = [
  {
    value: "personal" as const,
    title: "Pessoal",
    description: "Família, viagens e momentos que fazem o ano ser seu.",
    icon: UserRound,
  },
  {
    value: "work" as const,
    title: "Profissional",
    description: "Projetos, entregas e conquistas que movem o seu trabalho.",
    icon: BriefcaseBusiness,
  },
];

const formatDate = (value: string) => {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};

export type { GuidedSelectionNotice } from "@/components/onboarding/guided-selection-notice";

const getDateCopy = (
  context: OnboardingContext,
  categoryId: string | undefined,
  itemCount: number
) => {
  const isBirthday = categoryId === ONBOARDING_CATEGORY_IDS.birthday;
  const isDelivery = categoryId === ONBOARDING_CATEGORY_IDS.workDeliveries;

  if (itemCount === 0) {
    if (isBirthday) {
      return {
        title: "Adicione um aniversário importante.",
        description: "Escolha o dia no calendário.",
        prompt: "De quem é esse aniversário?",
        placeholder: "Ex.: Aniversário da mãe",
      };
    }
    if (isDelivery) {
      return {
        title: "Adicione uma entrega importante.",
        description: "Escolha o dia dessa entrega.",
        prompt: "O que você entregou?",
        placeholder: "Ex.: Lançamento do produto",
      };
    }
    return {
      title:
        context === "personal"
          ? "Adicione uma data importante."
          : "Adicione uma data profissional importante.",
      description: "Escolha o dia no calendário.",
      prompt: "O que torna essa data importante?",
      placeholder: "Ex.: Uma conquista importante",
    };
  }

  if (isBirthday) {
    return {
      title: "Agora adicione outro aniversário importante.",
      description: "Escolha outro dia no calendário.",
      prompt: "De quem é esse aniversário?",
      placeholder: "Ex.: Aniversário do pai",
    };
  }
  if (isDelivery) {
    return {
      title: "Agora adicione outra entrega importante.",
      description: "Escolha o dia dessa entrega.",
      prompt: "O que você vai entregar?",
      placeholder: "Ex.: Lançamento do produto",
    };
  }
  return {
    title:
      context === "personal"
        ? "Agora adicione outra data importante."
        : "Agora adicione outra data profissional importante.",
    description: "Escolha outro dia no calendário.",
    prompt: "O que torna essa data importante?",
    placeholder: "Ex.: Uma conquista importante",
  };
};

const getPeriodCopy = (
  context: OnboardingContext,
  categoryId: string | undefined,
  itemCount: number
) => {
  const isTravel = categoryId === ONBOARDING_CATEGORY_IDS.travel;
  const isProject = categoryId === ONBOARDING_CATEGORY_IDS.workTrips;

  if (itemCount === 0) {
    if (isTravel) {
      return {
        title: "Adicione uma viagem ou férias importantes.",
        description: "Marque do primeiro ao último dia.",
        prompt: "Que viagem foi essa?",
        placeholder: "Ex.: Viagem em família",
      };
    }
    if (isProject) {
      return {
        title: "Adicione um projeto importante.",
        description: "Selecione o primeiro e o último dia.",
        prompt: "Qual foi esse projeto?",
        placeholder: "Ex.: Projeto concluído",
      };
    }
    return {
      title:
        context === "personal"
          ? "Adicione um período importante."
          : "Adicione um período profissional importante.",
      description: "Selecione o primeiro e o último dia desse período.",
      prompt: "O que ocupou esse período?",
      placeholder: "Ex.: Um período importante",
    };
  }

  if (isTravel) {
    return {
      title: "Agora adicione outra viagem ou período de férias.",
      description: "Marque do primeiro ao último dia.",
      prompt: "Que viagem ou férias são essas?",
      placeholder: "Ex.: Férias em família",
    };
  }
  if (isProject) {
    return {
      title: "Agora adicione outro projeto importante.",
      description: "Selecione o primeiro e o último dia.",
      prompt: "Qual é esse projeto?",
      placeholder: "Ex.: Reestruturação comercial",
    };
  }
  return {
    title:
      context === "personal"
        ? "Agora adicione outro período importante."
        : "Agora adicione outro período profissional importante.",
    description: "Selecione o primeiro e o último dia.",
    prompt: "O que vai ocupar esse período?",
    placeholder: "Ex.: Um período importante",
  };
};

export const getGuidedSelectionNotice = ({
  state,
  isMobile,
  mobileRangeStart,
}: {
  state: GuidedOnboardingState;
  isMobile: boolean;
  mobileRangeStart?: string | null;
}): GuidedSelectionNotice | null => {
  if (state.step === "date_instruction") {
    const firstItem = (state.dateItemsCreated ?? 0) === 0;
    const isBirthday =
      state.dateCategoryId === ONBOARDING_CATEGORY_IDS.birthday;
    return {
      mode: "date",
      title: isBirthday
        ? firstItem
          ? "Adicione um aniversário importante."
          : "Agora adicione outro aniversário importante."
        : firstItem
          ? "Adicione uma data importante."
          : "Agora adicione outra data importante.",
      instruction: isMobile ? "Toque no dia." : "Clique no dia.",
    };
  }
  if (state.step !== "period_instruction") return null;
  const firstItem = (state.periodItemsCreated ?? 0) === 0;
  const isTravel = state.periodCategoryId === ONBOARDING_CATEGORY_IDS.travel;
  return {
    mode: "period",
    title:
      isMobile && mobileRangeStart
        ? "Agora escolha o último dia."
        : isTravel
          ? firstItem
            ? "Adicione uma viagem ou férias importantes."
            : "Agora adicione outra viagem ou período de férias."
          : firstItem
            ? "Adicione um período importante."
            : "Agora adicione outro período importante.",
    instruction:
      isMobile && mobileRangeStart
        ? `Início em ${formatDate(mobileRangeStart)}.`
        : isMobile
          ? "Toque no primeiro e no último dia."
          : "Clique e arraste do início ao fim.",
  };
};

export function GuidedOnboardingPanel({
  state,
  draft,
  onClose,
  onConfigureContext,
  onContinueFromProfile,
  onChooseCategory,
  onChangeDraft,
  onSaveDraft,
  onComplete,
}: GuidedOnboardingPanelProps) {
  const [title, setTitle] = React.useState("");
  const [showExternalDates, setShowExternalDates] = React.useState(false);
  const [selectedCategoryChoice, setSelectedCategoryChoice] =
    React.useState<OnboardingCategoryChoice | null>(null);
  const [selectedCategoryColor, setSelectedCategoryColor] =
    React.useState<string | null>(null);
  const context = state.context ?? "personal";
  const dateItemsCreated = state.dateItemsCreated ?? 0;
  const periodItemsCreated = state.periodItemsCreated ?? 0;
  const dateCopy = getDateCopy(
    context,
    state.dateCategoryId,
    dateItemsCreated
  );
  const periodCopy = getPeriodCopy(
    context,
    state.periodCategoryId,
    periodItemsCreated
  );
  const progressStep =
    state.step === "context_selection"
      ? 1
      : state.step === "profile_reveal"
        ? 2
        : state.step.startsWith("date")
          ? 3
          : state.step.startsWith("period")
            ? 5
            : state.step === "completion_choice"
              ? 7
              : 6;

  React.useEffect(() => {
    setTitle("");
    setShowExternalDates(false);
    setSelectedCategoryChoice(null);
    setSelectedCategoryColor(null);
  }, [state.step]);

  const header = (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <CalendarDays className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
          Monte o seu ano
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Passo {progressStep} de 7
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="rounded-full"
        aria-label="Encerrar guia inicial"
        onClick={onClose}
      >
        <X />
      </Button>
    </div>
  );

  const renderCategoryChoices = (intent: "date" | "period") => {
    const specific = getOnboardingCategoryDefinition(
      context,
      intent,
      "specific"
    );
    const generic = getOnboardingCategoryDefinition(
      context,
      intent,
      "generic"
    );
    const SpecificIcon =
      intent === "date"
        ? context === "personal"
          ? Gift
          : Flag
        : context === "personal"
          ? Plane
          : Layers3;

    const options = [
      {
        choice: "specific" as const,
        definition: specific,
        icon: SpecificIcon,
      },
      {
        choice: "generic" as const,
        definition: generic,
        icon: CalendarDays,
      },
    ];
    const selectedOption =
      options.find((option) => option.choice === selectedCategoryChoice) ?? null;

    return (
      <div className="mt-4 grid gap-2">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = selectedCategoryChoice === option.choice;
          return (
            <button
              key={option.choice}
              type="button"
              aria-pressed={selected}
              className={`flex items-center gap-3 rounded-2xl border bg-background/80 p-3 text-left transition hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                selected
                  ? "border-primary/50 ring-1 ring-primary/30"
                  : "border-border"
              }`}
              onClick={() => {
                setSelectedCategoryChoice(option.choice);
                setSelectedCategoryColor(
                  (currentColor) => currentColor ?? option.definition.color
                );
              }}
            >
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                style={{ backgroundColor: option.definition.color }}
              >
                {selected ? (
                  <Check className="size-4" strokeWidth={3} aria-hidden="true" />
                ) : (
                  <Icon className="size-4" aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {option.definition.name}
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                  {option.choice === "specific"
                    ? intent === "date"
                      ? "Um jeito afetivo de começar a contar o seu ano."
                      : "Para enxergar o espaço que descanso e descobertas ocupam."
                    : "Para tudo que importa e merece um nome só seu."}
                </span>
              </span>
            </button>
          );
        })}
        <div className="mt-2 rounded-2xl border border-border/70 bg-background/65 p-3">
          <p className="mb-2.5 text-sm font-semibold">
            {selectedOption
              ? `Cor de ${selectedOption.definition.name}`
              : "Escolha uma categoria e uma cor"}
          </p>
          <CategoryColorPicker
            compact
            value={selectedCategoryColor}
            colors={ONBOARDING_QUICK_COLORS}
            onChange={setSelectedCategoryColor}
            ariaLabel={
              selectedOption
                ? `Cor de ${selectedOption.definition.name}`
                : "Cor da nova categoria"
            }
          />
          <Button
            type="button"
            variant="premium"
            className="mt-4 w-full"
            disabled={!selectedOption || !selectedCategoryColor}
            onClick={() => {
              if (!selectedOption || !selectedCategoryColor) return;
              onChooseCategory(
                intent,
                selectedOption.choice,
                selectedCategoryColor
              );
            }}
          >
            Criar esta categoria
          </Button>
        </div>
      </div>
    );
  };

  const content = (() => {
    if (state.step === "context_selection") {
      return (
        <>
          <h2 className="mt-4 text-xl font-semibold tracking-[-0.025em]">
            Por onde o seu ano começa?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            O ano da Marina está ao fundo só para mostrar o que ganha forma
            quando tudo importante ocupa o mesmo lugar. Escolha seu primeiro
            contexto para começar o seu.
          </p>
          <div className="mt-4 grid gap-2">
            {CONTEXT_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-background/80 p-3 text-left transition hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  onClick={() => onConfigureContext(option.value)}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {option.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </>
      );
    }

    if (state.step === "profile_reveal") {
      return (
        <>
          <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em]">
            Pronto. Agora este ano é seu.
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Seu primeiro contexto já está no lugar. Vamos dar uma primeira cor
            ao que importa?
          </p>
          <Button
            type="button"
            variant="premium"
            className="mt-4 w-full"
            onClick={onContinueFromProfile}
          >
            Escolher primeira categoria
          </Button>
        </>
      );
    }

    if (state.step === "date_category_selection") {
      return (
        <>
          <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em]">
            Que tipo de dia merece aparecer primeiro?
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Comece por uma categoria que ajude você a reconhecer esses momentos
            num olhar.
          </p>
          {renderCategoryChoices("date")}
        </>
      );
    }

    if (state.step === "period_category_selection") {
      return (
        <>
          <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em]">
            Agora reserve espaço para algo que dura mais de um dia.
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Férias, viagens e projetos contam outra história quando você
            enxerga o começo e o fim.
          </p>
          {renderCategoryChoices("period")}
        </>
      );
    }

    if (
      (state.step === "date_details" || state.step === "period_details") &&
      draft
    ) {
      const period = state.step === "period_details";
      const copy = period ? periodCopy : dateCopy;
      return (
        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveDraft(title);
          }}
        >
          <div>
            <h2 className="text-lg font-semibold">{copy.prompt}</h2>
            <p className="mt-1 text-xs font-medium text-primary">
              {draft.startDate === draft.endDate
                ? formatDate(draft.startDate)
                : `${formatDate(draft.startDate)} — ${formatDate(draft.endDate)}`}
            </p>
          </div>
          <Input
            autoFocus
            aria-label={period ? "Nome do período" : "Nome da data"}
            maxLength={120}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={copy.placeholder}
            className="h-10 rounded-xl"
          />
          {!period &&
          state.dateCategoryId === ONBOARDING_CATEGORY_IDS.birthday ? (
            <p className="text-xs font-medium text-primary/90">
              Recorrência anual ativada nos aniversários.
            </p>
          ) : null}
          {period && context === "work" ? (
            <div>
              <button
                type="button"
                className="text-xs text-muted-foreground underline-offset-4 hover:underline"
                onClick={() =>
                  setShowExternalDates((current) => !current)
                }
              >
                Usar datas fora deste ano
              </button>
              {showExternalDates ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    aria-label="Início do projeto"
                    value={draft.startDate}
                    onChange={(event) => {
                      const startDate = event.target.value;
                      onChangeDraft({
                        startDate,
                        endDate:
                          draft.endDate < startDate
                            ? startDate
                            : draft.endDate,
                      });
                    }}
                  />
                  <Input
                    type="date"
                    aria-label="Fim esperado do projeto"
                    min={draft.startDate}
                    value={draft.endDate}
                    onChange={(event) =>
                      onChangeDraft({
                        ...draft,
                        endDate: event.target.value,
                      })
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          <Button
            type="submit"
            variant="premium"
            disabled={!title.trim()}
          >
            <Check /> Salvar
          </Button>
        </form>
      );
    }

    if (state.step === "completion_choice") {
      return (
        <>
          <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em]">
            Agora o seu ano começa a contar uma história.
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Datas e períodos ganharam cor, espaço e significado. Daqui em
            diante, cada escolha deixa essa visão mais sua.
          </p>
          <div className="mt-4 grid gap-2">
            <Button
              type="button"
              variant="premium"
              onClick={() => onComplete("category")}
            >
              <Plus /> Criar outra categoria
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onComplete("explore")}
            >
              Explorar meu ano
            </Button>
          </div>
        </>
      );
    }

    return null;
  })();

  if (!content) return null;
  return (
    <section
      data-onboarding-panel
      data-guided-onboarding-step={state.step}
      aria-label="Guia inicial do Doze 52"
      aria-live="polite"
      className="onboarding-inverse-surface fixed top-[calc(env(safe-area-inset-top,0px)+4.6rem)] left-1/2 z-50 max-h-[calc(100dvh-6rem)] w-[min(42rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-y-auto rounded-[1.5rem] border border-border bg-card p-4.5 text-card-foreground shadow-[0_30px_95px_-20px_rgba(15,23,42,0.82)] animate-in fade-in-0 duration-200 motion-reduce:animate-none sm:p-5 md:top-1/2 md:w-[23rem] md:-translate-y-1/2"
    >
      {header}
      {content}
    </section>
  );
}
