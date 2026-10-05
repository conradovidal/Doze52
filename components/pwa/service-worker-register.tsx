"use client";

import * as React from "react";

// Só em produção: em `next dev` o SW atrapalharia o hot reload.
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          // Sem SW o app continua funcionando online, como antes.
        });
    };

    // Depois do load, para não competir com a primeira renderização.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
