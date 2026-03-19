"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, LoaderCircle } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export type SyncIndicatorState =
  | { state: "hidden" }
  | { state: "loading" }
  | { state: "saving" }
  | { state: "synced" }
  | { state: "error"; message: string; detail?: string | null; onRetry: () => void };

const CHIP_BASE_CLASS =
  "inline-flex h-9 min-w-[10.25rem] items-center justify-center gap-2 rounded-2xl border px-3 text-[0.82rem] font-medium shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

const STATE_META = {
  loading: {
    label: "Sincronizando...",
    icon: LoaderCircle,
    chipClass:
      "border-border/65 bg-background/80 text-muted-foreground hover:border-border/80 hover:bg-muted/45 hover:text-foreground",
  },
  saving: {
    label: "Sincronizando...",
    icon: LoaderCircle,
    chipClass:
      "border-border/65 bg-background/80 text-muted-foreground hover:border-border/80 hover:bg-muted/45 hover:text-foreground",
  },
  synced: {
    label: "Sincronizado",
    icon: CheckCircle2,
    chipClass:
      "border-emerald-200/70 bg-emerald-50/80 text-emerald-700 hover:border-emerald-300/80 hover:bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/14",
  },
  error: {
    label: "Erro ao sincronizar",
    icon: AlertCircle,
    chipClass:
      "border-rose-200/75 bg-rose-50/85 text-rose-700 hover:border-rose-300/85 hover:bg-rose-50 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-200 dark:hover:bg-rose-500/14",
  },
} as const;

export function SyncStatusChip({ status }: { status: SyncIndicatorState }) {
  const [open, setOpen] = React.useState(false);

  if (status.state === "hidden") return null;

  const meta = STATE_META[status.state];
  const Icon = meta.icon;
  const isLoadingLike = status.state === "loading" || status.state === "saving";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${CHIP_BASE_CLASS} ${meta.chipClass}`}
          aria-label={meta.label}
          title={meta.label}
        >
          <Icon className={`h-3.5 w-3.5 shrink-0 ${isLoadingLike ? "animate-spin" : ""}`} />
          <span className="truncate">{meta.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" side="bottom" sideOffset={12} className="w-[17.5rem] rounded-2xl border-border/80 p-4">
        {status.state === "error" ? (
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
                  setOpen(false);
                  status.onRetry();
                }}
              >
                Tentar novamente
              </Button>
            </div>
          </div>
        ) : (
          <PopoverHeader className="space-y-1.5">
            <PopoverTitle>{meta.label}</PopoverTitle>
          </PopoverHeader>
        )}
      </PopoverContent>
    </Popover>
  );
}
