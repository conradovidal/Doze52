"use client";

import * as React from "react";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type GuidedSelectionNotice = {
  mode: "date" | "period";
  title: string;
  instruction: string;
};

// Revela o texto letra a letra a cada troca (1º aniversário → 2º, por
// exemplo) — um cross-fade sozinho, numa barra de uma linha só, é sutil
// demais para deixar claro que o texto mudou e não só re-renderizou.
function useTypewriter(text: string, speedMs = 14) {
  const [shown, setShown] = React.useState("");
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setShown(text);
      setDone(true);
      return;
    }
    setShown("");
    setDone(text.length === 0);
    let index = 0;
    const id = window.setInterval(() => {
      index += 1;
      setShown(text.slice(0, index));
      if (index >= text.length) {
        window.clearInterval(id);
        setDone(true);
      }
    }, speedMs);
    return () => window.clearInterval(id);
  }, [text, speedMs]);
  return { shown, done };
}

export function GuidedCalendarNotice({
  notice,
  onClose,
}: {
  notice: GuidedSelectionNotice;
  onClose: () => void;
}) {
  const { shown: typedTitle, done: typingDone } = useTypewriter(notice.title);
  return (
    <aside
      data-guided-calendar-notice
      data-guided-selection-mode={notice.mode}
      aria-label="Instrução do guia inicial"
      aria-live="polite"
      className="inverse-product-surface flex h-10 items-center gap-2.5 bg-card px-3 text-card-foreground"
    >
      <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
        <CalendarDays className="size-3.5" aria-hidden="true" />
      </div>
      <p
        className="min-w-0 flex-1 truncate text-sm font-semibold leading-5"
        title={notice.title}
      >
        {typedTitle}
        {typingDone ? null : (
          <span
            aria-hidden="true"
            className="ml-px inline-block h-3.5 w-[2px] -translate-y-px animate-pulse bg-current align-middle motion-reduce:hidden"
          />
        )}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0 rounded-full"
        aria-label="Encerrar guia inicial"
        onClick={onClose}
      >
        <X />
      </Button>
    </aside>
  );
}
