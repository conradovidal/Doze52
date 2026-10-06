"use client";

import * as React from "react";

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

// Registra o service worker (só em produção: em `next dev` ele atrapalharia o
// hot reload) e o mantém em dia: a versão nova instala em segundo plano e
// espera. Quem avisa a pessoa e a ativa é o selo "Atualizar" do logo
// (lib/use-app-update.ts), via applyAppUpdate.
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    let interval: number | undefined;

    const checkForUpdate = () => {
      registration?.update().catch(() => {
        // Sem rede: tenta de novo na próxima checagem.
      });
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .then((next) => {
          registration = next;
          interval = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
          document.addEventListener("visibilitychange", onVisibility);
        })
        .catch(() => {
          // Sem SW o app continua funcionando online, como antes.
        });
    };

    // Depois do load, para não competir com a primeira renderização.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => {
      window.removeEventListener("load", register);
      document.removeEventListener("visibilitychange", onVisibility);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);

  return null;
}
