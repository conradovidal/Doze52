"use client";

import { CalendarDays, X } from "lucide-react";

import { Button } from "@/components/ui/button";

type DemoExplorationInviteProps = {
  onCreateYear: () => void;
  onContinue: () => void;
};

export function DemoExplorationInvite({
  onCreateYear,
  onContinue,
}: DemoExplorationInviteProps) {
  return (
    <aside
      data-demo-exploration-invite
      className="inverse-product-surface fixed right-4 top-[calc(env(safe-area-inset-top,0px)+4.5rem)] z-[70] w-[min(23rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-[0_26px_70px_-24px_rgba(15,23,42,0.82)] animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none"
      aria-label="Convite para criar seu próprio ano"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
          <CalendarDays className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="pr-6 text-base font-semibold leading-5">
            Agora, que tal montar o seu próprio ano?
          </h2>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            Você já viu como contextos, categorias e calendários dão forma a
            essa visão. Comece do zero e organize o que importa para você.
          </p>
        </div>
        <button
          type="button"
          onClick={onContinue}
          className="-ml-8 grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Fechar convite e continuar explorando"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Button type="button" variant="premium" onClick={onCreateYear}>
          Criar meu ano
        </Button>
        <Button type="button" variant="outline" onClick={onContinue}>
          Continuar explorando
        </Button>
      </div>
    </aside>
  );
}
