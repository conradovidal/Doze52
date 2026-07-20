"use client";

import * as React from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  GripHorizontal,
  MousePointer2,
  UserRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  GuidedOnboardingState,
  OnboardingContext,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export type GuidedCalendarDraft = {
  startDate: string;
  endDate: string;
};

type GuidedOnboardingPanelProps = {
  state: GuidedOnboardingState;
  draft: GuidedCalendarDraft | null;
  isAuthenticated: boolean;
  isSyncReady: boolean;
  isMobile: boolean;
  mobileRangeStart?: string | null;
  onClose: () => void;
  onDismiss: () => void;
  onConfigureContext: (context: OnboardingContext, customName?: string) => void;
  onCancelDraft: () => void;
  onChangeDraft: (draft: GuidedCalendarDraft) => void;
  onSaveDraft: (title: string) => void;
  onOpenMoreOptions: () => void;
  onAddAnotherDate: () => void;
  onContinueFromPreview: () => void;
  onOpenAuth: () => void;
  onContinueLocal: () => void;
};

const CONTEXT_OPTIONS = [
  {
    value: "personal" as const,
    title: "Pessoal",
    description: "Aniversários, férias, viagens e eventos.",
    icon: UserRound,
  },
  {
    value: "work" as const,
    title: "Trabalho",
    description: "Entregas, projetos e reuniões importantes.",
    icon: BriefcaseBusiness,
  },
  {
    value: "custom" as const,
    title: "Outro",
    description: "Crie um contexto com o nome que fizer sentido.",
    icon: CalendarDays,
  },
];

const CONTEXT_COPY = {
  personal: {
    dateTitle: "Comece por uma data que você não quer esquecer.",
    dateDescription: "Clique no dia do próximo aniversário importante para você.",
    datePrompt: "De quem é esse aniversário?",
    datePlaceholder: "Ex.: Aniversário da mãe",
    periodTitle: "Agora desenhe algo que ocupa mais de um dia.",
    periodDescription: "Clique no primeiro dia e arraste até o último de uma viagem ou férias.",
    periodPrompt: "Qual é essa viagem ou período de descanso?",
    periodPlaceholder: "Ex.: Férias em família",
  },
  work: {
    dateTitle: "Comece olhando para algo que você já realizou.",
    dateDescription: "Clique no dia da sua última entrega importante neste ano — ou da próxima já planejada.",
    datePrompt: "O que você entregou?",
    datePlaceholder: "Ex.: Lançamento do novo produto",
    periodTitle: "Agora coloque no ano o projeto em que você está trabalhando.",
    periodDescription: "Clique no dia em que ele começou e arraste até quando espera concluí-lo.",
    periodPrompt: "Qual é o nome desse projeto?",
    periodPlaceholder: "Ex.: Reestruturação comercial",
  },
  custom: {
    dateTitle: "Comece por uma data importante para esse contexto.",
    dateDescription: "Clique no dia em que algo importante acontece.",
    datePrompt: "O que acontece nessa data?",
    datePlaceholder: "Ex.: Um marco importante",
    periodTitle: "Agora desenhe um período importante para esse contexto.",
    periodDescription: "Clique no primeiro dia e arraste até o último.",
    periodPrompt: "O que ocupa esse período?",
    periodPlaceholder: "Ex.: Período de preparação",
  },
} as const;

const formatDate = (value: string) => {
  if (!value) return "";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
};

function InteractionHint({ period, isMobile }: { period: boolean; isMobile: boolean }) {
  return (
    <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/18 bg-primary/7 px-3 py-2 text-xs font-medium text-primary">
      {period ? (
        <GripHorizontal className="size-4 motion-safe:animate-pulse" aria-hidden="true" />
      ) : (
        <MousePointer2 className="size-4 motion-safe:animate-bounce" aria-hidden="true" />
      )}
      {period
        ? isMobile
          ? "Toque no início e depois no fim do período."
          : "Clique, segure e arraste sobre o calendário."
        : "Escolha um dia diretamente no calendário."}
    </div>
  );
}

