"use client";

import * as React from "react";
import { Archive, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type IconActionButtonProps = Omit<React.ComponentProps<typeof Button>, "variant" | "size" | "children"> & {
  /** Nome acessível e dica ao passar o mouse (ex.: "Arquivar hábito"). */
  label: string;
};

/**
 * Ações secundárias dos rodapés de edição (arquivar, excluir) viram ícones
 * lado a lado à esquerda; à direita ficam só "Cancelar" e a ação principal.
 * Mesmo desenho em hábito, categoria, evento e contexto.
 */
export function ArchiveIconButton({ label, ...props }: IconActionButtonProps) {
  return (
    <Button type="button" variant="outline" size="icon" aria-label={label} title={label} {...props}>
      <Archive aria-hidden="true" />
    </Button>
  );
}

export function DeleteIconButton({ label, ...props }: IconActionButtonProps) {
  return (
    <Button type="button" variant="dangerSoft" size="icon" aria-label={label} title={label} {...props}>
      <Trash2 aria-hidden="true" />
    </Button>
  );
}

/** Grupo esquerdo do rodapé: ícones sempre lado a lado, nunca empilhados. */
export function DialogSecondaryActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2">{children}</div>;
}
