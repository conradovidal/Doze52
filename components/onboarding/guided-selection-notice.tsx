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
      className="flex items-start gap-3 bg-primary/6 px-3 py-3 text-card-foreground sm:px-4"
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <CalendarDays className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-5">{notice.title}</p>
        <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
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
