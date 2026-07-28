"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GuidedToolbarNotice = {
  target: "edit" | "theme";
  title: string;
  instruction: string;
};

export function GuidedToolbarNoticeCard({
  notice,
  onClose,
  align = "start",
}: {
  notice: GuidedToolbarNotice;
  onClose: () => void;
  align?: "start" | "end";
}) {
  return (
    <aside
      data-guided-toolbar-notice
      data-guided-toolbar-target={notice.target}
      aria-label="Instrução do guia inicial"
      aria-live="polite"
      className={cn(
        "absolute top-[calc(100%+0.6rem)] z-60 w-[min(17rem,calc(100vw-1.5rem))] rounded-2xl border border-primary/25 bg-card/98 p-3.5 text-left text-card-foreground shadow-[0_22px_55px_-26px_rgba(15,23,42,0.75)] backdrop-blur-xl",
        align === "start" ? "left-0" : "right-0"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold leading-5">{notice.title}</p>
          <p className="mt-1 text-sm leading-5 text-muted-foreground">
            {notice.instruction}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="-mt-1 -mr-1 shrink-0 rounded-full"
          aria-label="Encerrar guia inicial"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
    </aside>
  );
}
