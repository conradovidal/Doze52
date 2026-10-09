"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, CircleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { EMAIL_LINK_VALIDITY_MINUTES } from "@/lib/email-confirmation";

// Para onde o link do e-mail de confirmação leva. Abre muitas vezes numa janela
// interna do app de e-mail (que compartilha sessão e armazenamento com o
// navegador) e NÃO carrega o app: se carregasse, essa janela e a aba onde a
// pessoa se cadastrou entrariam ao mesmo tempo e brigariam pela sincronização.
// Quem entra, com o rascunho do onboarding, é a aba original, que percebe a
// confirmação sozinha.
export default function ConfirmedClient() {
  const { session, loading } = useAuth();
  const [closeFailed, setCloseFailed] = React.useState(false);

  if (loading) return <main className="min-h-dvh" aria-busy="true" />;

  const confirmed = Boolean(session);

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
      {confirmed ? (
        <CheckCircle2 className="size-12 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
      ) : (
        <CircleAlert className="size-12 text-amber-600 dark:text-amber-400" aria-hidden="true" />
      )}
      <h1 className="text-xl font-semibold text-foreground" data-confirmation-result={confirmed ? "ok" : "failed"}>
        {confirmed ? "E-mail confirmado" : "Não deu para confirmar"}
      </h1>
      <p className="text-sm leading-6 text-muted-foreground">
        {confirmed
          ? "Pronto! Volte para o Doze 52, onde você começou: sua conta já está ativa e seu ano será salvo por lá."
          : `Este link pode ter expirado (ele vale por ${EMAIL_LINK_VALIDITY_MINUTES} minutos) ou já ter sido usado. Volte ao Doze 52 e toque em "Reenviar e-mail".`}
      </p>
      <Button
        type="button"
        className="w-full"
        onClick={() => {
          window.close();
          // Só fecha janelas abertas por script; nas outras, avisa.
          window.setTimeout(() => setCloseFailed(true), 300);
        }}
      >
        Ok
      </Button>
      {closeFailed ? (
        <p className="text-xs text-muted-foreground">Pode fechar esta janela e voltar ao app.</p>
      ) : null}
      <Link
        href="/"
        className="text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Abrir o Doze 52 aqui
      </Link>
    </main>
  );
}
