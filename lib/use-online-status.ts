"use client";

import * as React from "react";

const subscribe = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

// `navigator.onLine` só acusa "sem rede" quando o aparelho está desconectado
// (modo avião, sem Wi-Fi). Wi-Fi sem internet segue contando como online, e aí
// vale o erro de rede do próprio sync.
export function useIsOffline() {
  return React.useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false
  );
}
