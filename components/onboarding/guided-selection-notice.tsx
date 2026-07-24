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
      className="flex items-start gap-3.5 bg-primary/6 px-4 py-4 text-card-foreground sm:px-5"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
        <CalendarDays className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold leading-5.5 sm:text-lg">
          {notice.title}
        </p>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          {notice.instruction}
        </p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="-mt-0.5 -mr-1 rounded-full"
        aria-label="Encerrar guia inicial"
        onClick={onClose}
      >
        <X />
      </Button>
    </aside>
  );
}
