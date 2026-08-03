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
          <DialogTitle className="text-card-foreground">
            Quer encerrar a montagem guiada?
          </DialogTitle>
          <DialogDescription>
            O que você já criou continuará no seu ano. O guia não voltará a
            aparecer.
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
