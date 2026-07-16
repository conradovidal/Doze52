"use client";

import { type ComponentProps, type ReactNode, useState } from "react";
import {
  CreditCard,
  Download,
  LogOut,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeedback } from "@/components/ui/feedback-provider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth";
import { resetAllProductOnboarding } from "@/lib/onboarding";
import { exportUserData, saveSnapshot } from "@/lib/sync";
import { logDevError, logProdError } from "@/lib/safe-log";
import { useStore } from "@/lib/store";
import { useBilling } from "@/lib/use-billing";
import { cn } from "@/lib/utils";

function MenuSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      {children}
    </section>
  );
}

function MenuAction({
  icon: Icon,
  children,
  className,
  danger = false,
  ...props
}: ComponentProps<typeof Button> & {
  icon: LucideIcon;
  danger?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        "h-9 w-full justify-start rounded-[10px] px-2.5 text-[13px] font-medium text-foreground shadow-none hover:bg-muted/70",
        danger &&
          "text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-200 dark:hover:bg-rose-500/12 dark:hover:text-rose-100",
        className
      )}
      {...props}
    >
      <Icon
        className={cn(
          "size-4 text-muted-foreground",
          danger && "text-rose-500 dark:text-rose-300"
        )}
      />
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
    </Button>
  );
}

export function UserMenu() {
  const { notify } = useFeedback();
  const { session, signOut } = useAuth();
  const profiles = useStore((state) => state.profiles);
  const categories = useStore((state) => state.categories);
  const events = useStore((state) => state.events);
  const {
    billingStatus,
    isPro,
    isLoading: isBillingLoading,
    error: billingError,
    isOpeningCheckout,
    isOpeningPortal,
    isPlanActionLoading,
    openCheckout,
    openPortal,
  } = useBilling();
  const [open, setOpen] = useState(false);
  const [brokenAvatar, setBrokenAvatar] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
  const periodEndDate = billingStatus.currentPeriodEnd
    ? new Date(billingStatus.currentPeriodEnd)
    : null;
  const formattedPeriodEnd =
    periodEndDate && !Number.isNaN(periodEndDate.getTime())
      ? new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(periodEndDate)
      : null;
  const hasBillingError = Boolean(billingError);
  const planLabel = isBillingLoading
    ? "Carregando..."
    : hasBillingError
      ? "Plano indisponivel"
      : isPro
        ? "Doze52 Pro"
        : "Plano Free";
  const planDescription = hasBillingError
    ? "Nao foi possivel carregar o status do plano."
    : isPro
      ? billingStatus.cancelAtPeriodEnd && formattedPeriodEnd
        ? `Pro ativo até ${formattedPeriodEnd}.`
        : "Perfis e categorias sem limite prático. Calendários ilimitados."
      : "1 perfil, 3 categorias e 1 calendário.";
  const planActionLabel = isBillingLoading
    ? "Carregando..."
    : hasBillingError
      ? "Indisponivel"
      : isOpeningCheckout || isOpeningPortal
        ? "Abrindo..."
        : isPro
          ? "Gerenciar assinatura"
          : "Assinar Pro";
  const isPlanActionDisabled = isPlanActionLoading || hasBillingError;

  if (!session) return null;

  const handlePlanAction = async () => {
    const opened = isPro ? await openPortal() : await openCheckout();
    if (opened) setOpen(false);
  };

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
          aria-label="Abrir menu da conta"
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
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[19.5rem] rounded-[16px] border-border/80 p-3 shadow-[0_22px_55px_-34px_rgba(15,23,42,0.42)]"
      >
        <div className="space-y-4">
          <MenuSection title="Conta">
            <div className="rounded-[12px] bg-muted/28 px-3 py-2.5">
              <p className="truncate text-sm font-semibold leading-5 text-foreground">
                {displayName}
              </p>
              <p className="truncate text-xs leading-5 text-muted-foreground">
                {email}
              </p>
            </div>
          </MenuSection>

          <MenuSection title="Plano">
            <div className="rounded-[12px] border border-border/70 bg-card px-3 py-3 shadow-[0_12px_26px_-26px_rgba(15,23,42,0.35)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold leading-5 text-foreground">
                      {planLabel}
                    </p>
                    {isPro ? (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold leading-4 text-emerald-800 dark:border-emerald-300/20 dark:bg-emerald-300/10 dark:text-emerald-100">
                        Pro
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {planDescription}
                  </p>
                </div>
                <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 h-8 w-full rounded-[10px] border-border bg-background px-2.5 text-xs font-semibold text-foreground shadow-none hover:border-foreground/18 hover:bg-muted"
                disabled={isPlanActionDisabled}
                onClick={handlePlanAction}
              >
                <CreditCard className="size-4 text-muted-foreground" />
                {planActionLabel}
              </Button>
            </div>
          </MenuSection>

          <MenuSection title="Dados">
            <MenuAction
              icon={Download}
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
              {isExporting ? "Exportando..." : "Exportar dados"}
            </MenuAction>
          </MenuSection>

          <MenuSection title="Ajuda">
            <MenuAction
              icon={RotateCcw}
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
              Refazer tour
            </MenuAction>
          </MenuSection>

          <MenuSection title="Sessão">
            <MenuAction
              icon={LogOut}
              onClick={handleSignOut}
              disabled={isSigningOut}
              danger
            >
              {isSigningOut ? "Saindo..." : "Sair"}
            </MenuAction>
          </MenuSection>
        </div>
      </PopoverContent>
    </Popover>
  );
}
