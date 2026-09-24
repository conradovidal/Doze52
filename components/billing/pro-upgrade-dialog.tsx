"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AsyncStateButton } from "@/components/ui/async-state-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PRO_FEATURES,
  ProFeatureIcon,
  ProFeatureStack,
} from "@/components/billing/pro-features";
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
          <ProFeatureStack reason={reason} className="justify-center" />

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
          {PRO_FEATURES.map((feature) => (
            <li
              key={feature.id}
              className={cn(
                "flex items-center gap-2.5 text-sm leading-5",
                feature.reason === reason
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <ProFeatureIcon feature={feature} />
              {feature.label}
            </li>
          ))}
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
