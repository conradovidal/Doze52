"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export type SyncOverlayStatus =
  | { state: "loading" }
  | { state: "saving" }
  | { state: "synced" }
  | { state: "error"; message: string; detail?: string | null; onRetry: () => void };

type SyncStatusOverlayProps = {
  status: SyncOverlayStatus | null;
  visible: boolean;
  errorPopoverOpen: boolean;
  onErrorPopoverOpenChange: (open: boolean) => void;
};

const CHIP_BASE_CLASS =
  "inline-flex h-9 min-w-[10.25rem] items-center justify-center gap-2 rounded-2xl border px-3 text-[0.82rem] font-medium shadow-[0_14px_30px_-22px_rgba(15,23,42,0.36)] backdrop-blur-sm";

const STATE_META = {
  loading: {
    label: "Sincronizando...",
    icon: LoaderCircle,
    chipClass:
      "border-border/65 bg-background/92 text-muted-foreground",
  },
  saving: {
    label: "Sincronizando...",
    icon: LoaderCircle,
    chipClass:
      "border-border/65 bg-background/92 text-muted-foreground",
  },
  synced: {
    label: "Sincronizado",
    icon: CheckCircle2,
    chipClass:
      "border-emerald-200/80 bg-emerald-50/92 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/12 dark:text-emerald-200",
  },
  error: {
    label: "Erro ao sincronizar",
    icon: AlertCircle,
    chipClass:
      "border-rose-200/85 bg-rose-50/94 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/12 dark:text-rose-200",
  },
} as const;

export function SyncStatusOverlay({
  status,
  visible,
  errorPopoverOpen,
  onErrorPopoverOpenChange,
}: SyncStatusOverlayProps) {
  if (!status) return null;

  const meta = STATE_META[status.state];
  const Icon = meta.icon;
  const isLoadingLike = status.state === "loading" || status.state === "saving";
  const containerClass = `transition-[transform,opacity] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
    visible
      ? "translate-y-2 opacity-100 md:translate-y-3"
      : "-translate-y-[calc(100%+0.9rem)] opacity-0"
  }`;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-4"
    >
      {status.state === "error" ? (
        <Popover open={errorPopoverOpen} onOpenChange={onErrorPopoverOpenChange}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={`${CHIP_BASE_CLASS} ${meta.chipClass} pointer-events-auto ${containerClass} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50`}
              aria-label={meta.label}
              title={meta.label}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{meta.label}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            side="bottom"
            sideOffset={12}
            className="w-[17.5rem] rounded-2xl border-border/80 p-4"
          >
            <div className="space-y-3.5">
              <PopoverHeader className="space-y-1.5">
                <PopoverTitle>Erro ao sincronizar</PopoverTitle>
                <PopoverDescription className="text-sm leading-5">
                  {status.message}
                </PopoverDescription>
              </PopoverHeader>
              {status.detail ? (
                <p className="text-[11px] leading-4 text-muted-foreground">{status.detail}</p>
              ) : null}
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => {
                    onErrorPopoverOpenChange(false);
                    status.onRetry();
                  }}
                >
                  Tentar novamente
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        <div
          role="status"
          className={`${CHIP_BASE_CLASS} ${meta.chipClass} ${containerClass}`}
          aria-hidden={!visible}
        >
          <Icon className={`h-3.5 w-3.5 shrink-0 ${isLoadingLike ? "animate-spin" : ""}`} />
          <span className="truncate">{meta.label}</span>
        </div>
      )}
    </div>
  );
}
