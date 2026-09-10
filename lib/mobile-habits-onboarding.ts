"use client";

// Jornada curta e própria do mobile, independente da máquina de estados do
// tour desktop (lib/onboarding.ts): passos lineares, sem reducer — só o
// avanço explícito de quem está guiando a tela. Os três primeiros
// (create_habit, mark_day, goto_annual) vivem em
// components/habits/habits-prototype.tsx; os quatro seguintes (annual_* e
// goto_profile) vivem em app/page.tsx, porque dependem do cabeçalho e da
// navegação da Anual, fora da árvore de Hábitos.
//
// O passo de abertura ("explique a tela, depois peça pra criar") e o de
// criar o hábito eram dois passos com um "Continuar" entre eles — fundidos
// num só: chega já convidando a criar o hábito, com o "+" destacado (mesmo
// mecanismo do desktop), sem toque extra nenhum antes disso.
export type MobileHabitsOnboardingStep =
  | "create_habit"
  | "mark_day"
  | "save_progress"
  | "goto_annual"
  | "annual_year"
  | "annual_theme"
  | "annual_organize"
  | "goto_profile"
  | "completed"
  | "dismissed";

const STEPS: readonly MobileHabitsOnboardingStep[] = [
  "create_habit",
  "mark_day",
  "save_progress",
  "goto_annual",
  "annual_year",
  "annual_theme",
  "annual_organize",
  "goto_profile",
  "completed",
  "dismissed",
];

const STORAGE_KEY = "doze52:mobile-habits-onboarding:v1";

const isMobileHabitsOnboardingStep = (
  value: unknown
): value is MobileHabitsOnboardingStep =>
  typeof value === "string" &&
  (STEPS as readonly string[]).includes(value);

export const readMobileHabitsOnboardingStep =
  (): MobileHabitsOnboardingStep | null => {
    if (typeof window === "undefined") return null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return isMobileHabitsOnboardingStep(raw) ? raw : null;
    } catch {
      return null;
    }
  };

export const writeMobileHabitsOnboardingStep = (
  step: MobileHabitsOnboardingStep
) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, step);
  } catch {
    // Volta ao início na próxima visita se o storage falhar — aceitável:
    // essa jornada é curta e dispensável, não perde dado nenhum da pessoa.
  }
};

// Usado pelo botão de debug "Reiniciar onboarding" (app/page.tsx) — sem isso,
// reiniciar o onboarding do desktop deixava esta jornada travada no que quer
// que tivesse sido salvo antes (ex.: "completed" de um teste anterior),
// fazendo a tela cair na dica antiga em vez de reabrir do passo 1.
export const resetMobileHabitsOnboarding = () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada a limpar sem storage disponível.
  }
};
