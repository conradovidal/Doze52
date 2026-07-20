"use client";

import * as React from "react";
import {
  ArrowRight,
  CalendarPlus,
  Clock3,
  Cloud,
  Eye,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  GuidedCreationIntent,
  GuidedOnboardingState,
  GuidedReflection,
} from "@/lib/onboarding";
import { cn } from "@/lib/utils";

const REFLECTION_OPTIONS: Array<{
  value: GuidedReflection;
  label: string;
}> = [
  { value: "busy_period", label: "Um período parece mais ocupado." },
  {
    value: "missing_priority",
    label: "Algo importante ainda está sem espaço.",
  },
  {
    value: "needs_context",
    label: "Ainda preciso colocar mais contexto.",
  },
  { value: "too_early", label: "Por enquanto, ainda é cedo para dizer." },
];

type GuidedOnboardingPanelProps = {
  state: GuidedOnboardingState;
  isAuthenticated: boolean;
  isSyncReady: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onAddItem: (intent: GuidedCreationIntent) => void;
  onSkipPeriod: () => void;
  onContinueToReflection: () => void;
  onReflectionChange: (reflection: GuidedReflection) => void;
  onContinueReflection: () => void;
  onSkipReflection: () => void;
  onOpenAuth: () => void;
  onContinueLocal: () => void;
};

export function GuidedOnboardingPanel({
  state,
  isAuthenticated,
  isSyncReady,
  onClose,
  onDismiss,
  onAddItem,
  onSkipPeriod,
  onContinueToReflection,
  onReflectionChange,
  onContinueReflection,
  onSkipReflection,
  onOpenAuth,
  onContinueLocal,
}: GuidedOnboardingPanelProps) {
  const content = (() => {
    switch (state.step) {
      case "intro":
        return {
          icon: CalendarPlus,
          eyebrow: "Comece pelo que importa",
          title: "Seu calendário organiza o dia. O Doze52 mostra o ano inteiro.",
          description: "Comece colocando algo que já importa para você.",
          body: (
            <Button
              type="button"
              variant="premium"
              className="w-full rounded-xl"
              onClick={() => onAddItem("dated_item")}
            >
              Adicionar algo importante
              <ArrowRight />
            </Button>
          ),
        };
      case "period_prompt":
        return {
          icon: Clock3,
          eyebrow: "Amplie o contexto",
          title: "Agora, existe algo que ocupa mais de um dia?",
          description:
            "Pode ser uma viagem, férias, projeto, curso ou uma fase importante.",
          body: (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="premium"
                className="flex-1 rounded-xl"
                onClick={() => onAddItem("period")}
              >
                Adicionar um período
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                onClick={onSkipPeriod}
              >
                Pular
              </Button>
            </div>
          ),
        };
      case "context_prompt":
        return {
          icon: Eye,
          eyebrow: "Complete o desenho",
          title: "Existe algo importante que ainda não aparece no teu ano?",
          description:
            "Se não houver uma data exata, use um período aproximado.",
          body: (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="premium"
                className="flex-1 rounded-xl"
                onClick={() => onAddItem("additional_context")}
              >
                Adicionar mais uma coisa
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                onClick={onContinueToReflection}
              >
                Ver meu ano
              </Button>
            </div>
          ),
        };
      case "reflection":
        return {
          icon: Eye,
          eyebrow: "Olhe o conjunto",
          title: "O que esse desenho inicial já deixa mais claro?",
          description: "A reflexão é opcional. Não existe resposta certa.",
          body: (
            <div className="space-y-3">
              <div className="grid gap-1.5" role="group" aria-label="Reflexão sobre o ano">
                {REFLECTION_OPTIONS.map((option) => {
                  const selected = state.reflection === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        selected
                          ? "border-primary/40 bg-primary/8 text-foreground"
                          : "border-border/70 bg-background/65 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                      )}
                      onClick={() => onReflectionChange(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="premium"
                  className="flex-1 rounded-xl"
                  disabled={!state.reflection}
                  onClick={onContinueReflection}
                >
                  Continuar usando
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="rounded-xl"
                  onClick={onSkipReflection}
                >
                  Pular reflexão
                </Button>
              </div>
            </div>
          ),
        };
      case "save":
        return {
          icon: Cloud,
          eyebrow: "Guarde esta visão",
          title: isAuthenticated
            ? "Estamos guardando a forma do teu ano."
            : "Quer guardar esta visão e acessar em outros dispositivos?",
          description: isAuthenticated
            ? "Assim que a sincronização terminar, você pode continuar de onde parou."
            : "A visão continua disponível neste dispositivo mesmo sem uma conta.",
          body: isAuthenticated ? (
            <div
              className="rounded-xl border border-border/70 bg-muted/35 px-3 py-2.5 text-sm text-muted-foreground"
              aria-live="polite"
            >
              {isSyncReady ? "Visão guardada." : "Sincronizando tua visão..."}
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="premium"
                className="flex-1 rounded-xl"
                onClick={onOpenAuth}
              >
                Criar minha conta
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl"
                onClick={onContinueLocal}
              >
                Continuar neste dispositivo
              </Button>
            </div>
          ),
        };
      case "completed":
      case "dismissed":
        return null;
    }
  })();

  if (!content) return null;
  const Icon = content.icon;

  return (
    <section
      data-guided-onboarding-step={state.step}
      aria-label="Guia inicial do Doze52"
      aria-live="polite"
      className="fixed right-3 bottom-[calc(env(safe-area-inset-bottom,0px)+5.75rem)] left-3 z-40 rounded-[1.4rem] border border-border/80 bg-background/96 p-4 shadow-[0_24px_70px_-34px_rgba(15,23,42,0.58)] backdrop-blur-md animate-in fade-in-0 slide-in-from-bottom-2 duration-200 motion-reduce:animate-none sm:right-auto sm:bottom-5 sm:left-5 sm:w-[23rem] sm:p-4.5"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/9 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {content.eyebrow}
          </p>
          <h2 className="text-[15px] font-semibold leading-5 tracking-[-0.015em] text-foreground">
            {content.title}
          </h2>
          <p className="text-[13px] leading-5 text-muted-foreground">
            {content.description}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="-mt-1 -mr-1 rounded-full text-muted-foreground"
          aria-label="Fechar ajuda por agora"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>

      <div className="mt-4">{content.body}</div>

      <button
        type="button"
        className="mt-3 text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        onClick={onDismiss}
      >
        Dispensar ajuda
      </button>
    </section>
  );
}
