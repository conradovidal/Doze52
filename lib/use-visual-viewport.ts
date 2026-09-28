"use client";

import * as React from "react";

// No celular o teclado virtual não encolhe a página (Android e iOS só
// encolhem a "visual viewport"), então um diálogo `fixed` centrado em 50% da
// tela fica exatamente atrás do teclado. Estas variáveis descrevem a área que
// continua visível — topo e altura — para o diálogo se centrar nela e subir
// junto quando o teclado abre.
//
// --vv-top: deslocamento da área visível em relação ao topo do layout.
// --vv-height: altura da área visível (sem o teclado).
//
// Vários diálogos podem estar montados ao mesmo tempo; o contador garante
// um único listener e que as variáveis só saiam quando o último desmontar.
let subscribers = 0;
let detach: (() => void) | null = null;

const attach = () => {
  const viewport = window.visualViewport;
  if (!viewport) return null;
  const root = document.documentElement;
  let frame = 0;
  const sync = () => {
    frame = 0;
    root.style.setProperty("--vv-top", `${viewport.offsetTop}px`);
    root.style.setProperty("--vv-height", `${viewport.height}px`);
  };
  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(sync);
  };
  sync();
  viewport.addEventListener("resize", schedule);
  viewport.addEventListener("scroll", schedule);
  return () => {
    if (frame) window.cancelAnimationFrame(frame);
    viewport.removeEventListener("resize", schedule);
    viewport.removeEventListener("scroll", schedule);
    root.style.removeProperty("--vv-top");
    root.style.removeProperty("--vv-height");
  };
};

export function useVisualViewportCssVars(active = true) {
  React.useEffect(() => {
    if (!active) return;
    subscribers += 1;
    if (subscribers === 1) detach = attach();
    return () => {
      subscribers -= 1;
      if (subscribers === 0) {
        detach?.();
        detach = null;
      }
    };
  }, [active]);
}
