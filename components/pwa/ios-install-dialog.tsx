"use client";

import { PlusSquare, Share } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const STEPS = [
  {
    icon: Share,
    text: (
      <>
        Toque em <strong className="font-semibold">Compartilhar</strong> na barra do navegador.
      </>
    ),
  },
  {
    icon: PlusSquare,
    text: (
      <>
        Escolha <strong className="font-semibold">Adicionar à Tela de Início</strong> e confirme.
      </>
    ),
  },
] as const;

// O iOS não deixa um site abrir o prompt de instalação: só dá para mostrar o
// caminho. O diálogo só é oferecido a quem tem conta sincronizada (ver
// getInstallOption), porque o app instalado no iOS começa com armazenamento
// separado do Safari.
export function IosInstallDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Instalar o Doze 52</DialogTitle>
          <DialogDescription>
            Abra o Doze 52 direto da tela inicial, como um app. Seus dados ficam salvos na sua conta.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-3">
          {STEPS.map(({ icon: Icon, text }, index) => (
            <li key={index} className="flex items-start gap-3 text-sm leading-6">
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