function UseCasePreview({ context }: { context: OnboardingContext }) {
  const isWork = context === "work";
  const rows = isWork
    ? [
        { label: "Entregas", bars: ["left-[8%] w-[4%]", "left-[43%] w-[4%]", "left-[82%] w-[4%]"] },
        { label: "Projetos", bars: ["left-[14%] w-[28%]", "left-[55%] w-[34%]"] },
        { label: "Reuniões", bars: ["left-[26%] w-[3%]", "left-[68%] w-[3%]", "left-[92%] w-[3%]"] },
      ]
    : [
        { label: "Aniversários", bars: ["left-[10%] w-[3%]", "left-[39%] w-[3%]", "left-[76%] w-[3%]"] },
        { label: "Férias e viagens", bars: ["left-[18%] w-[18%]", "left-[62%] w-[22%]"] },
        { label: "Eventos", bars: ["left-[48%] w-[3%]", "left-[90%] w-[3%]"] },
      ];

  return (
    <div className="space-y-2 rounded-2xl border border-border/80 bg-muted/35 p-3" aria-label="Prévia de um ano preenchido">
      <div className="grid grid-cols-4 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        <span>Jan</span><span>Abr</span><span>Jul</span><span>Out</span>
      </div>
      {rows.map((row, rowIndex) => (
        <div key={row.label} className="grid grid-cols-[6.5rem_1fr] items-center gap-2">
          <span className="truncate text-[11px] font-medium text-foreground/72">{row.label}</span>
          <div className="relative h-5 overflow-hidden rounded-md bg-background/85">
            {row.bars.map((position) => (
              <span
                key={position}
                className={cn(
                  "absolute top-1 h-3 rounded-full",
                  position,
                  rowIndex === 0 ? "bg-amber-400" : rowIndex === 1 ? "bg-blue-500" : "bg-violet-500"
                )}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function GuidedOnboardingPanel({
  state,
  draft,
  isAuthenticated,
  isSyncReady,
  isMobile,
  mobileRangeStart,
  onClose,
  onDismiss,
  onConfigureContext,
  onCancelDraft,
  onChangeDraft,
  onSaveDraft,
  onOpenMoreOptions,
  onAddAnotherDate,
  onContinueFromPreview,
  onOpenAuth,
  onContinueLocal,
}: GuidedOnboardingPanelProps) {
  const [customName, setCustomName] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [showExternalDates, setShowExternalDates] = React.useState(false);
  const [customPreviewContext, setCustomPreviewContext] = React.useState<
    "personal" | "work"
  >("personal");
  const context = state.context ?? "personal";
  const copy = CONTEXT_COPY[context];

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
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">Desenhe o seu ano</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Passo {state.step === "context_selection" || state.step === "custom_profile" ? "1" : state.step.startsWith("date") ? "2" : state.step.startsWith("period") ? "3" : "4"} de 4</p>
      </div>
      <Button type="button" variant="ghost" size="icon-xs" className="rounded-full" aria-label="Fechar ajuda por agora" onClick={onClose}>
        <X />
      </Button>
    </div>
  );

  const content = (() => {
    if (state.step === "context_selection") {
      return (
        <>
          <h2 className="mt-4 text-xl font-semibold tracking-[-0.025em]">Onde uma visão do ano inteiro te ajudaria mais?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Escolha um contexto para começar. Você poderá criar outros perfis depois.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {CONTEXT_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button key={option.value} type="button" className="rounded-2xl border border-border bg-background/80 p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50" onClick={() => onConfigureContext(option.value)}>
                  <Icon className="size-4 text-primary" aria-hidden="true" />
                  <span className="mt-2 block text-sm font-semibold">{option.title}</span>
                  <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">{option.description}</span>
                </button>
              );
            })}
          </div>
        </>
      );
    }

    if (state.step === "custom_profile") {
      return (
        <>
          <h2 className="mt-4 text-lg font-semibold">Como você quer chamar esse perfil?</h2>
          <p className="mt-1 text-sm text-muted-foreground">Você poderá renomear as categorias depois.</p>
          <form className="mt-4 flex gap-2" onSubmit={(event) => { event.preventDefault(); onConfigureContext("custom", customName); }}>
            <Input autoFocus maxLength={40} aria-label="Nome do perfil" value={customName} onChange={(event) => setCustomName(event.target.value)} placeholder="Ex.: Estudos, família, saúde" className="h-10 rounded-xl" />
            <Button type="submit" variant="premium" disabled={!customName.trim()}>Continuar <ArrowRight /></Button>
          </form>
        </>
      );
    }

    if (state.step === "date_instruction" || state.step === "period_instruction") {
      const period = state.step === "period_instruction";
      return (
        <>
          <h2 className="mt-4 text-lg font-semibold tracking-[-0.02em]">{period ? copy.periodTitle : copy.dateTitle}</h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">{period ? copy.periodDescription : copy.dateDescription}</p>
          {mobileRangeStart && period ? <p className="mt-3 rounded-xl bg-primary/8 px-3 py-2 text-xs font-medium text-primary">Início escolhido em {formatDate(mobileRangeStart)}. Agora toque no dia final.</p> : <InteractionHint period={period} isMobile={isMobile} />}
          {period && state.firstDateCreatedAt ? <button type="button" className="mt-3 text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={onAddAnotherDate}>Adicionar outra data antes</button> : null}
        </>
      );
    }

    if ((state.step === "date_details" || state.step === "period_details") && draft) {
      const period = state.step === "period_details";
      return (
        <form className="mt-4 space-y-3" onSubmit={(event) => { event.preventDefault(); onSaveDraft(title); }}>
          <div>
            <h2 className="text-lg font-semibold">{period ? copy.periodPrompt : copy.datePrompt}</h2>
            <p className="mt-1 text-xs font-medium text-primary">{draft.startDate === draft.endDate ? formatDate(draft.startDate) : `${formatDate(draft.startDate)} — ${formatDate(draft.endDate)}`}</p>
          </div>
          <Input autoFocus aria-label={period ? "Nome do período" : "Nome da data"} maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder={period ? copy.periodPlaceholder : copy.datePlaceholder} className="h-10 rounded-xl" />
          {period && context === "work" ? (
            <div>
              <button type="button" className="text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={() => setShowExternalDates((current) => !current)}>Usar datas fora deste ano</button>
              {showExternalDates ? <div className="mt-2 grid grid-cols-2 gap-2"><Input type="date" aria-label="Início do projeto" value={draft.startDate} onChange={(event) => { const startDate = event.target.value; onChangeDraft({ startDate, endDate: draft.endDate < startDate ? startDate : draft.endDate }); }} /><Input type="date" aria-label="Fim esperado do projeto" min={draft.startDate} value={draft.endDate} onChange={(event) => onChangeDraft({ ...draft, endDate: event.target.value })} /></div> : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="premium" disabled={!title.trim()}><Check /> Salvar no meu ano</Button>
            <Button type="button" variant="outline" onClick={onCancelDraft}>{period ? "Selecionar novamente" : "Escolher outra data"}</Button>
            <Button type="button" variant="ghost" onClick={onOpenMoreOptions}>Mais opções</Button>
          </div>
        </form>
      );
    }

    if (state.step === "use_case_preview") {
      return (
        <>
          <h2 className="mt-4 text-lg font-semibold">Você já sabe desenhar momentos e períodos no seu ano.</h2>
          <p className="mt-1 text-sm text-muted-foreground">Veja como esse contexto pode ganhar forma quando mais coisas aparecem.</p>
          {context === "custom" ? (
            <div className="mt-3 flex gap-1 rounded-xl bg-muted/55 p-1" role="group" aria-label="Escolher exemplo de ano">
              {(["personal", "work"] as const).map((option) => (
                <button key={option} type="button" aria-pressed={customPreviewContext === option} className={cn("flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors", customPreviewContext === option ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} onClick={() => setCustomPreviewContext(option)}>
                  {option === "personal" ? "Exemplo pessoal" : "Exemplo de trabalho"}
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-3"><UseCasePreview context={context === "custom" ? customPreviewContext : context} /></div>
          <Button type="button" variant="premium" className="mt-4 w-full" onClick={onContinueFromPreview}>Voltar para o meu ano <ArrowRight /></Button>
        </>
      );
    }

    if (state.step === "save") {
      return (
        <>
          <h2 className="mt-4 text-lg font-semibold">{isAuthenticated ? "Seu ano já está ganhando forma." : "Quer guardar esta visão em outros dispositivos?"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{isAuthenticated ? (isSyncReady ? "Sua visão está guardada." : "Estamos sincronizando sua visão...") : "Você também pode continuar usando somente neste dispositivo."}</p>
          {!isAuthenticated ? <div className="mt-4 flex flex-col gap-2 sm:flex-row"><Button type="button" variant="premium" className="flex-1" onClick={onOpenAuth}>Criar minha conta</Button><Button type="button" variant="outline" onClick={onContinueLocal}>Continuar neste dispositivo</Button></div> : null}
        </>
      );
    }

    return null;
  })();

  if (!content) return null;
  return (
    <section data-guided-onboarding-step={state.step} aria-label="Guia inicial do Doze52" aria-live="polite" className="fixed top-[calc(env(safe-area-inset-top,0px)+4.6rem)] left-1/2 z-50 w-[min(42rem,calc(100vw-1.5rem))] -translate-x-1/2 rounded-[1.5rem] border border-foreground/15 bg-card/98 p-4.5 text-card-foreground shadow-[0_28px_90px_-28px_rgba(15,23,42,0.68)] backdrop-blur-xl animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none sm:p-5">
      {header}
      {content}
      <button type="button" className="mt-4 text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={onDismiss}>Dispensar ajuda</button>
    </section>
  );
}
