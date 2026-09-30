"use client";

import * as React from "react";

const CURRENT_BUILD_ID = process.env.NEXT_PUBLIC_APP_BUILD_ID ?? "local";
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Avisa quando um deploy novo entrou no ar enquanto a aba continua aberta.
 * Confere ao voltar para a aba e a cada poucos minutos. Em desenvolvimento
 * (build "local") nunca sinaliza.
 */
export function useAppUpdateAvailable() {
  const [updateAvailable, setUpdateAvailable] = React.useState(false);

  React.useEffect(() => {
    if (CURRENT_BUILD_ID === "local" || updateAvailable) return;

    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch("/api/version", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { buildId?: string };
        if (!cancelled && data.buildId && data.buildId !== CURRENT_BUILD_ID) {
          setUpdateAvailable(true);
        }
      } catch {
        // Sem rede agora: tenta de novo na próxima checagem.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };

    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [updateAvailable]);

  return updateAvailable;
}
