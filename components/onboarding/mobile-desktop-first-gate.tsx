"use client";

import { Monitor } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type MobileDesktopFirstGateProps = {
  allowExample: boolean;
  onExploreExample: () => void;
  onOpenLogin: () => void;
};

export function MobileDesktopFirstGate({
  allowExample,
  onExploreExample,
  onOpenLogin,
}: MobileDesktopFirstGateProps) {
  return (
    <Dialog open>
      <DialogContent
        data-mobile-desktop-first-gate
        showCloseButton={false}
        className="inverse-product-surface max-w-[calc(100%-2rem)] gap-5 rounded-3xl border-border bg-card p-5 text-card-foreground shadow-[0_30px_80px_-28px_rgba(15,23,42,0.88)]"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className="items-center text-center">
          <span className="mb-1 grid size-11 place-items-center rounded-2xl bg-muted text-foreground">
            <Monitor className="size-5" aria-hidden="true" />
          </span>
          <DialogTitle className="text-xl leading-6">
            {allowExample
              ? "Comece pelo desktop."
              : "Continue a montagem do seu ano no desktop."}
          </DialogTitle>
          <DialogDescription className="max-w-[29rem] text-sm leading-6">
            {allowExample
              ? "O Doze 52 foi pensado para montar e visualizar o ano inteiro em uma tela maior. Comece pelo computador e use o celular para consultar e atualizar o dia a dia."
              : "Você já começou a montar seu ano. Continue no computador para preservar o contexto e enxergar o calendário completo. Depois, use o celular para consultar e atualizar o dia a dia."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-1">
          {allowExample ? (
            <Button
              type="button"
              variant="premium"
              className="w-full"
              onClick={onExploreExample}
            >
              Explorar o ano de exemplo
            </Button>
          ) : null}
          <Button
            type="button"
            variant={allowExample ? "outline" : "premium"}
            className="w-full"
            onClick={onOpenLogin}
          >
            Entrar na minha conta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
