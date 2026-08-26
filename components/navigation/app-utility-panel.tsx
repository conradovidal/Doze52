"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeInfo,
  CalendarCog,
  CircleUserRound,
  CreditCard,
  Database,
  ExternalLink,
  FileSpreadsheet,
  Github,
  HelpCircle,
  Instagram,
  LogIn,
  LogOut,
  MessageSquareText,
  Palette,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { ProUpgradeDialog } from "@/components/billing/pro-upgrade-dialog";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import type { UtilityPanelSection } from "@/components/navigation/adaptive-navigation";
import {
  GuidedToolbarNoticeCard,
  type GuidedToolbarNotice,
} from "@/components/onboarding/guided-toolbar-notice";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback-provider";
import { useAuth } from "@/lib/auth";
import { isCalendarSpreadsheetProGateEnabled } from "@/lib/entitlements";
import { logDevError, logProdError } from "@/lib/safe-log";
import { useStore } from "@/lib/store";
import { saveSnapshot } from "@/lib/sync";
import { useBilling } from "@/lib/use-billing";
import { cn } from "@/lib/utils";

const CalendarSpreadsheetDialog = dynamic(
  () =>
    import("@/components/calendar-spreadsheet-dialog").then(
      (module) => module.CalendarSpreadsheetDialog
    ),
  { ssr: false }
);

type AdminCapabilities = { feedback: boolean; calendarPacks: boolean };
const EMPTY_ADMIN_CAPABILITIES: AdminCapabilities = {
  feedback: false,
  calendarPacks: false,
};
const SUPPORT_EMAIL = "doze52cal@gmail.com";

const TOPICS: ReadonlyArray<{
  id: UtilityPanelSection;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { id: "account", label: "Conta", description: "Identidade e sessão", icon: CircleUserRound },
  { id: "plan", label: "Plano", description: "Free ou Pro", icon: Sparkles },
  { id: "appearance", label: "Aparência", description: "Tema da aplicação", icon: Palette },
  { id: "data", label: "Dados", description: "Importação e exportação", icon: Database },
  { id: "help", label: "Ajuda", description: "Feedback e contato", icon: HelpCircle },
  { id: "about", label: "Sobre", description: "Doze 52 e canais", icon: BadgeInfo },
  { id: "admin", label: "Admin", description: "Ferramentas internas", icon: ShieldCheck },
];

function BrandXIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.9 2h3.1l-6.78 7.75L23.2 22h-6.27l-4.91-6.4L6.4 22H3.3l7.24-8.28L.8 2h6.43l4.44 5.85L18.9 2Zm-1.1 18h1.72L6.29 3.9H4.45L17.8 20Z" />
    </svg>
  );
}

function PanelAction({
  icon: Icon,
  children,
  danger = false,
  ...props
}: React.ComponentProps<typeof Button> & { icon: LucideIcon; danger?: boolean }) {
  return (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "h-11 w-full justify-start rounded-xl px-3 text-sm font-medium shadow-none",
        danger && "text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:text-rose-200 dark:hover:bg-rose-500/12"
      )}
      {...props}
    >
      <Icon className={cn("size-4 text-muted-foreground", danger && "text-rose-500")} />
      <span className="min-w-0 flex-1 truncate text-left">{children}</span>
    </Button>
  );
}

function AccountAvatar({
  avatarUrl,
  displayName,
  isPro,
}: {
  avatarUrl: string | null;
  displayName: string;
  isPro: boolean;
}) {
  const [brokenAvatar, setBrokenAvatar] = React.useState(false);
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  const className = cn(
    "size-20 rounded-2xl",
    isPro && "ring-2 ring-amber-400 ring-offset-2 ring-offset-background"
  );

  if (avatarUrl && !brokenAvatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className={cn(className, "object-cover")} onError={() => setBrokenAvatar(true)} />
    );
  }

  return (
    <span className={cn(className, "grid place-items-center bg-foreground text-2xl font-semibold text-background")}>
      {initial}
    </span>
  );
}

type AppUtilityPanelProps = {
  open: boolean;
  section: UtilityPanelSection;
  isMobile: boolean;
  returnFocusRef: React.RefObject<HTMLElement | null>;
  guidedThemeNotice?: GuidedToolbarNotice | null;
  guidedAppearanceNotice?: GuidedToolbarNotice | null;
  onOpenChange: (open: boolean) => void;
  onOpenAuthDialog: () => void;
  onDismissGuidedNotice?: () => void;
  onGuidedThemeAction?: () => void;
  onGuidedThemeChange?: () => void;
  onGuidedAppearanceOpen?: () => void;
};

