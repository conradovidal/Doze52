"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";

export default function PopupCallbackClient() {
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const isSuccess = useMemo(() => status !== "error", [status]);

  useEffect(() => {
    if (window.opener) {
      window.opener.postMessage(
        isSuccess
          ? { type: "SUPABASE_AUTH_SUCCESS" }
          : { type: "SUPABASE_AUTH_ERROR", error: "oauth_callback_failed" },
        window.location.origin
      );
      window.close();
      return;
    }
  }, [isSuccess]);

  if (isSuccess) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <p className="text-sm text-neutral-600">
          Login concluido. Voce pode fechar esta janela.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="space-y-2 text-center">
        <p className="text-sm text-neutral-600">
          Falha no login. Feche esta janela e tente novamente.
        </p>
        <Link href="/" className="text-sm text-neutral-700 underline">
          Voltar para o inicio
        </Link>
      </div>
    </main>
  );
}
