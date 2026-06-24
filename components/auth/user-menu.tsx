"use client";

import { useState } from "react";
import { CreditCard, Crown, Download, ExternalLink, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import { resetAllProductOnboarding } from "@/lib/onboarding";
import { exportUserData, saveSnapshot } from "@/lib/sync";
import { logDevError, logProdError } from "@/lib/safe-log";
import { useStore } from "@/lib/store";
import { useBillingStatus } from "@/lib/use-billing-status";

export function UserMenu() {
  const { notify } = useFeedback();
  const { session, signOut } = useAuth();
  const profiles = useStore((state) => state.profiles);
  const categories = useStore((state) => state.categories);
  const events = useStore((state) => state.events);
  const { billingStatus, isLoading: isBillingLoading } = useBillingStatus(
    Boolean(session)
  );
  const [open, setOpen] = useState(false);
  const [brokenAvatar, setBrokenAvatar] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isOpeningCheckout, setIsOpeningCheckout] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);

  const metadata = session?.user.metadata ?? {};
  const fullName =
    typeof metadata.full_name === "string" ? metadata.full_name : undefined;
  const shortNameRaw =
    typeof metadata.name === "string" ? metadata.name : undefined;
  const isSyntheticGoogleName = (value: string | undefined) =>
    Boolean(value && /^google_[a-z0-9]+$/i.test(value.trim()));
  const shortName = isSyntheticGoogleName(shortNameRaw)
    ? undefined
    : shortNameRaw;
  const email = session?.user.email ?? "";
  const truncatedEmail =
    email.length > 32 ? `${email.slice(0, 29).trimEnd()}...` : email;
  const displayName = fullName || shortName || truncatedEmail || "";
  const metadataAvatar =
    (typeof metadata.avatar_url === "string" && metadata.avatar_url) ||
    (typeof metadata.picture === "string" && metadata.picture) ||
    null;
  const avatarUrl = metadataAvatar;
  const fallbackInitial =
    (displayName || session?.user.email || "").trim().charAt(0).toUpperCase() || "?";
  const isPro = billingStatus.plan === "pro";
  const isCancellingPro = isPro && billingStatus.cancelAtPeriodEnd;
  const billingBadgeLabel = isBillingLoading
    ? "Plano..."
    : isCancellingPro
      ? "Cancelando em breve"
      : isPro
        ? "Pro"
        : "Free";
  const billingSummary = isPro
    ? "Múltiplos perfis, categorias ilimitadas e dark theme."
    : "1 perfil, até 5 categorias, eventos ilimitados e visão anual.";
  const billingBadgeClass = isPro
    ? "border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-100"
    : "border-border/70 bg-muted/45 text-muted-foreground";

  if (!session) return null;

  const openBillingRedirect = async (params: {
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
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha no redirecionamento.";
      logDevError(params.logKey, { message });
      logProdError("Falha ao abrir billing Stripe.");
      notify({
        tone: "error",
        title: params.errorTitle,
        description: params.errorDescription,
      });
    } finally {
      params.setLoading(false);
    }
  };

  const handleUpgrade = () =>
    openBillingRedirect({
      endpoint: "/api/billing/checkout",
      setLoading: setIsOpeningCheckout,
      logKey: "user-menu.billing.checkout",
      errorTitle: "Nao foi possivel abrir o upgrade",
      errorDescription: "Tente novamente em instantes.",
    });

  const handleManageBilling = () =>
    openBillingRedirect({
      endpoint: "/api/billing/portal",
      setLoading: setIsOpeningPortal,
      logKey: "user-menu.billing.portal",
      errorTitle: "Nao foi possivel abrir a assinatura",
      errorDescription: "Tente novamente em instantes.",
    });

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await saveSnapshot({ profiles, categories, events });
      setOpen(false);
      await signOut();
      notify({
        tone: "info",
        title: "Sessão encerrada",
        description: "Seus dados locais foram preservados antes de sair.",
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel salvar antes de sair. Tente novamente.";
      logDevError("user-menu.sign-out", { message });
      logProdError("Falha ao salvar dados antes do logout.");
      notify({
        tone: "error",
        title: "Nao foi possivel sair agora",
        description: "Falhou ao salvar seus dados antes do logout.",
      });
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-8 overflow-hidden rounded-[10px] border-border bg-card p-0 text-muted-foreground shadow-none transition-colors hover:border-foreground/18 hover:bg-muted hover:text-foreground md:h-9 md:w-9"
        >
          {avatarUrl && !brokenAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt="Perfil"
              className="h-8 w-8 rounded-[inherit] object-cover md:h-9 md:w-9"
              onError={() => setBrokenAvatar(true)}
            />
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-[inherit] bg-muted/70 text-xs text-muted-foreground md:h-9 md:w-9">
              {fallbackInitial}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 rounded-2xl border-border/80 p-4">
        <div className="space-y-3.5">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              Conta
            </p>
            <p className="truncate text-sm font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Plano
              </p>
              <span
                className={`inline-flex max-w-[9rem] items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${billingBadgeClass}`}
              >
                {billingBadgeLabel}
              </span>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              {billingSummary}
            </p>
            <div className="mt-3 space-y-1.5">
              {!isPro ? (
                <Button
                  variant="premium"
                  size="sm"
                  className="w-full justify-start rounded-xl"
                  disabled={isOpeningCheckout || isOpeningPortal}
                  onClick={handleUpgrade}
                >
                  <Crown size={14} className="mr-2" />
                  {isOpeningCheckout ? "Abrindo..." : "Upgrade para Pro"}
                </Button>
              ) : null}

              {billingStatus.canManageBilling ? (
                <Button
                  variant={isPro ? "ghost" : "outline"}
                  size="sm"
                  className="w-full justify-start rounded-xl"
                  disabled={isOpeningCheckout || isOpeningPortal}
                  onClick={handleManageBilling}
                >
                  <CreditCard size={14} className="mr-2" />
                  {isOpeningPortal ? "Abrindo..." : "Gerenciar assinatura"}
                  <ExternalLink size={12} className="ml-auto" />
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start rounded-xl"
              disabled={isExporting}
              onClick={async () => {
                try {
                  setIsExporting(true);
                  await exportUserData();
                  setOpen(false);
                  notify({
                    tone: "success",
                    title: "Exportação iniciada",
                    description: "Seu arquivo será preparado e baixado em seguida.",
                  });
                } catch (error) {
                  const message =
                    error instanceof Error
                      ? error.message
                      : "Falhou ao exportar. Tente novamente.";
                  logDevError("user-menu.export", { message });
                  logProdError("Falha ao exportar dados do usuario.");
                  notify({
                    tone: "error",
                    title: "Falha ao exportar",
                    description: "Tente novamente em instantes.",
                  });
                } finally {
                  setIsExporting(false);
                }
              }}
            >
              <Download size={14} className="mr-2" />
              {isExporting ? "Exportando..." : "Exportar dados"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start rounded-xl"
              onClick={() => {
                resetAllProductOnboarding();
                setOpen(false);
                notify({
                  tone: "success",
                  title: "Tour reiniciado",
                  description: "As dicas iniciais voltaram a ficar disponíveis.",
                });
              }}
            >
              <Sparkles size={14} className="mr-2" />
              Refazer tour
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start rounded-xl"
              onClick={handleSignOut}
              disabled={isSigningOut}
            >
              <LogOut size={14} className="mr-2" />
              {isSigningOut ? "Saindo..." : "Sair"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
