"use client";

import * as React from "react";
import {
  BriefcaseBusiness,
  CalendarDays,
  Check,
  Flag,
  Gift,
  GripHorizontal,
  Layers3,
  MousePointer2,
  Plane,
  Plus,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ONBOARDING_CATEGORY_IDS,
  getOnboardingCategoryDefinition,
} from "@/lib/store";
import type {
  GuidedOnboardingState,
  OnboardingCategoryChoice,
  OnboardingContext,
} from "@/lib/onboarding";

export type GuidedCalendarDraft = {
  startDate: string;
  endDate: string;
};

type GuidedOnboardingPanelProps = {
  state: GuidedOnboardingState;
  draft: GuidedCalendarDraft | null;
  isMobile: boolean;
  mobileRangeStart?: string | null;
  onClose: () => void;
  onDismiss: () => void;
  onConfigureContext: (context: OnboardingContext) => void;
  onContinueFromProfile: () => void;
  onChooseCategory: (
    intent: "date" | "period",
    choice: OnboardingCategoryChoice
  ) => void;
  onChangeDraft: (draft: GuidedCalendarDraft) => void;
  onSaveDraft: (title: string) => void;
  onComplete: (next: "explore" | "category") => void;
};

const CONTEXT_OPTIONS = [
  {
    value: "personal" as const,
    title: "Pessoal",
    description: "Família, viagens e momentos importantes.",
    icon: UserRound,
  },
  {
    value: "work" as const,
    title: "Profissional",
    description: "Entregas, projetos e marcos de trabalho.",
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
        title: "Comece por um aniversário importante que já passou.",
        description:
          "Clique no dia do aniversário de alguém da sua família ou de uma pessoa próxima.",
        prompt: "De quem é esse aniversário?",
        placeholder: "Ex.: Aniversário da mãe",
      };
    }
    if (isDelivery) {
      return {
        title: "Comece pela sua última entrega importante.",
        description: "Clique no dia em que essa entrega foi concluída.",
        prompt: "O que você entregou?",
        placeholder: "Ex.: Lançamento do produto",
      };
    }
    return {
      title:
        context === "personal"
          ? "Comece por uma data importante que já passou."
          : "Comece por uma data profissional importante que já passou.",
      description: "Clique no dia em que isso aconteceu.",
      prompt: "O que aconteceu nessa data?",
      placeholder: "Ex.: Uma conquista importante",
    };
  }

  if (isBirthday) {
    return {
      title: "Agora marque o próximo aniversário importante.",
      description:
        "Pode ser de um familiar ou de outra pessoa que você não quer esquecer.",
      prompt: "De quem é esse aniversário?",
      placeholder: "Ex.: Aniversário do pai",
    };
  }
  if (isDelivery) {
    return {
      title: "Agora marque a próxima entrega importante.",
      description: "Clique no dia em que ela deve acontecer.",
      prompt: "O que você vai entregar?",
      placeholder: "Ex.: Próximo lançamento",
    };
  }
  return {
    title:
      context === "personal"
        ? "Agora marque a próxima data importante."
        : "Agora marque a próxima data profissional importante.",
    description: "Clique no dia em que isso deve acontecer.",
    prompt: "O que vai acontecer nessa data?",
    placeholder: "Ex.: Um próximo marco",
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
        title: "Agora cadastre suas últimas férias ou viagem.",
        description: "Selecione do primeiro ao último dia desse período.",
        prompt: "Que período foi esse?",
        placeholder: "Ex.: Viagem em família",
      };
    }
    if (isProject) {
      return {
        title: "Agora cadastre o período do seu último projeto.",
        description: "Selecione desde quando ele começou até quando terminou.",
        prompt: "Qual foi esse projeto?",
        placeholder: "Ex.: Projeto concluído",
      };
    }
    return {
      title:
        context === "personal"
          ? "Cadastre um período importante que já passou."
          : "Cadastre um período profissional que já passou.",
      description: "Selecione o primeiro e o último dia desse período.",
      prompt: "O que ocupou esse período?",
      placeholder: "Ex.: Um período importante",
    };
  }

  if (isTravel) {
    return {
      title: "Agora cadastre suas próximas férias ou viagem.",
      description: "Selecione do primeiro ao último dia planejado.",
      prompt: "Que período será esse?",
      placeholder: "Ex.: Próximas férias",
    };
  }
  if (isProject) {
    return {
      title: "Agora cadastre seu projeto atual ou o próximo.",
      description: "Selecione desde o início até a conclusão esperada.",
      prompt: "Qual é esse projeto?",
      placeholder: "Ex.: Reestruturação comercial",
    };
  }
  return {
    title:
      context === "personal"
        ? "Agora cadastre o próximo período importante."
        : "Agora cadastre o próximo período profissional importante.",
    description: "Selecione o primeiro e o último dia planejado.",
    prompt: "O que vai ocupar esse período?",
    placeholder: "Ex.: Um próximo período",
  };
};