export function AppUtilityPanel({
  open,
  section,
  isMobile,
  returnFocusRef,
  guidedThemeNotice = null,
  guidedAppearanceNotice = null,
  onOpenChange,
  onOpenAuthDialog,
  onDismissGuidedNotice,
  onGuidedThemeAction,
  onGuidedThemeChange,
  onGuidedAppearanceOpen,
}: AppUtilityPanelProps) {
  const router = useRouter();
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
  const [activeSection, setActiveSection] = React.useState<UtilityPanelSection>(section);
  const [mobileDetailOpen, setMobileDetailOpen] = React.useState(false);
  const [adminCapabilities, setAdminCapabilities] = React.useState<AdminCapabilities>(EMPTY_ADMIN_CAPABILITIES);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [spreadsheetOpen, setSpreadsheetOpen] = React.useState(false);
  const [spreadsheetUpgradeOpen, setSpreadsheetUpgradeOpen] = React.useState(false);
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  const spreadsheetRequiresPro = isCalendarSpreadsheetProGateEnabled();

  React.useEffect(() => {
    if (!open) return;
    setActiveSection(section);
    setMobileDetailOpen(section !== "account");
  }, [open, section]);

  React.useEffect(() => {
    if (!open || !session) {
      setAdminCapabilities(EMPTY_ADMIN_CAPABILITIES);
      return;
    }
    const controller = new AbortController();
    void fetch("/api/admin/access", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : EMPTY_ADMIN_CAPABILITIES))
      .then((result: Partial<AdminCapabilities>) => {
        setAdminCapabilities({ feedback: Boolean(result.feedback), calendarPacks: Boolean(result.calendarPacks) });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAdminCapabilities(EMPTY_ADMIN_CAPABILITIES);
      });
    return () => controller.abort();
  }, [open, session]);

  const metadata = session?.user.metadata ?? {};
  const rawName =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    "";
  const displayName = rawName && !/^google_[a-z0-9]+$/i.test(rawName.trim())
    ? rawName
    : session?.user.email || "Visitante";
  const email = session?.user.email ?? "";
  const avatarUrl =
    (typeof metadata.avatar_url === "string" && metadata.avatar_url) ||
    (typeof metadata.picture === "string" && metadata.picture) ||
    null;
  const showProIdentity = Boolean(session && isPro && !isBillingLoading && !billingError);
  const periodEndDate = billingStatus.currentPeriodEnd ? new Date(billingStatus.currentPeriodEnd) : null;
  const formattedPeriodEnd =
    periodEndDate && !Number.isNaN(periodEndDate.getTime())
      ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(periodEndDate)
      : null;
  const hasBillingError = Boolean(billingError);
  const planLabel = isBillingLoading ? "Carregando..." : hasBillingError ? "Plano indisponível" : isPro ? "Doze 52 Pro" : "Plano Free";
  const planDescription = hasBillingError
    ? "Não foi possível carregar o status do plano."
    : isPro
      ? billingStatus.cancelAtPeriodEnd && formattedPeriodEnd
        ? `Pro ativo até ${formattedPeriodEnd}.`
        : "Até 4 hábitos, contextos ampliados e calendários ilimitados."
      : "1 hábito, 1 contexto, 3 categorias e 1 calendário.";
  const planActionLabel = !session
    ? "Entrar para assinar"
    : isBillingLoading
      ? "Carregando..."
      : hasBillingError
        ? "Indisponível"
        : isOpeningCheckout || isOpeningPortal
          ? "Abrindo..."
          : isPro ? "Gerenciar assinatura" : "Assinar Pro";
  const hasAdminAccess = adminCapabilities.feedback || adminCapabilities.calendarPacks;
  const visibleTopics = TOPICS.filter((topic) => {
    if (topic.id === "data") return Boolean(session);
    if (topic.id === "admin") return hasAdminAccess;
    return true;
  });
  const activeTopic = visibleTopics.find((topic) => topic.id === activeSection) ?? visibleTopics[0];

  React.useEffect(() => {
    if (!open || !activeTopic || activeTopic.id === activeSection) return;
    setActiveSection(activeTopic.id);
  }, [activeSection, activeTopic, open]);

  const handlePlanAction = async () => {
    if (!session) {
      onOpenChange(false);
      onOpenAuthDialog();
      return;
    }
    const opened = isPro ? await openPortal() : await openCheckout();
    if (opened) onOpenChange(false);
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      await saveSnapshot({ profiles, categories, events });
      onOpenChange(false);
      await signOut();
      notify({ tone: "info", title: "Sessão encerrada", description: "Seus dados locais foram preservados antes de sair." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida.";
      logDevError("utility-panel.sign-out", { message });
      logProdError("Falha ao salvar dados do usuário antes do logout.");
      notify({ tone: "error", title: "Não foi possível sair agora", description: "Falhou ao salvar seus dados antes do logout." });
    } finally {
      setIsSigningOut(false);
    }
  };

  const openSpreadsheet = () => {
    onOpenChange(false);
    if (!spreadsheetRequiresPro || isPro) setSpreadsheetOpen(true);
    else setSpreadsheetUpgradeOpen(true);
  };
  const openFeedback = () => { onOpenChange(false); setFeedbackOpen(true); };
  const navigateTo = (href: string) => { onOpenChange(false); router.push(href); };

  const renderSection = () => {
    switch (activeSection) {
      case "account":
        return session ? (
          <div className="flex min-h-full flex-col items-center justify-center py-8 text-center">
            <AccountAvatar avatarUrl={avatarUrl} displayName={displayName} isPro={showProIdentity} />
            <h3 className="mt-5 text-xl font-semibold text-foreground">{displayName}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{email}</p>
            <span className={cn("mt-3 rounded-full px-2.5 py-1 text-xs font-semibold", showProIdentity ? "bg-amber-400/15 text-amber-700 dark:text-amber-200" : "bg-muted text-muted-foreground")}>{showProIdentity ? "Pro" : "Free"}</span>
            <Button type="button" variant="outline" className="mt-8 min-w-48" disabled={isSigningOut} onClick={handleSignOut}><LogOut className="size-4" />{isSigningOut ? "Saindo..." : "Sair"}</Button>
          </div>
        ) : (
          <div className="flex min-h-full flex-col items-center justify-center py-8 text-center">
            <span className="grid size-20 place-items-center rounded-2xl bg-foreground text-background"><CircleUserRound className="size-8" aria-hidden="true" /></span>
            <h3 className="mt-5 text-xl font-semibold text-foreground">Entre no Doze 52</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Sincronize seu ano e acesse plano, dados e feedback.</p>
            <Button type="button" variant="premium" className="mt-7 min-w-48" onClick={() => { onOpenChange(false); onOpenAuthDialog(); }}><LogIn className="size-4" />Entrar</Button>
          </div>
        );
      case "plan":
        return (
          <div className="max-w-xl rounded-2xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-5"><div><p className="text-lg font-semibold text-foreground">{planLabel}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{planDescription}</p></div><Sparkles className={cn("mt-1 size-5", isPro ? "text-amber-500" : "text-muted-foreground")} /></div>
            <Button type="button" variant={isPro ? "outline" : "premium"} className="mt-6" disabled={isPlanActionLoading || hasBillingError} onClick={handlePlanAction}><CreditCard className="size-4" />{planActionLabel}</Button>
          </div>
        );
      case "appearance":
        return (
          <div data-onboarding-spotlight-target={guidedThemeNotice ? "true" : undefined} className="relative flex max-w-xl items-center justify-between rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3"><Palette className="size-5 text-muted-foreground" /><div><p className="font-medium text-foreground">Tema</p><p className="text-sm text-muted-foreground">Alterne entre claro e escuro.</p></div></div>
            <ThemeToggle highlighted={Boolean(guidedThemeNotice)} onThemeChange={onGuidedThemeChange} />
          </div>
        );
      case "data":
        return (
          <div className="max-w-xl rounded-2xl border border-border bg-card p-2"><PanelAction icon={FileSpreadsheet} disabled={spreadsheetRequiresPro && isBillingLoading} onClick={openSpreadsheet}>Importar ou exportar{spreadsheetRequiresPro && !isPro && !isBillingLoading ? <span className="ml-auto rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-100">Pro</span> : null}</PanelAction></div>
        );
      case "help":
        return (
          <div className="max-w-xl space-y-3">{session ? <div className="rounded-2xl border border-border bg-card p-2"><PanelAction icon={MessageSquareText} onClick={openFeedback}>Enviar feedback</PanelAction></div> : null}<a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-sm font-medium text-foreground hover:bg-muted/60"><HelpCircle className="size-5 text-muted-foreground" />{SUPPORT_EMAIL}</a></div>
        );
      case "about":
        return (
          <div className="max-w-xl space-y-5">
            <div><h3 className="text-xl font-semibold text-foreground">Doze 52</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">Seu ano em uma página, agora também para acompanhar hábitos.</p></div>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { label: "Instagram", href: "https://instagram.com/doze.52", icon: Instagram },
                { label: "X", href: "https://x.com/doze_52", icon: BrandXIcon },
                { label: "GitHub", href: "https://github.com/conradovidal/Doze52", icon: Github },
              ].map((link) => <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium hover:bg-muted/60"><link.icon className="size-4 text-muted-foreground" />{link.label}<ExternalLink className="ml-auto size-3.5 text-muted-foreground" /></a>)}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm font-medium hover:bg-muted/60"><HelpCircle className="size-4 text-muted-foreground" />E-mail</a>
            </div>
            <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} doze52</p>
          </div>
        );
      case "admin":
        return (
          <div className="max-w-xl rounded-2xl border border-border bg-card p-2">{adminCapabilities.feedback ? <PanelAction icon={MessageSquareText} onClick={() => navigateTo("/admin/feedback")}>Painel de feedback</PanelAction> : null}{adminCapabilities.calendarPacks ? <PanelAction icon={CalendarCog} onClick={() => navigateTo("/admin/calendar-packs")}>Painel de calendários</PanelAction> : null}</div>
        );
    }
  };

  const topicButtons = (
    <nav aria-label="Tópicos de conta e configurações" className="space-y-1">
      {visibleTopics.map((topic) => {
        const Icon = topic.icon;
        const selected = activeSection === topic.id;
        return (
          <button key={topic.id} type="button" aria-current={selected ? "page" : undefined} data-onboarding-appearance-topic={topic.id === "appearance" ? "true" : undefined} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60", selected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground", guidedAppearanceNotice && topic.id === "appearance" && "guided-control-target")} onClick={() => { setActiveSection(topic.id); if (topic.id === "appearance") onGuidedAppearanceOpen?.(); if (isMobile) setMobileDetailOpen(true); }}>
            <Icon className="size-4 shrink-0" /><span className="min-w-0"><span className="block text-sm font-semibold">{topic.label}</span><span className={cn("block truncate text-[11px]", selected ? "text-background/70" : "text-muted-foreground")}>{topic.description}</span></span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-app-utility-panel
          className={cn("overflow-hidden p-0", isMobile ? "inset-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 sm:max-w-none" : "h-[min(680px,88dvh)] w-[min(880px,calc(100vw-5rem))] max-w-[880px] sm:max-w-[880px]")}
          onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusRef.current?.focus(); }}
        >
          <DialogDescription className="sr-only">Gerencie sua conta, plano, aparência, dados e canais do Doze 52.</DialogDescription>
          {isMobile ? (
            <div className="flex h-full min-h-0 flex-col">
              <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 pr-12">{mobileDetailOpen ? <button type="button" aria-label="Voltar aos tópicos" className="grid size-10 place-items-center rounded-xl hover:bg-muted" onClick={() => setMobileDetailOpen(false)}><ArrowLeft className="size-5" /></button> : null}<div><DialogTitle>{mobileDetailOpen ? activeTopic?.label : "Conta e configurações"}</DialogTitle><p className="text-xs text-muted-foreground">{mobileDetailOpen ? activeTopic?.description : "Escolha o que deseja gerenciar."}</p></div></header>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">{mobileDetailOpen ? renderSection() : topicButtons}</div>
            </div>
          ) : (
            <div className="grid h-full min-h-0 grid-cols-[220px_minmax(0,1fr)]">
              <aside className="min-h-0 border-r border-border bg-muted/24 p-3"><div className="px-3 pt-2 pb-5"><DialogTitle>Configurações</DialogTitle><p className="mt-1 text-xs text-muted-foreground">Tudo do Doze 52 em um só lugar.</p></div>{topicButtons}</aside>
              <section className="flex min-h-0 flex-col"><header className="shrink-0 border-b border-border px-7 py-5 pr-14"><h2 className="text-lg font-semibold text-foreground">{activeTopic?.label}</h2><p className="text-sm text-muted-foreground">{activeTopic?.description}</p></header><div className="min-h-0 flex-1 overflow-y-auto px-7 py-6">{renderSection()}</div></section>
            </div>
          )}
          {guidedAppearanceNotice && onDismissGuidedNotice ? (
            <GuidedToolbarNoticeCard
              notice={guidedAppearanceNotice}
              onClose={onDismissGuidedNotice}
              placement="panel"
            />
          ) : null}
          {guidedThemeNotice && onDismissGuidedNotice ? (
            <GuidedToolbarNoticeCard
              notice={guidedThemeNotice}
              onClose={onDismissGuidedNotice}
              onAction={
                guidedThemeNotice.actionLabel
                  ? () => {
                      onGuidedThemeAction?.();
                      onOpenChange(false);
                    }
                  : undefined
              }
              placement="panel"
            />
          ) : null}
        </DialogContent>
      </Dialog>
      <CalendarSpreadsheetDialog open={spreadsheetOpen} onOpenChange={setSpreadsheetOpen} />
      <ProUpgradeDialog open={spreadsheetUpgradeOpen} onOpenChange={setSpreadsheetUpgradeOpen} reason="calendar-import-export" />
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
}
