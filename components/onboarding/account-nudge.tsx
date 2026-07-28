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
      className="inverse-product-surface fixed top-[5.25rem] right-3 z-40 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-border bg-card p-3.5 text-card-foreground shadow-[0_22px_65px_-24px_rgba(15,23,42,0.78)] animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none sm:right-4"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <CalendarDays
            data-account-nudge-icon="calendar"
            className="size-4"
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Seu ano começou a tomar forma.</p>
          <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
            Crie sua conta para guardar essa visão, acessá-la em qualquer
            dispositivo e usar seu ano como apoio para planejar o que vem pela
            frente.
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
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={onCreateAccount}
      >
        Guardar meu ano
      </Button>
    </aside>
  );
}
