"use client";

import * as React from "react";

export type BillingPlan = "free" | "pro";

export type BillingStatusPayload = {
  plan: BillingPlan;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canManageBilling: boolean;
};

const FREE_BILLING_STATUS: BillingStatusPayload = {
  plan: "free",
  status: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  canManageBilling: false,
};

const isBillingStatusPayload = (
  value: unknown
): value is BillingStatusPayload => {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;

  return (
    (record.plan === "free" || record.plan === "pro") &&
    (record.status === null || typeof record.status === "string") &&
    (record.currentPeriodEnd === null ||
      typeof record.currentPeriodEnd === "string") &&
    typeof record.cancelAtPeriodEnd === "boolean" &&
    typeof record.canManageBilling === "boolean"
  );
};

export const useBillingStatus = (enabled: boolean) => {
  const [billingStatus, setBillingStatus] =
    React.useState<BillingStatusPayload>(FREE_BILLING_STATUS);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const refreshBillingStatus = React.useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) {
        setBillingStatus(FREE_BILLING_STATUS);
        setIsLoading(false);
        setError(null);
        return FREE_BILLING_STATUS;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/billing/status", {
          method: "GET",
          cache: "no-store",
          signal,
        });
        const payload = (await response.json().catch(() => null)) as unknown;

        if (!response.ok || !isBillingStatusPayload(payload)) {
          throw new Error("Nao foi possivel carregar o status da assinatura.");
        }

        setBillingStatus(payload);
        return payload;
      } catch (caughtError) {
        if (caughtError instanceof DOMException && caughtError.name === "AbortError") {
          return FREE_BILLING_STATUS;
        }

        const nextError =
          caughtError instanceof Error
            ? caughtError
            : new Error("Nao foi possivel carregar o status da assinatura.");
        setError(nextError);
        throw nextError;
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [enabled]
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void refreshBillingStatus(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [refreshBillingStatus]);

  return {
    billingStatus,
    isLoading,
    error,
    refreshBillingStatus,
  };
};