function InteractionHint({
  period,
  isMobile,
}: {
  period: boolean;
  isMobile: boolean;
}) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/18 bg-primary/7 px-3 py-2 text-xs font-medium text-primary">
      {period ? (
        <GripHorizontal
          className="size-4 motion-safe:animate-pulse"
          aria-hidden="true"
        />
      ) : (
        <MousePointer2
          className="size-4 motion-safe:animate-bounce"
          aria-hidden="true"
        />
      )}
      {period
        ? isMobile
          ? "Toque no início e depois no fim do período."
          : "Clique, segure e arraste do início ao fim."
        : "Escolha um dia diretamente no calendário."}
    </div>
  );
}

export function GuidedOnboardingPanel({
  state,
  draft,
  isMobile,
  mobileRangeStart,
  onClose,
  onDismiss,
  onConfigureContext,
  onContinueFromProfile,
  onChooseCategory,
  onChangeDraft,
  onSaveDraft,
  onComplete,
}: GuidedOnboardingPanelProps) {
  const [title, setTitle] = React.useState("");
  const [showExternalDates, setShowExternalDates] = React.useState(false);
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
            ? 4
            : 5;

  React.useEffect(() => {
    setTitle("");
    setShowExternalDates(false);
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
          Passo {progressStep} de 5
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="rounded-full"
        aria-label="Fechar ajuda por agora"
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

    return (
      <div className="mt-4 grid gap-2">
        {[
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
        ].map((option) => {
          const Icon = option.icon;
          return (
            <button
              key={option.choice}
              type="button"
              className="flex items-center gap-3 rounded-2xl border border-border bg-background/80 p-3 text-left transition hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              onClick={() => onChooseCategory(intent, option.choice)}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/8 text-primary">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">
                  {option.definition.name}
                </span>
                <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">
                  {option.choice === "specific"
                    ? "Nossa sugestão para começar."
                    : "Uma opção mais aberta para o seu contexto."}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  const content = (() => {
    if (state.step === "context_selection") {
      return (
        <>
          <h2 className="mt-4 text-xl font-semibold tracking-[-0.025em]">
            Vamos criar o seu primeiro perfil.
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Onde uma visão do ano inteiro ajudaria mais?
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
            Este é o perfil que vai organizar essa parte do seu ano.
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Agora vamos criar as categorias dentro dele, uma de cada vez.
          </p>
          <Button
            type="button"
            variant="premium"
            className="mt-4 w-full"
            onClick={onContinueFromProfile}
          >
            Criar primeira categoria
          </Button>
        </>
      );
    }

    if (state.step === "date_category_selection") {
      return (
        <>
          <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em]">
            Qual categoria de datas você quer criar primeiro?
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Nossa sugestão é começar por eventos que acontecem em um único dia.
          </p>
          {renderCategoryChoices("date")}
        </>
      );
    }

    if (state.step === "period_category_selection") {
      return (
        <>
          <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em]">
            Agora crie uma categoria para períodos maiores.
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Ela vai reunir coisas que ocupam vários dias do seu ano.
          </p>
          {renderCategoryChoices("period")}
        </>
      );
    }

    if (state.step === "date_instruction" || state.step === "period_instruction") {
      const period = state.step === "period_instruction";
      const copy = period ? periodCopy : dateCopy;
      return (
        <>
          <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em]">
            {copy.title}
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {copy.description}
          </p>
          {!period &&
          state.dateCategoryId === ONBOARDING_CATEGORY_IDS.birthday ? (
            <p className="mt-2 text-xs font-medium text-primary/90">
              Recorrência anual ativada nos aniversários.
            </p>
          ) : null}
          {mobileRangeStart && period ? (
            <p className="mt-3 rounded-xl bg-primary/8 px-3 py-2 text-xs font-medium text-primary">
              Início escolhido em {formatDate(mobileRangeStart)}. Agora toque no
              dia final.
            </p>
          ) : (
            <InteractionHint period={period} isMobile={isMobile} />
          )}
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
            Seu ano já começou a ganhar forma.
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Você criou duas categorias e já sabe adicionar tanto datas quanto
            períodos.
          </p>
          <div className="mt-4 grid gap-2">
            <Button
              type="button"
              variant="premium"
              onClick={() => onComplete("explore")}
            >
              Continuar explorando
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onComplete("category")}
            >
              <Plus /> Criar uma nova categoria
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
      aria-label="Guia inicial do Doze52"
      aria-live="polite"
      className="fixed top-[calc(env(safe-area-inset-top,0px)+4.6rem)] left-1/2 z-50 w-[min(42rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-[1.5rem] border border-foreground/15 bg-card/98 p-4.5 text-card-foreground shadow-[0_28px_90px_-28px_rgba(15,23,42,0.68)] backdrop-blur-xl animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none sm:p-5 md:left-4 md:w-[23rem] md:translate-x-0"
    >
      {header}
      {content}
      <div className="mt-4 border-t border-border/65 pt-3">
        <button
          type="button"
          className="block text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          onClick={onDismiss}
        >
          Dispensar ajuda
        </button>
      </div>
    </section>
  );
}
