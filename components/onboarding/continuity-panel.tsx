"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { useAccountContinuity } from "@/lib/use-account-continuity";

export function ContinuityPanel({
  continuity: c,
  isMobile,
  authenticated,
  onStartAnnual,
  helpOpen,
  onHelpOpenChange,
}: {
  continuity: ReturnType<typeof useAccountContinuity>;
  isMobile: boolean;
  authenticated: boolean;
  onStartAnnual: () => void;
  helpOpen: boolean;
  onHelpOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const showInvite =
    authenticated && !isMobile && c.ready && c.progress?.status === "pending";
  const [dismissedIssues, setDismissedIssues] = useState("");
  const issueKey = JSON.stringify([
    c.conflicts.map((op) => op.operationId),
    c.limit,
  ]);
  const open =
    showInvite ||
    helpOpen ||
    Boolean(c.legacy) ||
    (Boolean(c.conflicts.length || c.limit) && dismissedIssues !== issueKey);
  const dismiss = () => {
    onHelpOpenChange(false);
    setDismissedIssues(issueKey);
    if (showInvite && c.progress)
      c.setProgress({ ...c.progress, status: "dismissed" });
    if (c.legacy) c.dismissImport();
  };
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) dismiss();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-md">
        <DialogTitle>
          {c.legacy
            ? "Guardar seus hábitos"
            : c.conflicts.length || c.limit
              ? "Revisar sincronização"
              : "Seu Anual"}
        </DialogTitle>
        <DialogDescription>
          {c.legacy || c.conflicts.length || c.limit
            ? "Seu progresso está preservado. Revise as opções para continuar."
            : "Uma introdução opcional para organizar seu ano."}
        </DialogDescription>
        {showInvite || helpOpen ? (
          <div className="my-2 rounded-lg border p-3">
            <p>
              {c.progress?.firstHabitAt
                ? "Seus hábitos continuam aqui. Vamos montar seu ano?"
                : "Conheça os recursos para montar seu ano."}
            </p>
            <button
              className="mr-4 mt-2 font-semibold underline"
              onClick={() => {
                onHelpOpenChange(false);
                onStartAnnual();
              }}
            >
              Montar meu ano
            </button>
            <button
              onClick={() => {
                onHelpOpenChange(false);
                if (c.progress)
                  c.setProgress({ ...c.progress, status: "dismissed" });
              }}
            >
              Agora não
            </button>
          </div>
        ) : null}
        {c.legacy ? (
          <section
            aria-label="Importar hábitos"
            className="my-2 rounded-lg border p-3"
          >
            <p>
              {c.importSource === "legacy"
                ? "Encontramos hábitos antigos neste navegador. Deseja guardá-los nesta conta?"
                : "Escolha os hábitos que deseja acompanhar nesta conta."}
            </p>
            <p>
              Selecione até {c.accountLimit} hábitos ativos. Os demais serão
              guardados arquivados, com suas marcações.
            </p>
            {c.importCandidates.map((h) => (
              <label key={h.id} className="mr-3 inline-flex gap-2 py-2">
                <input
                  type="checkbox"
                  checked={selected.includes(h.id)}
                  disabled={
                    !selected.includes(h.id) &&
                    selected.length >= c.accountLimit
                  }
                  onChange={() =>
                    setSelected((ids) =>
                      ids.includes(h.id)
                        ? ids.filter((id) => id !== h.id)
                        : [...ids, h.id],
                    )
                  }
                />
                {h.name}
              </label>
            ))}
            <div>
              <button
                className="mr-3 underline"
                onClick={() => c.importDraft(selected)}
              >
                Guardar nesta conta
              </button>
              <button onClick={c.dismissImport}>Agora não</button>
            </div>
          </section>
        ) : null}
        {c.conflicts.map((op) => (
          <div key={op.operationId} className="my-2 rounded-lg border p-2">
            <p>
              Este registro mudou em outro aparelho. Mantivemos a versão salva e
              sua alteração para revisão.
            </p>
            <button
              className="mr-3 underline"
              onClick={() => c.reapply(op.operationId)}
            >
              Reaplicar minha alteração / recuperar
            </button>
            <button onClick={() => c.discardConflict(op.operationId)}>
              Manter versão salva
            </button>
          </div>
        ))}
        {c.limit ? (
          <div role="alert">
            O limite de hábitos ativos foi atingido. Seus dados continuam neste
            aparelho.{" "}
            <button className="underline" onClick={c.archivePending}>
              Guardar os hábitos pendentes como arquivados
            </button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
