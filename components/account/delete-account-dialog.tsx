"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useFeedback } from "@/components/ui/feedback-provider";
import { useAuth } from "@/lib/auth";
import { logDevError } from "@/lib/safe-log";

const CONFIRMATION_WORD = "EXCLUIR";

export function DeleteAccountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { notify } = useFeedback();
  const { deleteAccount } = useAuth();
  const [confirmationText, setConfirmationText] = React.useState("");
  const [isDeleting, setIsDeleting] = React.useState(false);
  const canConfirm = confirmationText.trim().toUpperCase() === CONFIRMATION_WORD;

  React.useEffect(() => {
    if (!open) setConfirmationText("");
  }, [open]);

  const handleDelete = async () => {
    if (!canConfirm) return;
    setIsDeleting(true);
    try {
      await deleteAccount();
      notify({
        tone: "info",
        title: "Conta excluída",
        description: "Seus dados foram removidos permanentemente.",
      });
      onOpenChange(false);
      // Hard navigation clears any in-memory client state left over from the deleted account.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida.";
      logDevError("account.delete", { message });
      notify({
        tone: "error",
        title: "Não foi possível excluir sua conta",
        description: message,
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isDeleting ? undefined : onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <div className="mb-1 inline-flex h-9 w-9 items-center justify-center rounded-[10px] border border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <DialogTitle>Excluir sua conta</DialogTitle>
          <DialogDescription>
            Essa ação é permanente. Todos os seus contextos, categorias e eventos
            serão apagados, e uma eventual assinatura Pro ativa será cancelada
            imediatamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <label htmlFor="delete-account-confirm" className="text-[12px] font-medium text-foreground/70">
            Digite {CONFIRMATION_WORD} para confirmar
          </label>
          <Input
            id="delete-account-confirm"
            value={confirmationText}
            onChange={(event) => setConfirmationText(event.target.value)}
            placeholder={CONFIRMATION_WORD}
            autoComplete="off"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm || isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? "Excluindo..." : "Excluir permanentemente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
