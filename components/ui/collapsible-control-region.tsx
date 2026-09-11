"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function CollapsibleControlRegion({
  id,
  expanded,
  children,
  className,
  contentClassName,
  fixedHeightClassName,
}: {
  id: string;
  expanded: boolean;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  // Quando informado, troca o mecanismo de "altura automática" (grid-rows
  // 0fr/1fr, que mede o conteúdo — por isso duas faixas com conteúdo
  // diferente, como a de categorias do Anual e a de hábitos, terminam em
  // alturas diferentes mesmo as duas "expandidas") por uma altura FIXA
  // (ex.: "h-[3.75rem]"). Use nos pontos onde a posição resultante precisa
  // bater entre instâncias diferentes deste componente.
  fixedHeightClassName?: string;
}) {
  const useFixedHeight = Boolean(fixedHeightClassName);
  return (
    <div
      id={id}
      aria-hidden={!expanded}
      inert={!expanded ? true : undefined}
      className={cn(
        useFixedHeight
          ? "w-full overflow-hidden transition-[height,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[height,opacity,transform] motion-reduce:transition-none"
          : "grid w-full transition-[grid-template-rows,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[grid-template-rows,opacity,transform] motion-reduce:transition-none",
        useFixedHeight
          ? expanded
            ? cn(fixedHeightClassName, "translate-y-0 opacity-100")
            : "h-0 -translate-y-1 opacity-0 pointer-events-none"
          : expanded
            ? "grid-rows-[1fr] translate-y-0 opacity-100"
            : "pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0",
        className
      )}
    >
      <div
        className={cn(
          "min-h-0 overflow-hidden transition-[padding,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
          useFixedHeight && "flex h-full flex-col items-center justify-center",
          contentClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}
