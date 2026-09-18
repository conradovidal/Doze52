"use client";

import * as React from "react";
import {
  BookOpen,
  Droplets,
  Dumbbell,
  Footprints,
  Moon,
  Repeat,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatedProgress } from "@/components/ui/animated-progress";
import {
  CATEGORY_COLOR_BASE_AMBER,
  CATEGORY_COLOR_BASE_CORAL,
  CATEGORY_COLOR_BASE_INDIGO,
  CATEGORY_COLOR_BASE_TEAL,
  CATEGORY_COLOR_BASE_VIOLET,
  getCategoryColorToken,
} from "@/lib/category-palette";
import {
  getMobileHabitsOnboardingStepLabel,
  MOBILE_HABITS_ONBOARDING_TOTAL_STEPS,
} from "@/lib/mobile-habits-onboarding";

// Pilha de ícones só ilustrativa (nenhum hábito real tem ícone próprio hoje,
// só cor) — mesma técnica visual do card de abertura do desktop
// (CONTEXT_OPTIONS em guided-onboarding-panel.tsx): o propósito da tela fica
// legível antes de qualquer texto.
const SAMPLE_HABIT_ICONS = [
  { Icon: Dumbbell, color: CATEGORY_COLOR_BASE_TEAL },
  { Icon: BookOpen, color: CATEGORY_COLOR_BASE_INDIGO },
  { Icon: Droplets, color: CATEGORY_COLOR_BASE_CORAL },
  { Icon: Moon, color: CATEGORY_COLOR_BASE_VIOLET },
  { Icon: Footprints, color: CATEGORY_COLOR_BASE_AMBER },
] as const;

export function MobileOnboardingWelcomeCard({
  onContinue,
  onRequireAuth,
  onClose,
}: {
  onContinue: () => void;
  onRequireAuth?: () => void;
  onClose: () => void;
}) {
  const stepLabel = getMobileHabitsOnboardingStepLabel("intro");

  return (
    <aside
      data-guided-toolbar-notice
      data-guided-toolbar-target="mobile-intro"
      aria-label="Boas-vindas ao guia inicial do Doze 52"
      // Mesma linguagem visual do card de abertura do tour desktop
      // (guided-onboarding-panel.tsx): raio 1.5rem, sombra funda, selo com
      // ícone em rounded-xl e barra de progresso — antes era o
      // GuidedToolbarNoticeCard genérico, compartilhado com os outros
      // passos, mais raso que isso.
      className="inverse-product-surface relative mt-2 rounded-[1.5rem] border border-border bg-card p-4 text-card-foreground shadow-[0_30px_95px_-20px_rgba(15,23,42,0.82)] animate-in fade-in-0 duration-200 motion-reduce:animate-none sm:p-5"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Repeat className="size-4" aria-hidden="true" />
          </div>
          <p className="min-w-0 flex-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            Seus hábitos
          </p>
          <span className="shrink-0 text-xs text-muted-foreground">
            {stepLabel}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="-mr-1 rounded-full"
            aria-label="Encerrar guia inicial"
            onClick={onClose}
          >
            <X />
          </Button>
        </div>
        <AnimatedProgress
          hideLabel
          value={(1 / MOBILE_HABITS_ONBOARDING_TOTAL_STEPS) * 100}
          label="Progresso do guia inicial"
          statusText={stepLabel}
        />
      </div>

      <div className="mt-4 flex justify-center -space-x-3">
        {SAMPLE_HABIT_ICONS.map(({ Icon, color }, index) => {
          const token = getCategoryColorToken(color);
          return (
            <span
              key={color}
              aria-hidden="true"
              style={{
                backgroundColor: token.soft,
                borderColor: token.border,
                color: token.text,
                zIndex: SAMPLE_HABIT_ICONS.length - index,
              }}
              className="relative grid size-9 place-items-center rounded-full border ring-2 ring-background"
            >
              <Icon className="size-4" />
            </span>
          );
        })}
      </div>

      <div className="mt-4 text-center">
        <p className="text-[15px] font-semibold leading-6 tracking-[-0.005em]">
          Construa seus hábitos aqui, dia após dia.
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Marque cada dia e acompanhe sua consistência.
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        {onRequireAuth ? (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onRequireAuth}
          >
            Entrar na minha conta
          </Button>
        ) : null}
        <Button
          type="button"
          variant="premium"
          className="flex-1"
          onClick={onContinue}
        >
          Continuar
        </Button>
      </div>
    </aside>
  );
}
