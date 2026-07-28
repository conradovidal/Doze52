"use client";

import { Cloud, X } from "lucide-react";
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
      className="fixed top-[5.25rem] right-3 z-40 w-[min(20rem,calc(100vw-1.5rem))] rounded-2xl border border-foreground/15 bg-card/98 p-3.5 text-card-foreground shadow-[0_22px_65px_-30px_rgba(15,23,42,0.62)] backdrop-blur-xl animate-in fade-in-0 slide-in-from-top-2 duration-200 motion-reduce:animate-none sm:right-4"
    >
      <div className="flex items-start gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Cloud className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Vale a pena guardar este ano.</p>
          <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
            Você continuou adicionando datas e períodos. Crie sua conta para
            acessar essa visão em outros dispositivos.
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
        Criar minha conta
      </Button>
    </aside>
  );
}
