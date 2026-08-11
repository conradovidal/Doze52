"use client";

import * as React from "react";
import { MessageSquareText } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { readGuidedOnboardingState } from "@/lib/onboarding";
import {
  feedbackKindLabels,
  feedbackProtocol,
  getFeedbackDeviceClass,
  isValidFeedbackMessage,
  type FeedbackKind,
} from "@/lib/product-feedback";

export function FeedbackDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [kind, setKind] = React.useState<FeedbackKind>("idea");
  const [message, setMessage] = React.useState("");
  const [contactConsent, setContactConsent] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [protocol, setProtocol] = React.useState<string | null>(null);
  const submitLockRef = React.useRef(false);
  const normalizedMessage = message.trim();

  const reset = React.useCallback(() => {
    setKind("idea"); setMessage(""); setContactConsent(false);
    setError(null); setProtocol(null); setIsSubmitting(false);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) window.setTimeout(reset, 180);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidFeedbackMessage(normalizedMessage) || submitLockRef.current) return;
    submitLockRef.current = true;
    setIsSubmitting(true); setError(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind,
          message: normalizedMessage,
          contactConsent,
          context: {
            route: window.location.pathname,
            deviceClass: getFeedbackDeviceClass(window.innerWidth),
            onboardingStep: readGuidedOnboardingState().step,
          },
        }),
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "Não foi possível enviar agora.");
      setProtocol(feedbackProtocol(result.id));
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Não foi possível enviar agora.");
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[32rem]">
        {protocol ? (
          <div className="space-y-5 py-2 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"><MessageSquareText className="size-5" /></span>
            <DialogHeader className="text-center sm:text-center">
              <DialogTitle>Feedback enviado</DialogTitle>
              <DialogDescription>Obrigado por ajudar a melhorar o Doze 52. Protocolo {protocol}.</DialogDescription>
            </DialogHeader>
            <Button type="button" onClick={() => handleOpenChange(false)}>Fechar</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
              <DialogTitle>Enviar feedback</DialogTitle>
              <DialogDescription>Conte o que ajudaria você a planejar melhor ou o que não funcionou como esperado.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <label htmlFor="feedback-kind" className="text-sm font-medium">Tipo</label>
              <Select value={kind} onValueChange={(value) => setKind(value as FeedbackKind)}>
                <SelectTrigger id="feedback-kind" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(feedbackKindLabels) as FeedbackKind[]).map((value) => <SelectItem key={value} value={value}>{feedbackKindLabels[value]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3"><label htmlFor="feedback-message" className="text-sm font-medium">Mensagem</label><span className="text-xs text-muted-foreground">{message.length}/2000</span></div>
              <textarea id="feedback-message" value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={2000} required rows={6} autoFocus className="w-full resize-y rounded-xl border border-input bg-transparent px-3 py-2 text-sm leading-6 outline-none transition focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" placeholder="Escreva pelo menos 10 caracteres." />
              <p className="text-xs leading-5 text-muted-foreground">Enviaremos apenas rota, versão, tipo de dispositivo e etapa do onboarding. O conteúdo do calendário não é coletado.</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/70 p-3 text-sm leading-5">
              <input type="checkbox" checked={contactConsent} onChange={(event) => setContactConsent(event.target.checked)} className="mt-0.5 size-4 rounded border-input accent-primary" />
              <span>Autorizo contato pelo e-mail da minha conta sobre este feedback.</span>
            </label>
            {error ? <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={!isValidFeedbackMessage(normalizedMessage) || isSubmitting}>{isSubmitting ? "Enviando..." : "Enviar feedback"}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
