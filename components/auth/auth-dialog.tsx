"use client";

import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { AnchorPoint } from "@/lib/types";
import { AuthForm } from "./auth-form";

export function AuthDialog({
  open,
  onOpenChange,
  anchorPoint,
  initialMode = "login",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorPoint?: AnchorPoint;
  initialMode?: "login" | "signup";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        anchorPoint={anchorPoint}
        desktopPlacement="bottom-end"
        mobileMode="sheet"
        className="sm:max-w-[420px]"
      >
        <DialogTitle className="sr-only">Entrar ou criar conta no Doze 52</DialogTitle>
        <DialogDescription className="sr-only">
          Acesse ou crie sua conta para salvar, sincronizar e exportar seu ano.
        </DialogDescription>
        <AuthForm
          open={open}
          initialMode={initialMode}
          showHeader
          onSuccess={() => onOpenChange(false)}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
