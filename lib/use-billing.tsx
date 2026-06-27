"use client";

import * as React from "react";

import {
  getPlanLimits,
  isProPlan,
  type BillingStatusPayload,
  type PlanLimits,
} from "@/lib/entitlements";
import { useAuth } from "@/lib/auth";
import { logDevError, logProdError } from "@/lib/safe-log";
import {
  FREE_BILLING_STATUS,
  useBillingStatus,
} from "@/lib/use-billing-status";
import { useFeedback } from "@/components/ui/feedback-provider";

type BillingActionOptions = {
  onAuthRequired?: () => void;
};

type BillingContextValue = {
  billingStatus: BillingStatusPayload;
  limits: PlanLimits;
  isPro: boolean;
  isLoading: boolean;
  error: Error | null;
  isOpeningCheckout: boolean;
  isOpeningPortal: boolean;
  isPlanActionLoading: boolean;
  refreshBillingStatus: (signal?: AbortSignal) => Promise<BillingStatusPayload>;
  openCheckout: (options?: BillingActionOptions) => Promise<boolean>;
  openPortal: (options?: BillingActionOptions) => Promise<boolean>;
};

const BillingContext = React.createContext<BillingContextValue | null>(null);

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { notify } = useFeedback();
  const { session } = useAuth();
  const { billingStatus, isLoading, error, refreshBillingStatus } =
    useBillingStatus(Boolean(session));
  const [isOpeningCheckout, setIsOpeningCheckout] = React.useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = React.useState(false);

  const requireSession = React.useCallback(
    (options?: BillingActionOptions) => {
      if (session) return true;

      options?.onAuthRequired?.();
      notify({
        tone: "info",
        title: "Entre para assinar",
        description: "Depois do login, você pode ativar o Doze52 Pro.",
      });
      return false;
    },
    [notify, session]
  );

  const openBillingRedirect = React.useCallback(
    async (params: {
      endpoint: "/api/billing/checkout" | "/api/billing/portal";
      setLoading: (loading: boolean) => void;
      logKey: string;
      errorTitle: string;
      errorDescription: string;
    }) => {
      try {
        params.setLoading(true);
        const response = await fetch(params.endpoint, { method: "POST" });
        const payload = (await response.json().catch(() => null)) as {
          url?: unknown;
        } | null;

        if (!response.ok || typeof payload?.url !== "string") {
          throw new Error("Billing redirect URL missing.");
        }

        window.location.href = payload.url;
        return true;
      } catch (caughtError) {
        const message =
          caughtError instanceof Error
            ? caughtError.message
            : "Falha no redirecionamento.";
        logDevError(params.logKey, { message });
        logProdError("Falha ao abrir billing Stripe.");
        notify({
          tone: "error",
          title: params.errorTitle,
          description: params.errorDescription,
        });
        return false;
      } finally {
        params.setLoading(false);
      }
    },
    [notify]
  );

  const openCheckout = React.useCallback(
    async (options?: BillingActionOptions) => {
      if (!requireSession(options)) return false;

      return openBillingRedirect({
        endpoint: "/api/billing/checkout",
        setLoading: setIsOpeningCheckout,
        logKey: "billing.checkout",
        errorTitle: "Nao foi possivel abrir o upgrade",
        errorDescription: "Tente novamente em instantes.",
      });
    },
    [openBillingRedirect, requireSession]
  );

  const openPortal = React.useCallback(
    async (options?: BillingActionOptions) => {
      if (!requireSession(options)) return false;

      return openBillingRedirect({
        endpoint: "/api/billing/portal",
        setLoading: setIsOpeningPortal,
        logKey: "billing.portal",
        errorTitle: "Nao foi possivel abrir a assinatura",
        errorDescription: "Tente novamente em instantes.",
      });
    },
    [openBillingRedirect, requireSession]
  );

  const value = React.useMemo<BillingContextValue>(() => {
    const isPro = isProPlan(billingStatus.plan);
    return {
      billingStatus,
      limits: getPlanLimits(billingStatus.plan),
      isPro,
      isLoading,
      error,
      isOpeningCheckout,
      isOpeningPortal,
      isPlanActionLoading: isLoading || isOpeningCheckout || isOpeningPortal,
      refreshBillingStatus,
      openCheckout,
      openPortal,
    };
  }, [
    billingStatus,
    error,
    isLoading,
    isOpeningCheckout,
    isOpeningPortal,
    openCheckout,
    openPortal,
    refreshBillingStatus,
  ]);

  return (
    <BillingContext.Provider value={value}>{children}</BillingContext.Provider>
  );
}

export function useBilling() {
  const context = React.useContext(BillingContext);
  if (!context) {
    return {
      billingStatus: FREE_BILLING_STATUS,
      limits: getPlanLimits("free"),
      isPro: false,
      isLoading: false,
      error: null,
      isOpeningCheckout: false,
      isOpeningPortal: false,
      isPlanActionLoading: false,
      refreshBillingStatus: async () => FREE_BILLING_STATUS,
      openCheckout: async () => false,
      openPortal: async () => false,
    } satisfies BillingContextValue;
  }
  return context;
}
