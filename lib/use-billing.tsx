"use client";

import * as React from "react";

import {
  getPlanLimits,
  isProPlan,
  type BillingStatusPayload,
  type PlanLimits,
} from "@/lib/entitlements";
import {
  getBillingTestError,
  getBillingTestMode,
  getBillingTestStatus,
} from "@/lib/billing-test-mode";
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
  const billingTestMode = getBillingTestMode();
  const billingTestPlan = billingTestMode?.plan ?? null;
  const isBillingTestMode = billingTestPlan !== null;
  const {
    billingStatus: realBillingStatus,
    isLoading: realIsLoading,
    error: realError,
    refreshBillingStatus: refreshRealBillingStatus,
  } = useBillingStatus(Boolean(session) && !isBillingTestMode);
  const testBillingStatus = React.useMemo(
    () => (billingTestPlan ? getBillingTestStatus(billingTestPlan) : null),
    [billingTestPlan]
  );
  const testBillingError = React.useMemo(
    () => (billingTestPlan ? getBillingTestError(billingTestPlan) : null),
    [billingTestPlan]
  );
  const billingStatus = testBillingStatus ?? realBillingStatus;
  const isLoading =
    billingTestPlan === "loading" ? true : !isBillingTestMode && realIsLoading;
  const error = testBillingError ?? (!isBillingTestMode ? realError : null);
  const [isOpeningCheckout, setIsOpeningCheckout] = React.useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = React.useState(false);

  const notifyBillingTestMode = React.useCallback(() => {
    notify({
      tone: "info",
      title: "Billing test mode ativo",
      description:
        "Desative NEXT_PUBLIC_BILLING_TEST_MODE para testar Stripe real.",
    });
  }, [notify]);

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
      if (isBillingTestMode) {
        notifyBillingTestMode();
        return false;
      }

      if (!requireSession(options)) return false;

      return openBillingRedirect({
        endpoint: "/api/billing/checkout",
        setLoading: setIsOpeningCheckout,
        logKey: "billing.checkout",
        errorTitle: "Nao foi possivel abrir o upgrade",
        errorDescription: "Tente novamente em instantes.",
      });
    },
    [
      isBillingTestMode,
      notifyBillingTestMode,
      openBillingRedirect,
      requireSession,
    ]
  );

  const openPortal = React.useCallback(
    async (options?: BillingActionOptions) => {
      if (isBillingTestMode) {
        notifyBillingTestMode();
        return false;
      }

      if (!requireSession(options)) return false;

      return openBillingRedirect({
        endpoint: "/api/billing/portal",
        setLoading: setIsOpeningPortal,
        logKey: "billing.portal",
        errorTitle: "Nao foi possivel abrir a assinatura",
        errorDescription: "Tente novamente em instantes.",
      });
    },
    [
      isBillingTestMode,
      notifyBillingTestMode,
      openBillingRedirect,
      requireSession,
    ]
  );

  const refreshBillingStatus = React.useCallback(
    async (signal?: AbortSignal) => {
      if (testBillingStatus) {
        if (testBillingError) throw testBillingError;
        return testBillingStatus;
      }

      return refreshRealBillingStatus(signal);
    },
    [refreshRealBillingStatus, testBillingError, testBillingStatus]
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
    <BillingContext.Provider value={value}>
      {children}
      {billingTestMode ? (
        <BillingTestModeBadge label={billingTestMode.label} />
      ) : null}
    </BillingContext.Provider>
  );
}

function BillingTestModeBadge({ label }: { label: string }) {
  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-[80] rounded-[10px] border border-amber-500/30 bg-amber-50/95 px-2.5 py-1 text-[11px] font-semibold leading-4 text-amber-950 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.5)] dark:border-amber-300/25 dark:bg-amber-300/12 dark:text-amber-50">
      Billing test mode: {label}
    </div>
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
