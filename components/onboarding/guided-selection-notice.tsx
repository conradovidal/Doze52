"use client";

import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type GuidedSelectionNotice = {
  mode: "date" | "period";
  title: string;
  instruction: string;
};

export function GuidedCalendarNotice({
  notice,
  onClose,
}: {
  notice: GuidedSelectionNotice;
  onClose: () => void;
}) {
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
        key={notice.title}
        className="min-w-0 flex-1 truncate text-sm font-semibold leading-5 animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"
        title={notice.title}
      >
        {notice.title}
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
