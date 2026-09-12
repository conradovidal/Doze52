"use client";

import { Monitor, X } from "lucide-react";

import { cn } from "@/lib/utils";

type MobileDesktopFirstNoticeVariant = "example" | "resuming" | "onboarding";

type MobileDesktopFirstNoticeProps = {
  /**
   * "example": ainda é o ano de exemplo na tela.
   * "resuming": a pessoa já começou a montar o ano dela no desktop e só
   * precisa ser lembrada de onde continuar.
   * "onboarding": acabou de terminar a jornada de Hábitos do mobile e chegou
   * aqui pela primeira vez, guiada.
   */
  variant: MobileDesktopFirstNoticeVariant;
  onOpenLogin: () => void;
  onDismiss: () => void;
  className?: string;
};

const COPY: Record<
  MobileDesktopFirstNoticeVariant,
  { lead: string; body: string }
> = {
  example: {
    lead: "Comece pelo desktop.",
    body: "O ano completo cabe numa tela maior. Aqui, você acompanha o dia a dia.",
  },
  resuming: {
    lead: "Continue no desktop.",
    body: "Seu ano já montado aparece completo por lá. Aqui, você acompanha o dia a dia.",
  },
  onboarding: {
    lead: "Um gostinho do Anual.",
    body: "Esta visão foi pensada para o desktop, onde ela nasceu. Aqui, você já sente como ela funciona.",
  },
};

/**
 * O aviso "comece pelo desktop" continua fazendo sentido como mensagem: o
 * produto é desktop-first por decisão de design. O que não fazia sentido era
 * ser uma parede: até aqui isso era um Dialog sem botão de fechar, com
 * Escape e clique-fora cancelados, o que deixava `pointer-events: none` no
 * body e impedia a pessoa de simplesmente ver e rolar o ano no celular.
 *
 * Agora é uma faixa em fluxo, no topo da Anual mobile: informa, oferece o
 * caminho de entrar na conta, e sai de cena quando dispensada.
 */
export function MobileDesktopFirstNotice({
  variant,
  onOpenLogin,
  onDismiss,
  className,
}: MobileDesktopFirstNoticeProps) {
  const copy = COPY[variant];
  return (
    <div
      data-mobile-desktop-first-notice
      role="status"
      className={cn(
        "inverse-product-surface mx-3 mt-2 flex items-start gap-2.5 rounded-[10px] border border-border bg-card px-3 py-2 shadow-[0_18px_36px_-24px_rgba(15,23,42,0.45)]",
        className
      )}
    >
      <span className="mt-px grid size-6 shrink-0 place-items-center rounded-md bg-muted text-card-foreground">
        <Monitor className="size-3.5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[13px] leading-5 text-card-foreground">
          <span className="font-semibold">{copy.lead} </span>
          <span className="text-muted-foreground">{copy.body}</span>{" "}
          <button
            type="button"
            className="font-semibold text-primary underline underline-offset-2"
            onClick={onOpenLogin}
          >
            Entrar na minha conta
          </button>
        </p>
      </div>

      <button
        type="button"
        aria-label="Dispensar"
        title="Dispensar"
        className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-card-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
        onClick={onDismiss}
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
