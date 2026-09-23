"use client";

import * as React from "react";
import type { ProUpgradeReason } from "@/lib/entitlements";

// Convite ao Pro fora dos bloqueios: quando a pessoa acaba de usar a última
// vaga gratuita de algo (a 3ª categoria, o 1º hábito), aparece um aviso leve
// com "Conhecer o Pro", no máximo uma vez por motivo a cada
// NUDGE_COOLDOWN_DAYS — é o momento em que o valor está mais claro, sem
// interromper o que ela está fazendo.

const OPEN_EVENT = "doze52:pro-upgrade:open";
const NUDGE_STORAGE_PREFIX = "doze52:pro-upgrade:nudged";
const NUDGE_COOLDOWN_DAYS = 7;

/** Abre o convite do Pro de qualquer lugar (ver GlobalProUpgradeDialog). */
export const requestProUpgrade = (reason: ProUpgradeReason) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { reason } }));
};

export const useProUpgradeRequests = (
  onRequest: (reason: ProUpgradeReason) => void
) => {
  const handlerRef = React.useRef(onRequest);
  React.useEffect(() => {
    handlerRef.current = onRequest;
  }, [onRequest]);
  React.useEffect(() => {
    const listener = (event: Event) => {
      const reason = (event as CustomEvent<{ reason?: ProUpgradeReason }>)
        .detail?.reason;
      handlerRef.current(reason ?? "generic");
    };
    window.addEventListener(OPEN_EVENT, listener);
    return () => window.removeEventListener(OPEN_EVENT, listener);
  }, []);
};

const LAST_SLOT_MESSAGES: Partial<
  Record<ProUpgradeReason, { title: string; description: string }>
> = {
  categories: {
    title: "Você usou suas 3 categorias gratuitas",
    description: "Com o Pro, seu ano ganha quantas categorias precisar.",
  },
  habits: {
    title: "Seu hábito gratuito está no ar",
    description: "Com o Pro, você acompanha até 4 rotinas no mesmo ano.",
  },
};

type Notify = (input: {
  tone: "info";
  title: string;
  description: string;
  durationMs: number;
  action: { label: string; onClick: () => void };
}) => unknown;

/**
 * Chame logo depois de criar um item. Só avisa quando esse item ocupou a
 * última vaga gratuita, e respeita o intervalo entre avisos do mesmo motivo.
 */
export const nudgeProAtLastFreeSlot = ({
  reason,
  countAfter,
  limit,
  isPro,
  notify,
}: {
  reason: "categories" | "habits";
  countAfter: number;
  limit: number | null;
  isPro: boolean;
  notify: Notify;
}) => {
  if (isPro || typeof limit !== "number" || countAfter !== limit) return;
  const message = LAST_SLOT_MESSAGES[reason];
  if (!message) return;

  const key = `${NUDGE_STORAGE_PREFIX}:${reason}`;
  try {
    const last = Number(window.localStorage.getItem(key) ?? 0);
    if (Date.now() - last < NUDGE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000) return;
    window.localStorage.setItem(key, String(Date.now()));
  } catch {
    // Sem storage, avisa mesmo assim: o pior caso é repetir numa sessão nova.
  }

  notify({
    tone: "info",
    title: message.title,
    description: message.description,
    durationMs: 9000,
    action: { label: "Conhecer o Pro", onClick: () => requestProUpgrade(reason) },
  });
};
