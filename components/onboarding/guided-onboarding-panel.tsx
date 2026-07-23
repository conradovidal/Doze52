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
        title: "Pense em alguém que faz parte da sua história.",
        description:
          "Escolha no calendário um aniversário que já passou neste ano.",
        prompt: "De quem é esse dia?",
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
          ? "Comece por um dia que merece ser lembrado."
          : "Comece por uma data profissional importante que já passou.",
      description: "Escolha no calendário quando isso aconteceu.",
      prompt: "O que aconteceu nessa data?",
      placeholder: "Ex.: Uma conquista importante",
    };
  }

  if (isBirthday) {
    return {
      title: "Agora celebre alguém que ainda vai completar o ano.",
      description:
        "Escolha um próximo aniversário que você não quer deixar passar.",
      prompt: "De quem é esse dia?",
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
          ? "Agora escolha algo bom que ainda está por vir."
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
        title: "Que viagem ainda mora na sua memória?",
        description: "Marque do primeiro ao último dia dessa história.",
        prompt: "Que viagem foi essa?",
        placeholder: "Ex.: Viagem em família",
      };
    }
    if (isProject) {
      return {
        title: "Agora adicione o período do seu último projeto.",
        description: "Selecione desde quando ele começou até quando terminou.",
        prompt: "Qual foi esse projeto?",
        placeholder: "Ex.: Projeto concluído",
      };
    }
    return {
      title:
        context === "personal"
          ? "Escolha um período que deixou marca no seu ano."
          : "Adicione um período profissional que já passou.",
      description: "Selecione o primeiro e o último dia desse período.",
      prompt: "O que ocupou esse período?",
      placeholder: "Ex.: Um período importante",
    };
  }

  if (isTravel) {
    return {
      title: "Que próxima viagem já merece espaço?",
      description: "Marque do primeiro ao último dia que você está planejando.",
      prompt: "Para onde você vai?",
      placeholder: "Ex.: Próximas férias",
    };
  }
  if (isProject) {
    return {
      title: "Agora adicione seu projeto atual ou o próximo.",
      description: "Selecione desde o início até a conclusão esperada.",
      prompt: "Qual é esse projeto?",
      placeholder: "Ex.: Reestruturação comercial",
    };
  }
  return {
    title:
      context === "personal"
        ? "Agora abra espaço para algo que você espera viver."
        : "Agora adicione o próximo período profissional importante.",
    description: "Selecione o primeiro e o último dia planejado.",
    prompt: "O que vai ocupar esse período?",
    placeholder: "Ex.: Um próximo período",
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
  const context = state.context ?? "personal";
  if (state.step === "date_instruction") {
    const copy = getDateCopy(
      context,
      state.dateCategoryId,
      state.dateItemsCreated ?? 0
    );
    return {
      mode: "date",
      title: copy.title,
      instruction: copy.description,
    };
  }
  if (state.step !== "period_instruction") return null;
  const copy = getPeriodCopy(
    context,
    state.periodCategoryId,
    state.periodItemsCreated ?? 0
  );
  return {
    mode: "period",
    title: copy.title,
    instruction:
      isMobile && mobileRangeStart
        ? `Início selecionado em ${formatDate(mobileRangeStart)}. Agora selecione o último dia.`
        : isMobile
          ? `${copy.description} Toque no primeiro e depois no último dia.`
          : `${copy.description} Clique, segure e arraste do início ao fim.`,
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
                    ? intent === "date"
                      ? "Um jeito afetivo de começar a contar o seu ano."
                      : "Para enxergar o espaço que descanso e descobertas ocupam."
                    : "Para tudo que importa e merece um nome só seu."}
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
              onClick={() => onComplete("explore")}
            >
              Explorar meu ano
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onComplete("category")}
            >
              <Plus /> Continuar personalizando
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
      className="fixed top-[calc(env(safe-area-inset-top,0px)+4.6rem)] left-1/2 z-50 w-[min(42rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-[1.5rem] border border-foreground/15 bg-card/98 p-4.5 text-card-foreground shadow-[0_28px_90px_-28px_rgba(15,23,42,0.68)] backdrop-blur-xl animate-in fade-in-0 duration-200 motion-reduce:animate-none sm:p-5 md:top-1/2 md:w-[23rem] md:-translate-y-1/2"
    >
      {header}
      {content}
    </section>
  );
}
