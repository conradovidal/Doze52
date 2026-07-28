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

const getDefaultChoiceColors = (
  context: OnboardingContext,
  intent: "date" | "period"
): Record<OnboardingCategoryChoice, string> => ({
  specific: getOnboardingCategoryDefinition(context, intent, "specific").color,
  generic: getOnboardingCategoryDefinition(context, intent, "generic").color,
});

export type GuidedCalendarDraft = {
  startDate: string;
  endDate: string;
};

type GuidedOnboardingPanelProps = {
  state: GuidedOnboardingState;
  draft: GuidedCalendarDraft | null;
  onClose: () => void;
  onConfigureContext: (context: OnboardingContext) => void;
  onChooseCategory: (
    intent: "date" | "period",
    choice: OnboardingCategoryChoice,
    color: string
  ) => void;
  onChangeDraft: (draft: GuidedCalendarDraft) => void;
  onSaveDraft: (title: string) => void;
};

const CONTEXT_OPTIONS = [
  {
    value: "personal" as const,
    title: "Pessoal",
    description: "Para cuidar de relações, planos e momentos da sua vida.",
    icon: UserRound,
  },
  {
    value: "work" as const,
    title: "Profissional",
    description:
      "Para acompanhar entregas, compromissos e conquistas do seu trabalho.",
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
        title: "Adicione o aniversário de alguém importante.",
        description: "Escolha o dia no calendário.",
        prompt: "De quem é esse aniversário?",
        placeholder: "Ex.: Aniversário da mãe",
      };
    }
    if (isDelivery) {
      return {
        title: "Adicione uma entrega importante.",
        description: "Escolha o dia dessa entrega.",
        prompt: "Qual é essa entrega?",
        placeholder: "Ex.: Lançamento do produto",
      };
    }
    return {
      title:
        context === "personal"
          ? "Adicione uma data importante para você."
          : "Adicione uma data importante do seu trabalho.",
      description: "Escolha o dia no calendário.",
      prompt:
        context === "personal"
          ? "O que torna essa data importante?"
          : "O que essa data representa para o seu trabalho?",
      placeholder: "Ex.: Uma conquista importante",
    };
  }

  if (isBirthday) {
    return {
      title: "Agora adicione o aniversário de outra pessoa importante.",
      description: "Escolha outro dia no calendário.",
      prompt: "De quem é esse aniversário?",
      placeholder: "Ex.: Aniversário do pai",
    };
  }
  if (isDelivery) {
    return {
      title: "Agora adicione outra entrega importante.",
      description: "Escolha o dia dessa entrega.",
      prompt: "Qual é essa entrega?",
      placeholder: "Ex.: Lançamento do produto",
    };
  }
  return {
    title:
      context === "personal"
        ? "Agora adicione outra data importante."
        : "Agora adicione outra data importante do seu trabalho.",
    description: "Escolha outro dia no calendário.",
    prompt:
      context === "personal"
        ? "O que torna essa data importante?"
        : "O que essa data representa para o seu trabalho?",
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
        title: "Adicione uma viagem ou um período de férias.",
        description: "Marque do primeiro ao último dia.",
        prompt: "Que viagem ou férias são essas?",
        placeholder: "Ex.: Viagem em família",
      };
    }
    if (isProject) {
      return {
        title: "Adicione um projeto importante.",
        description: "Selecione o primeiro e o último dia.",
        prompt: "Qual é esse projeto?",
        placeholder: "Ex.: Projeto concluído",
      };
    }
    return {
      title:
        context === "personal"
          ? "Adicione um período importante para você."
          : "Adicione um período importante do seu trabalho.",
      description: "Selecione o primeiro e o último dia desse período.",
      prompt:
        context === "personal"
          ? "O que torna esse período importante?"
          : "O que esse período representa no seu trabalho?",
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
        : "Agora adicione outro período importante do seu trabalho.",
    description: "Selecione o primeiro e o último dia.",
    prompt:
      context === "personal"
        ? "O que torna esse período importante?"
        : "O que esse período representa no seu trabalho?",
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
    const copy = getDateCopy(
      state.context ?? "personal",
      state.dateCategoryId,
      state.dateItemsCreated ?? 0
    );
    return {
      mode: "date",
      title: copy.title,
      instruction: isMobile ? "Toque no dia." : "Clique no dia.",
    };
  }
  if (state.step !== "period_instruction") return null;
  const copy = getPeriodCopy(
    state.context ?? "personal",
    state.periodCategoryId,
    state.periodItemsCreated ?? 0
  );
  return {
    mode: "period",
    title:
      isMobile && mobileRangeStart
        ? "Agora escolha o último dia."
        : copy.title,
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
  onChooseCategory,
  onChangeDraft,
  onSaveDraft,
}: GuidedOnboardingPanelProps) {
  const [title, setTitle] = React.useState("");
  const [showExternalDates, setShowExternalDates] = React.useState(false);
  const [selectedCategoryChoice, setSelectedCategoryChoice] =
    React.useState<OnboardingCategoryChoice | null>(null);
  const context = state.context ?? "personal";
  const [categoryColors, setCategoryColors] = React.useState<
    Record<OnboardingCategoryChoice, string>
  >(() => getDefaultChoiceColors(context, "date"));
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
      : state.step.startsWith("date")
        ? 2
        : state.step.startsWith("period")
          ? 3
          : 4;

  React.useEffect(() => {
    setTitle("");
    setShowExternalDates(false);
    setSelectedCategoryChoice(null);
    if (state.step === "date_category_selection") {
      setCategoryColors(getDefaultChoiceColors(context, "date"));
    } else if (state.step === "period_category_selection") {
      setCategoryColors(getDefaultChoiceColors(context, "period"));
    }
  }, [context, state.step]);

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
    const selectedCategoryColor = selectedCategoryChoice
      ? categoryColors[selectedCategoryChoice]
      : null;

    return (
      <div className="mt-4 grid gap-2">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = selectedCategoryChoice === option.choice;
          return (
            <button
              key={option.choice}
              type="button"
              data-onboarding-category-choice={option.choice}
              aria-pressed={selected}
              className={`flex items-center gap-3 rounded-2xl border bg-background/80 px-3 py-2.5 text-left transition hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                selected
                  ? "border-primary/50 ring-1 ring-primary/30"
                  : "border-border"
              }`}
              onClick={() => setSelectedCategoryChoice(option.choice)}
            >
              <span
                data-onboarding-category-color-indicator
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                style={{ backgroundColor: categoryColors[option.choice] }}
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
            disabled={!selectedCategoryChoice}
            onChange={(color) => {
              if (!selectedCategoryChoice) return;
              setCategoryColors((current) => ({
                ...current,
                [selectedCategoryChoice]: color,
              }));
            }}
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
            Criar categoria
          </Button>
        </div>
      </div>
    );
  };

  const content = (() => {
    if (state.step === "context_selection") {
      return (
        <>
          <h2 className="mt-4 max-w-[30rem] text-balance text-xl font-semibold tracking-[-0.025em]">
            Por qual contexto você quer começar?
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha onde começar a dar visibilidade ao que importa para você.
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

    if (state.step === "date_category_selection") {
      return (
        <>
          <h2 className="mt-4 max-w-[30rem] text-balance text-lg font-semibold tracking-[-0.02em]">
            O que você quer tornar visível primeiro?
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {context === "personal"
              ? "Seu contexto Pessoal está pronto. Comece pelo aniversário de alguém importante ou por uma data que você quer lembrar."
              : "Seu contexto Profissional está pronto. Comece por uma entrega ou por uma data importante do seu trabalho."}
          </p>
          {renderCategoryChoices("date")}
        </>
      );
    }

    if (state.step === "period_category_selection") {
      return (
        <>
          <h2 className="mt-4 max-w-[30rem] text-balance text-lg font-semibold tracking-[-0.02em]">
            Quais períodos você quer tornar visíveis?
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {context === "personal"
              ? "Férias, viagens e outros períodos também ajudam a contar a história do seu ano."
              : "Projetos e outros períodos importantes mostram como seu trabalho se distribui ao longo do ano."}
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

    return null;
  })();

  if (!content) return null;
  return (
    <section
      data-onboarding-panel
      data-guided-onboarding-step={state.step}
      aria-label="Guia inicial do Doze 52"
      aria-live="polite"
      className="inverse-product-surface fixed top-[calc(env(safe-area-inset-top,0px)+4.6rem)] left-1/2 z-50 max-h-[calc(100dvh-6rem)] w-[min(42rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-y-auto rounded-[1.5rem] border border-border bg-card p-4.5 text-card-foreground shadow-[0_30px_95px_-20px_rgba(15,23,42,0.82)] animate-in fade-in-0 duration-200 motion-reduce:animate-none sm:p-5 md:top-1/2 md:w-[23rem] md:-translate-y-1/2"
    >
      {header}
      {content}
    </section>
  );
}
