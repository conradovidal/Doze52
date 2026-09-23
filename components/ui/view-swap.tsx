"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type Direction = "forward" | "back" | "none";

/**
 * Troca de tela dentro de um mesmo modal (Organizar, Adicionar categoria).
 * Entrar numa tela mais funda desliza da direita; voltar, da esquerda;
 * mesma profundidade (trocar de aba) só faz fade. O `key` remonta o
 * conteúdo a cada troca para a entrada reanimar.
 */
export function ViewSwap({
  view,
  depth,
  className,
  children,
}: {
  view: string;
  depth: number;
  className?: string;
  children: React.ReactNode;
}) {
  const [motion, setMotion] = React.useState<{ view: string; depth: number; direction: Direction }>({
    view,
    depth,
    direction: "none",
  });
  if (motion.view !== view) {
    setMotion({
      view,
      depth,
      direction: depth === motion.depth ? "none" : depth > motion.depth ? "forward" : "back",
    });
  }

  return (
    <div
      key={view}
      className={cn(
        "animate-in fade-in ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:animate-none",
        motion.direction === "forward"
          ? "slide-in-from-right-4 duration-250"
          : motion.direction === "back"
            ? "slide-in-from-left-4 duration-250"
            : "duration-200",
        className
      )}
    >
      {children}
    </div>
  );
}
