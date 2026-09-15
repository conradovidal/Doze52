"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function OnboardingExitDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-onboarding-exit-dialog
        className="inverse-product-surface max-w-md bg-card text-card-foreground"
        showCloseButton={false}
      >
        <DialogHeader>
          <DialogTitle className="text-card-foreground text-base font-medium">
            Encerrar o guia? O que você criou continua no seu ano, e ele não
            volta a aparecer.
          </DialogTitle>
          <DialogDescription className="sr-only">
            Confirme para encerrar a montagem guiada.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Continuar montagem
          </Button>
          <Button type="button" variant="premium" onClick={onConfirm}>
            Encerrar e explorar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
