"use client";

import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type AccountNudgeProps = {
  onCreateAccount: () => void;
  onDismiss: () => void;
};

export function AccountNudge({
  onCreateAccount,
  onDismiss,
}: AccountNudgeProps) {
  return (
    <aside
      data-onboarding-account-nudge
      aria-label="Convite para guardar o ano"
      // Mesma linguagem visual do card de abertura do guia (guided-onboarding-panel):
      // raio 1.5rem, sombra profunda, selo com ícone em rounded-xl e um rótulo
      // discreto acima do título — antes era um toast raso e batia com o resto.
      className="inverse-product-surface fixed top-[5.25rem] right-3 z-40 w-[min(21rem,calc(100vw-1.5rem))] rounded-[1.5rem] border border-border bg-card p-4 text-card-foreground shadow-[0_30px_95px_-20px_rgba(15,23,42,0.82)] animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none sm:right-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <CalendarDays
            data-account-nudge-icon="calendar"
            className="size-4"
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            Guarde seu ano
          </p>
          <p className="mt-1 text-sm font-semibold leading-5">
            Crie sua conta para acessá-lo em qualquer aparelho.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="-mt-1 -mr-1 rounded-full"
          aria-label="Fechar convite"
          onClick={onDismiss}
        >
          <X />
        </Button>
      </div>
      <Button
        type="button"
        variant="premium"
        size="sm"
        className="mt-3.5 w-full"
        onClick={onCreateAccount}
      >
        Guardar meu ano
      </Button>
    </aside>
  );
}
