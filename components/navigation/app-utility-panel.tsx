"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bug,
  CalendarCog,
  Check,
  CircleHelp,
  CircleUserRound,
  CreditCard,
  Crown,
  Database,
  FileSpreadsheet,
  Github,
  HelpCircle,
  Image as ImageIcon,
  Instagram,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { AuthForm } from "@/components/auth/auth-form";
import { ProUpgradeDialog } from "@/components/billing/pro-upgrade-dialog";
import { BrandLogo } from "@/components/brand-logo";
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
import { useAvatarPreference } from "@/lib/avatar-preference";
import { isCalendarSpreadsheetProGateEnabled, PLAN_LIMITS } from "@/lib/entitlements";
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

const PLAN_COMPARISON_ROWS: ReadonlyArray<{ label: string; free: string; pro: string }> = [
  { label: "Hábitos", free: `${PLAN_LIMITS.free.maxHabits}`, pro: `${PLAN_LIMITS.pro.maxHabits}` },
  { label: "Contextos", free: `${PLAN_LIMITS.free.maxProfiles}`, pro: "Ilimitados" },
  { label: "Categorias", free: `${PLAN_LIMITS.free.maxCategories}`, pro: "Ilimitadas" },
  { label: "Calendários", free: `${PLAN_LIMITS.free.maxCalendarSubscriptions}`, pro: "Ilimitados" },
  { label: "Planilhas de importação/exportação", free: "—", pro: "Incluídas" },
];

const TOPICS: ReadonlyArray<{
  id: UtilityPanelSection;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  { id: "account", label: "Conta", description: "Perfil, tema e canais", icon: CircleUserRound },
  { id: "plan", label: "Plano", description: "Free ou Pro", icon: Crown },
  { id: "data", label: "Dados", description: "Importação e exportação", icon: Database },
  { id: "help", label: "Ajuda", description: "Feedback e contato", icon: HelpCircle },
  { id: "admin", label: "Admin", description: "Ferramentas internas", icon: ShieldCheck },
];

function BrandXIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M18.9 2h3.1l-6.78 7.75L23.2 22h-6.27l-4.91-6.4L6.4 22H3.3l7.24-8.28L.8 2h6.43l4.44 5.85L18.9 2Zm-1.1 18h1.72L6.29 3.9H4.45L17.8 20Z" />
    </svg>
  );
}

const SOCIAL_LINKS: ReadonlyArray<{ label: string; href: string; icon: LucideIcon | typeof BrandXIcon }> = [
  { label: "Instagram", href: "https://instagram.com/doze.52", icon: Instagram },
  { label: "X", href: "https://x.com/doze_52", icon: BrandXIcon },
  { label: "GitHub", href: "https://github.com/conradovidal/Doze52", icon: Github },
  { label: "E-mail", href: `mailto:${SUPPORT_EMAIL}`, icon: Mail },
];

function SocialLinksRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {SOCIAL_LINKS.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target={link.href.startsWith("mailto:") ? undefined : "_blank"}
          rel={link.href.startsWith("mailto:") ? undefined : "noopener noreferrer"}
          aria-label={link.label}
          title={link.label}
          className="grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <link.icon className="size-4" />
        </a>
      ))}
    </div>
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
  showPhoto,
  isPro,
  onAvatarBroken,
}: {
  avatarUrl: string | null;
  showPhoto: boolean;
  isPro: boolean;
  onAvatarBroken: () => void;
}) {
  const className = cn(
    "size-16 rounded-2xl",
    isPro && "ring-2 ring-premium"
  );

  if (avatarUrl && showPhoto) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className={cn(className, "object-cover")} onError={onAvatarBroken} />
    );
  }

  return (
    <span className={cn(className, "grid place-items-center bg-foreground text-background")}>
      <CircleUserRound className="size-7" strokeWidth={1.8} aria-hidden="true" />
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
  const [viewportTick, setViewportTick] = React.useState(0);
  const [brokenAvatar, setBrokenAvatar] = React.useState(false);
  const { preference: avatarPreference, setPreference: setAvatarPreference } = useAvatarPreference();
  const spreadsheetRequiresPro = isCalendarSpreadsheetProGateEnabled();

  // Computed synchronously during render (not in an effect) so the very first
  // paint already has the right anchor — measuring the panel's own DOM node
  // after mount meant the panel briefly rendered centered, then jumped to its
  // anchored spot once that measurement effect ran, reading as an errant
  // "rises from below" motion.
  const desktopPosition = React.useMemo(() => {
    if (!open || isMobile) return null;
    const trigger = returnFocusRef.current;
    if (!trigger) return null;

    const triggerRect = trigger.getBoundingClientRect();
    const viewportPadding = 16;
    const gap = 8;
    // Mirrors the h-[min(600px,86dvh)] class below exactly, so this estimate
    // never diverges from the panel's actual rendered height.
    const panelHeight = Math.min(600, window.innerHeight * 0.86);
    const right = Math.max(viewportPadding, window.innerWidth - triggerRect.right);
    const top = Math.max(
      viewportPadding,
      Math.min(triggerRect.bottom + gap, window.innerHeight - panelHeight - viewportPadding)
    );
    return { right, top };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isMobile, returnFocusRef, viewportTick]);

  React.useEffect(() => {
    if (!open || isMobile) return;
    const handleViewportChange = () => setViewportTick((tick) => tick + 1);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [open, isMobile]);

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

  const guidedAppearanceFiredRef = React.useRef(false);
  React.useEffect(() => {
    if (!open) {
      guidedAppearanceFiredRef.current = false;
      return;
    }
    if (guidedAppearanceFiredRef.current) return;
    guidedAppearanceFiredRef.current = true;
    onGuidedAppearanceOpen?.();
  }, [open, onGuidedAppearanceOpen]);

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
  const showAvatarPhoto = Boolean(avatarUrl) && avatarPreference === "photo" && !brokenAvatar;
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
          <div className="mx-auto flex max-w-xl flex-col items-center py-4 text-center">
            <AccountAvatar
              avatarUrl={avatarUrl}
              showPhoto={showAvatarPhoto}
              isPro={showProIdentity}
              onAvatarBroken={() => setBrokenAvatar(true)}
            />
            {avatarUrl && !brokenAvatar ? (
              <div className="mt-3 inline-flex rounded-lg border border-border bg-card p-0.5 text-xs font-medium">
                <button
                  type="button"
                  aria-pressed={avatarPreference === "photo"}
                  className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors", avatarPreference === "photo" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => setAvatarPreference("photo")}
                >
                  {avatarPreference === "photo" ? <Check className="size-3" /> : <ImageIcon className="size-3" />}
                  Foto
                </button>
                <button
                  type="button"
                  aria-pressed={avatarPreference === "icon"}
                  className={cn("flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors", avatarPreference === "icon" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => setAvatarPreference("icon")}
                >
                  {avatarPreference === "icon" ? <Check className="size-3" /> : <CircleUserRound className="size-3" />}
                  Ícone
                </button>
              </div>
            ) : null}
            <h3 className="mt-4 text-xl font-semibold text-foreground">{displayName}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{email}</p>
            <span className={cn("mt-3 rounded-full px-2.5 py-1 text-xs font-semibold", showProIdentity ? "bg-premium-soft text-premium-foreground" : "bg-muted text-muted-foreground")}>{showProIdentity ? "Pro" : "Free"}</span>

            <button
              type="button"
              className="mt-6 flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-muted/60"
              onClick={() => setActiveSection("plan")}
            >
              <div>
                <p className="text-sm font-semibold text-foreground">{planLabel}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{isPro ? "Ver detalhes da assinatura" : "Veja o que o Pro libera"}</p>
              </div>
              <Sparkles className={cn("size-5 shrink-0", isPro ? "text-premium" : "text-muted-foreground")} />
            </button>

            <Button type="button" variant="outline" className="mt-6 min-w-48" disabled={isSigningOut} onClick={handleSignOut}><LogOut className="size-4" />{isSigningOut ? "Saindo..." : "Sair"}</Button>
          </div>
        ) : (
          <div className="mx-auto max-w-sm text-left">
            <AuthForm open={open} onSuccess={() => onOpenChange(false)} />
          </div>
        );
      case "plan":
        return (
          <div className="max-w-xl space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-5"><div><p className="text-lg font-semibold text-foreground">{planLabel}</p><p className="mt-2 text-sm leading-6 text-muted-foreground">{planDescription}</p></div><Sparkles className={cn("mt-1 size-5", isPro ? "text-premium" : "text-muted-foreground")} /></div>
              <Button type="button" variant={isPro ? "outline" : "premium"} className="mt-6" disabled={isPlanActionLoading || hasBillingError} onClick={handlePlanAction}><CreditCard className="size-4" />{planActionLabel}</Button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2.5 px-5 py-4 text-sm">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">O que muda</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Free</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-premium">Pro</span>
                {PLAN_COMPARISON_ROWS.map((row) => (
                  <React.Fragment key={row.label}>
                    <span className="text-foreground">{row.label}</span>
                    <span className="text-muted-foreground">{row.free}</span>
                    <span className="font-medium text-premium-foreground">{row.pro}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        );
      case "data":
        return (
          <div className="max-w-xl rounded-2xl border border-border bg-card p-2"><PanelAction icon={FileSpreadsheet} disabled={spreadsheetRequiresPro && isBillingLoading} onClick={openSpreadsheet}>Importar ou exportar{spreadsheetRequiresPro && !isPro && !isBillingLoading ? <span className="ml-auto rounded-full bg-premium-soft px-2 py-0.5 text-[10px] font-semibold text-premium-foreground">Pro</span> : null}</PanelAction></div>
        );
      case "help":
        return (
          <div className="max-w-xl rounded-2xl border border-border bg-card p-2">
            {session ? <PanelAction icon={Bug} onClick={openFeedback}>Enviar feedback</PanelAction> : null}
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Dúvida: ")}`} className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground hover:bg-muted/60">
              <CircleHelp className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-left">Enviar uma dúvida</span>
            </a>
            <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Comentário: ")}`} className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-foreground hover:bg-muted/60">
              <MessageCircle className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-left">Fazer um comentário</span>
            </a>
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
          <button key={topic.id} type="button" aria-current={selected ? "page" : undefined} data-onboarding-appearance-topic={topic.id === "account" ? "true" : undefined} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60", selected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground", guidedAppearanceNotice && topic.id === "account" && "guided-control-target")} onClick={() => { setActiveSection(topic.id); if (topic.id === "account") onGuidedAppearanceOpen?.(); if (isMobile) setMobileDetailOpen(true); }}>
            <Icon className="size-4 shrink-0" /><span className="min-w-0 truncate text-sm font-semibold">{topic.label}</span>
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
          data-desktop-anchor-positioned={
            !isMobile && desktopPosition ? "true" : undefined
          }
          className={cn("overflow-hidden p-0", isMobile ? "inset-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 sm:max-w-none" : "h-[min(600px,86dvh)] w-[min(720px,calc(100vw-5rem))] max-w-[720px] translate-x-0 translate-y-0 data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2 sm:max-w-[720px]")}
          style={
            !isMobile && desktopPosition
              ? {
                  left: "auto",
                  right: desktopPosition.right,
                  top: desktopPosition.top,
                  transform: "none",
                  transformOrigin: "top right",
                }
              : undefined
          }
          onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusRef.current?.focus(); }}
        >
          <DialogDescription className="sr-only">Gerencie sua conta, plano, dados e canais do Doze 52.</DialogDescription>
          {isMobile ? (
            <div className="flex h-full min-h-0 flex-col">
              <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4 pr-12">{mobileDetailOpen ? <button type="button" aria-label="Voltar aos tópicos" className="grid size-10 place-items-center rounded-xl hover:bg-muted" onClick={() => setMobileDetailOpen(false)}><ArrowLeft className="size-5" /></button> : null}<div className="min-w-0 flex-1"><DialogTitle>{mobileDetailOpen ? activeTopic?.label : "Conta e configurações"}</DialogTitle><p className="text-xs text-muted-foreground">{mobileDetailOpen ? activeTopic?.description : "Escolha o que deseja gerenciar."}</p></div><span data-onboarding-spotlight-target={guidedThemeNotice ? "true" : undefined} className="relative"><ThemeToggle highlighted={Boolean(guidedThemeNotice)} onThemeChange={onGuidedThemeChange} /></span></header>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">{mobileDetailOpen ? renderSection() : topicButtons}</div>
            </div>
          ) : (
            <div className="grid h-full min-h-0 grid-cols-[180px_minmax(0,1fr)]">
              <aside className="min-h-0 border-r border-border bg-muted/24 p-3 pt-4"><DialogTitle className="sr-only">Configurações</DialogTitle>{topicButtons}</aside>
              <section className="flex min-h-0 flex-col">
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-6 py-4">
                  <div className="flex items-center gap-2">
                    <BrandLogo className="h-6 w-[68px]" />
                    <span data-onboarding-spotlight-target={guidedThemeNotice ? "true" : undefined} className="relative">
                      <ThemeToggle variant="bare" highlighted={Boolean(guidedThemeNotice)} onThemeChange={onGuidedThemeChange} />
                    </span>
                  </div>
                  <SocialLinksRow />
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto py-6 pr-12 pl-6">{renderSection()}</div>
              </section>
            </div>
          )}
          {guidedAppearanceNotice && onDismissGuidedNotice ? (
            <GuidedToolbarNoticeCard
              notice={guidedAppearanceNotice}
              onClose={onDismissGuidedNotice}
              placement="panel"
              portaled
              portalTargetSelector="[data-app-utility-panel]"
              anchorSelector="[data-onboarding-appearance-topic='true']"
              anchorPlacement="right-center"
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
              portaled
              portalTargetSelector="[data-app-utility-panel]"
              anchorSelector="[data-onboarding-spotlight-target='true']"
              anchorPlacement="below-center"
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
