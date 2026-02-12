"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";

export default function AuthPopupCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");
  const isSuccess = status !== "error";
  const [hasOpener, setHasOpener] = React.useState(false);

  React.useEffect(() => {
    const opener = window.opener;
    setHasOpener(Boolean(opener));

    if (opener) {
      if (isSuccess) {
        opener.postMessage(
          { type: "SUPABASE_AUTH_SUCCESS" },
          window.location.origin
        );
      } else {
        opener.postMessage(
          { type: "SUPABASE_AUTH_ERROR", error: "oauth_callback_failed" },
          window.location.origin
        );
      }
      window.close();
      return;
    }

    if (isSuccess) {
      router.replace("/");
    }
  }, [isSuccess, router]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      {hasOpener ? (
        <p className="text-sm text-neutral-600">You can close this window.</p>
      ) : isSuccess ? (
        <p className="text-sm text-neutral-600">Redirecionando...</p>
      ) : (
        <div className="space-y-2 text-center">
          <p className="text-sm text-neutral-600">
            Falha no login. Feche esta janela e tente novamente.
          </p>
          <Link href="/" className="text-sm text-neutral-700 underline">
            Voltar para o inicio
          </Link>
        </div>
      )}
    </main>
  );
}
