"use client";

import * as React from "react";
import { CheckCircle2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FOUNDER_PRICE_LABEL,
  PRO_UPGRADE_COPY,
  type ProUpgradeReason,
} from "@/lib/entitlements";
import { useBilling } from "@/lib/use-billing";

type ProUpgradeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reason?: ProUpgradeReason;
  onRequireAuth?: () => void;
};

const PRO_BULLETS = [
  "Mais contextos para separar trabalho, vida pessoal, viagens e família.",
  "Mais categorias para entender melhor como seu tempo está distribuído.",
  "Calendários ilimitados para acompanhar datas importantes.",
  "Importacao e exportacao de eventos por planilha Excel.",
  "Acesso às próximas funcionalidades Pro.",
];

export function ProUpgradeDialog({
  open,
  onOpenChange,
  reason = "generic",
  onRequireAuth,
}: ProUpgradeDialogProps) {
  const { isOpeningCheckout, openCheckout } = useBilling();
  const copy = PRO_UPGRADE_COPY[reason];
  const isContextual = reason !== "generic";

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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader className="pr-8">
          <div className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-border/75 bg-muted/34 text-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          <DialogTitle>{isContextual ? copy.title : "Doze 52 Pro"}</DialogTitle>
          <DialogDescription>
            {isContextual ? copy.description : "Organize mais partes do seu ano."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isContextual ? (
            <div className="rounded-[12px] border border-border/70 bg-muted/24 px-3 py-3">
              <p className="text-sm font-semibold text-foreground">Doze 52 Pro</p>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Organize mais partes do seu ano.
              </p>
            </div>
          ) : null}

          <ul className="space-y-2.5">
            {PRO_BULLETS.map((bullet) => (
              <li key={bullet} className="flex gap-2.5 text-sm leading-6">
                <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                <span className="text-muted-foreground">{bullet}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-[12px] border border-border/75 bg-background px-3 py-3">
            <p className="text-sm font-semibold text-foreground">
              Preço fundador: {FOUNDER_PRICE_LABEL}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Cancele quando quiser.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
          <Button
            variant="premium"
            onClick={handleUpgrade}
            disabled={isOpeningCheckout}
          >
            {isOpeningCheckout ? "Abrindo..." : isContextual ? copy.cta : "Assinar Pro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
