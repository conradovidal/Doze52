"use client";

import * as React from "react";
import {
  CalendarDays,
  FileSpreadsheet,
  Layers,
  Repeat,
  Sparkles,
  Tags,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { AsyncStateButton } from "@/components/ui/async-state-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CATEGORY_COLOR_BASE_AMBER,
  CATEGORY_COLOR_BASE_CORAL,
  CATEGORY_COLOR_BASE_INDIGO,
  CATEGORY_COLOR_BASE_TEAL,
  CATEGORY_COLOR_BASE_VIOLET,
  getCategoryColorToken,
} from "@/lib/category-palette";
import {
  FOUNDER_PRICE_LABEL,
  PRO_UPGRADE_COPY,
  type ProUpgradeReason,
} from "@/lib/entitlements";
import { useProUpgradeRequests } from "@/lib/pro-upgrade-nudge";
import { useBilling } from "@/lib/use-billing";
import { cn } from "@/lib/utils";

type ProUpgradeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: ProUpgradeReason;
  onRequireAuth?: () => void;
};

type ProFeature = {
  id: string;
  label: string;
  Icon: LucideIcon;
  color: string;
  /** Motivo que destaca este benefício (o que a pessoa acabou de tentar). */
  reason: ProUpgradeReason;
};

// Mesma técnica visual da capa do onboarding: uma pilha de ícones nas cores
// das categorias deixa o valor legível antes de qualquer texto.
const PRO_FEATURES: readonly ProFeature[] = [
  { id: "profiles", label: "Contextos ilimitados", Icon: Layers, color: CATEGORY_COLOR_BASE_INDIGO, reason: "profiles" },
  { id: "categories", label: "Categorias ilimitadas", Icon: Tags, color: CATEGORY_COLOR_BASE_CORAL, reason: "categories" },
  { id: "calendars", label: "Calendários prontos ilimitados", Icon: CalendarDays, color: CATEGORY_COLOR_BASE_TEAL, reason: "calendar-subscriptions" },
  { id: "habits", label: "Até 4 hábitos", Icon: Repeat, color: CATEGORY_COLOR_BASE_VIOLET, reason: "habits" },
  { id: "spreadsheet", label: "Importar e exportar planilhas", Icon: FileSpreadsheet, color: CATEGORY_COLOR_BASE_AMBER, reason: "calendar-import-export" },
];

export function ProUpgradeDialog({
  open,
  onOpenChange,
  reason = "generic",
  onRequireAuth,
}: ProUpgradeDialogProps) {
  const { isOpeningCheckout, openCheckout } = useBilling();
  const copy = PRO_UPGRADE_COPY[reason];

  const handleUpgrade = async () => {
    await openCheckout({
      onAuthRequired: () => {
        onOpenChange(false);
        onRequireAuth?.();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-pro-upgrade-dialog
        className="inverse-product-surface gap-0 overflow-hidden rounded-[1.5rem] border-border bg-card p-0 text-card-foreground shadow-[0_30px_95px_-20px_rgba(15,23,42,0.82)] sm:max-w-[500px] sm:p-0"
      >
        <div className="px-6 pb-5 pt-7 text-center sm:px-8">
          <div className="flex justify-center -space-x-2.5">
            {PRO_FEATURES.map(({ id, Icon, color, reason: featureReason }, index) => {
              const token = getCategoryColorToken(color);
              const featured = featureReason === reason;
              return (
                <span
                  key={id}
                  aria-hidden="true"
                  style={{
                    backgroundColor: token.soft,
                    borderColor: token.border,
                    color: token.text,
                    zIndex: featured ? PRO_FEATURES.length + 1 : PRO_FEATURES.length - index,
                  }}
                  className={cn(
                    "relative grid size-11 place-items-center rounded-full border ring-[3px] ring-card transition-transform",
                    featured && "-translate-y-1 scale-110"
                  )}
                >
                  <Icon className="size-[18px]" />
                </span>
              );
            })}
          </div>

          <p className="mt-5 inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
            <Sparkles className="size-3" aria-hidden="true" />
            Doze 52 Pro
          </p>
          <DialogTitle className="mt-2 text-balance text-xl font-semibold leading-7 tracking-[-0.01em]">
            {copy.title}
          </DialogTitle>
          <DialogDescription className="mx-auto mt-2 max-w-[22rem] text-pretty text-sm leading-6 text-muted-foreground">
            {copy.description}
          </DialogDescription>
        </div>

        <ul className="mx-6 grid grid-cols-1 gap-x-4 gap-y-2.5 border-y border-border/70 py-4 sm:mx-8 sm:grid-cols-2">
          {PRO_FEATURES.map(({ id, label, Icon, color, reason: featureReason }) => {
            const token = getCategoryColorToken(color);
            return (
              <li
                key={id}
                className={cn(
                  "flex items-center gap-2.5 text-sm leading-5",
                  featureReason === reason
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground"
                )}
              >
                <span
                  aria-hidden="true"
                  className="grid size-6 shrink-0 place-items-center rounded-full"
                  style={{ backgroundColor: token.soft, color: token.text }}
                >
                  <Icon className="size-3.5" />
                </span>
                {label}
              </li>
            );
          })}
          <li className="flex items-center gap-2.5 text-sm leading-5 text-muted-foreground">
            <span
              aria-hidden="true"
              className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-foreground"
            >
              <Sparkles className="size-3.5" />
            </span>
            Novidades Pro primeiro
          </li>
        </ul>

        <div className="px-6 pb-6 pt-5 sm:px-8">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-2xl font-semibold tracking-[-0.02em] tabular-nums">
              {FOUNDER_PRICE_LABEL}
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-foreground">
              Preço fundador
            </span>
          </div>
          <p className="mt-1 text-center text-xs text-muted-foreground">
            Cancele quando quiser.
          </p>

          <AsyncStateButton
            variant="premium"
            className="mt-4 h-11 w-full text-[15px]"
            onClick={handleUpgrade}
            disabled={isOpeningCheckout}
            state={isOpeningCheckout ? "pending" : "idle"}
            pendingLabel="Abrindo checkout…"
          >
            {copy.cta}
          </AsyncStateButton>
          <Button
            variant="ghost"
            className="mt-1 w-full text-muted-foreground"
            onClick={() => onOpenChange(false)}
          >
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Instância única que atende requestProUpgrade() — usada pelos avisos de
 * "última vaga gratuita", que somem junto com o componente que os criou.
 */
export function GlobalProUpgradeDialog({
  onRequireAuth,
}: {
  onRequireAuth?: () => void;
}) {
  const [reason, setReason] = React.useState<ProUpgradeReason | null>(null);
  useProUpgradeRequests(setReason);
  return (
    <ProUpgradeDialog
      open={reason !== null}
      onOpenChange={(next) => {
        if (!next) setReason(null);
      }}
      reason={reason ?? "generic"}
      onRequireAuth={onRequireAuth}
    />
  );
}
