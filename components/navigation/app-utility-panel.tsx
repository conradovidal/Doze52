"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Bug,
  CalendarCog,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CircleUserRound,
  Compass,
  CreditCard,
  Crown,
  Database,
  FileSpreadsheet,
  Github,
  HelpCircle,
  Instagram,
  KeyRound,
  LogOut,
  Mail,
  MessageCircle,
  MessageSquareText,
  MoonStar,
  PencilLine,
  ShieldCheck,
  Sparkles,
  SunMedium,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

import { AuthForm } from "@/components/auth/auth-form";
import { DeleteAccountDialog } from "@/components/account/delete-account-dialog";
import { PRO_FEATURES, ProFeatureIcon, ProFeatureStack } from "@/components/billing/pro-features";
import { ProUpgradeDialog } from "@/components/billing/pro-upgrade-dialog";
import { BrandLogo } from "@/components/brand-logo";
import { FeedbackDialog } from "@/components/feedback/feedback-dialog";
import type { UtilityPanelSection } from "@/components/navigation/adaptive-navigation";
import { Button } from "@/components/ui/button";
import { PANEL_EYEBROW_CLASS, PanelHero, PanelIcon, PanelList, PanelRow } from "@/components/ui/panel-list";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback-provider";
import { ViewSwap } from "@/components/ui/view-swap";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import {
  CATEGORY_COLOR_BASE_AMBER,
  CATEGORY_COLOR_BASE_CORAL,
  CATEGORY_COLOR_BASE_GRAPHITE,
  CATEGORY_COLOR_BASE_INDIGO,
  CATEGORY_COLOR_BASE_SKY,
  CATEGORY_COLOR_BASE_TEAL,
  CATEGORY_COLOR_BASE_VIOLET,
} from "@/lib/category-palette";
import { FOUNDER_PRICE_LABEL, isCalendarSpreadsheetProGateEnabled, PRO_UPGRADE_COPY } from "@/lib/entitlements";
import { logDevError, logProdError } from "@/lib/safe-log";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { saveSnapshot } from "@/lib/sync";
import { useBilling } from "@/lib/use-billing";
import { cn } from "@/lib/utils";

const CalendarSpreadsheetPanel = dynamic(
  () =>
    import("@/components/calendar-spreadsheet-dialog").then(
      (module) => module.CalendarSpreadsheetPanel
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
  { id: "account", label: "Conta", description: "Perfil, tema e canais", icon: CircleUserRound },
  { id: "plan", label: "Plano", description: "Free ou Pro", icon: Crown },
  { id: "data", label: "Dados", description: "Importação e exportação", icon: Database },
  { id: "help", label: "Ajuda", description: "Feedback e contato", icon: HelpCircle },
  { id: "admin", label: "Admin", description: "Ferramentas internas", icon: ShieldCheck },
];

// Cor de cada tópico na lista do mobile; o Plano usa o dourado do Pro.
const MOBILE_TOPIC_META: Record<UtilityPanelSection, { color?: string; iconClassName?: string }> = {
  account: {},
  plan: { iconClassName: "bg-premium-soft text-premium-foreground" },
  data: { color: CATEGORY_COLOR_BASE_AMBER },
  help: { color: CATEGORY_COLOR_BASE_SKY },
  admin: { color: CATEGORY_COLOR_BASE_GRAPHITE },
};

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
  const { notify } = useFeedback();

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      notify({ tone: "success", title: "E-mail copiado", description: SUPPORT_EMAIL });
    } catch {
      window.location.href = `mailto:${SUPPORT_EMAIL}`;
    }
  };

  return (
    <div className={cn("flex items-center justify-center gap-2", className)}>
      {SOCIAL_LINKS.map((link) => {
        const isEmail = link.href.startsWith("mailto:");
        if (isEmail) {
          return (
            <button
              key={link.label}
              type="button"
              aria-label={`Copiar ${SUPPORT_EMAIL}`}
              title={`Copiar ${SUPPORT_EMAIL}`}
              onClick={handleCopyEmail}
              className="grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <link.icon className="size-4" />
            </button>
          );
        }
        return (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.label}
            title={link.label}
            className="grid size-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <link.icon className="size-4" />
          </a>
        );
      })}
    </div>
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
  const className = "size-20 rounded-[1.375rem]";

  return (
    // Pro: halo dourado atrás da foto e selo com a coroa no canto, no lugar
    // do antigo contorno — a foto continua limpa e o status fica evidente.
    <span className="relative inline-flex">
      {isPro ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-8 rounded-full bg-[radial-gradient(closest-side,var(--premium-soft),transparent)]"
        />
      ) : null}
      {avatarUrl && showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className={cn(className, "relative object-cover")} onError={onAvatarBroken} />
      ) : (
        <span className={cn(className, "relative grid place-items-center bg-foreground text-background")}>
          <CircleUserRound className="size-8" strokeWidth={1.8} aria-hidden="true" />
        </span>
      )}
      {isPro ? (
        <span
          aria-hidden="true"
          className="absolute -right-1.5 -bottom-1.5 grid size-7 place-items-center rounded-full bg-premium text-white shadow-sm ring-[3px] ring-background dark:text-neutral-950"
        >
          <Crown className="size-3.5" strokeWidth={2.2} />
        </span>
      ) : null}
    </span>
  );
}

type AppUtilityPanelProps = {
  onOpenAnnualHelp?: () => void;
  continuityStatus?: string;
  onRetryContinuity?: () => void;
  open: boolean;
  section: UtilityPanelSection;
  isMobile: boolean;
  returnFocusRef: React.RefObject<HTMLElement | null>;
  onOpenChange: (open: boolean) => void;
  onOpenAuthDialog: () => void;
  /**
   * Força o formulário de conta a abrir em "Cadastro" em vez do padrão
   * "Login" — usado pela jornada própria do mobile (goto_profile em
   * lib/mobile-habits-onboarding.ts): quem chega até aqui por ela ainda não
   * tem conta.
   */
  authInitialMode?: "login" | "signup";
};

// Tema saiu do cabeçalho e mora no menu do perfil, logo depois de Plano
// (Conta · Plano · Tema · Ajuda): alterna direto, sem abrir uma seção. Mesmo
// lugar no desktop (barra lateral) e no mobile (lista da folha).
function useThemeRowState() {
  const { mode, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && mode === "dark";
  return { isDark, toggle: () => setTheme(isDark ? "light" : "dark") };
}

function ThemeSidebarItem() {
  const { isDark, toggle } = useThemeRowState();
  const Icon = isDark ? MoonStar : SunMedium;
  return (
    <button
      type="button"
      data-theme-toggle
      aria-label={isDark ? "Tema escuro. Usar tema claro" : "Tema claro. Usar tema escuro"}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      onClick={toggle}
    >
      <Icon className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">Tema</span>
      <span className="shrink-0 text-xs font-medium text-muted-foreground/80">
        {isDark ? "Escuro" : "Claro"}
      </span>
    </button>
  );
}

function ThemePanelRow() {
  const { isDark, toggle } = useThemeRowState();
  return (
    <PanelRow
      icon={isDark ? MoonStar : SunMedium}
      color={CATEGORY_COLOR_BASE_VIOLET}
      title="Tema"
      description={isDark ? "Escuro · toque para usar o claro" : "Claro · toque para usar o escuro"}
      trailing={false}
      onClick={toggle}
    />
  );
}

export function AppUtilityPanel({
  onOpenAnnualHelp,
  continuityStatus,
  onRetryContinuity,
  open,
  section,
  isMobile,
  returnFocusRef,
  onOpenChange,
  onOpenAuthDialog,
  authInitialMode = "login",
}: AppUtilityPanelProps) {
  const router = useRouter();
  const { notify } = useFeedback();
  const { session, signOut, sendPasswordResetEmail, updateProfileName } = useAuth();
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
  const [adminCapabilities, setAdminCapabilities] = React.useState<AdminCapabilities>(EMPTY_ADMIN_CAPABILITIES);
  const [isSigningOut, setIsSigningOut] = React.useState(false);
  const [spreadsheetUpgradeOpen, setSpreadsheetUpgradeOpen] = React.useState(false);
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);
  const [brokenAvatar, setBrokenAvatar] = React.useState(false);
  const [isSendingPasswordReset, setIsSendingPasswordReset] = React.useState(false);
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState("");
  const [isSavingName, setIsSavingName] = React.useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = React.useState(false);
  const spreadsheetRequiresPro = isCalendarSpreadsheetProGateEnabled();

  React.useEffect(() => {
    if (!open) return;
    setActiveSection(section);
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
  const showAvatarPhoto = Boolean(avatarUrl) && !brokenAvatar;
  const showProIdentity = Boolean(session && isPro && !isBillingLoading && !billingError);
  const canChangePassword = session?.user.provider === "password";
  const periodEndDate = billingStatus.currentPeriodEnd ? new Date(billingStatus.currentPeriodEnd) : null;
  const formattedPeriodEnd =
    periodEndDate && !Number.isNaN(periodEndDate.getTime())
      ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(periodEndDate)
      : null;
  const hasBillingError = Boolean(billingError);
  const planLabel = isBillingLoading ? "Carregando..." : hasBillingError ? "Plano indisponível" : isPro ? "Doze 52 Pro" : "Plano Free";
  const planHeroTitle = hasBillingError
    ? "Plano indisponível"
    : isPro
      ? "Seu ano inteiro, sem limites"
      : PRO_UPGRADE_COPY.generic.title;
  const planHeroDescription = hasBillingError
    ? "Não foi possível carregar o status do plano. Tente de novo em instantes."
    : isPro
      ? billingStatus.cancelAtPeriodEnd && formattedPeriodEnd
        ? `Seu Pro continua ativo até ${formattedPeriodEnd}. Depois, a conta volta ao plano Free sem perder dados.`
        : formattedPeriodEnd
          ? `Obrigado por apoiar o Doze 52. Próxima renovação em ${formattedPeriodEnd}.`
          : "Obrigado por apoiar o Doze 52."
      : `Você está no plano Free. ${PRO_UPGRADE_COPY.generic.description}`;
  const accountPlanDescription = !showProIdentity
    ? "Veja o que o Pro libera"
    : billingStatus.cancelAtPeriodEnd && formattedPeriodEnd
      ? `Tudo liberado até ${formattedPeriodEnd}`
      : formattedPeriodEnd
        ? `Renova em ${formattedPeriodEnd}`
        : "Tudo liberado no seu calendário";
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

  // No mobile, "account" é a raiz da folha; os outros tópicos abrem como
  // uma tela mais funda, com voltar (mesmo padrão do Organizar).
  const mobileSubTopic =
    activeTopic && activeTopic.id !== "account" ? activeTopic : null;

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

  const startEditingName = () => {
    const hasCustomName = Boolean(rawName) && !/^google_[a-z0-9]+$/i.test(rawName.trim());
    setNameDraft(hasCustomName ? rawName : "");
    setIsEditingName(true);
  };

  const handleSaveName = async () => {
    const trimmed = nameDraft.trim();
    if (!trimmed) return;
    setIsSavingName(true);
    try {
      await updateProfileName(trimmed);
      setIsEditingName(false);
      notify({ tone: "success", title: "Nome atualizado" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida.";
      logDevError("utility-panel.update-name", { message });
      notify({ tone: "error", title: "Não foi possível salvar o nome", description: "Tente novamente em instantes." });
    } finally {
      setIsSavingName(false);
    }
  };

  const handleChangePassword = async () => {
    if (!email) return;
    setIsSendingPasswordReset(true);
    try {
      await sendPasswordResetEmail(email);
      notify({
        tone: "success",
        title: "Link enviado",
        description: `Enviamos um link para redefinir sua senha para ${email}.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha desconhecida.";
      logDevError("utility-panel.change-password", { message });
      notify({ tone: "error", title: "Não foi possível enviar o link", description: "Tente novamente em instantes." });
    } finally {
      setIsSendingPasswordReset(false);
    }
  };

  const openFeedback = () => { onOpenChange(false); setFeedbackOpen(true); };
  const navigateTo = (href: string) => { onOpenChange(false); router.push(href); };

  const renderSection = (
    sectionId: UtilityPanelSection,
    options?: { standalone?: boolean }
  ) => {
    const standalone = options?.standalone ?? true;
    switch (sectionId) {
      case "account":
        return session ? (
          <div className="mx-auto flex max-w-xl flex-col items-center pt-2 text-center">
            <AccountAvatar
              avatarUrl={avatarUrl}
              showPhoto={showAvatarPhoto}
              isPro={showProIdentity}
              onAvatarBroken={() => setBrokenAvatar(true)}
            />
            {showProIdentity ? (
              <p className={cn(PANEL_EYEBROW_CLASS, "mt-5 inline-flex items-center gap-1.5 text-premium-foreground")}>
                <Crown className="size-3" aria-hidden="true" />
                Conta Pro
              </p>
            ) : null}
            {isEditingName ? (
              <div className={cn("flex w-full max-w-xs items-center gap-1.5", showProIdentity ? "mt-1.5" : "mt-4")}>
                <Input
                  autoFocus
                  value={nameDraft}
                  onChange={(event) => setNameDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSaveName();
                    if (event.key === "Escape") setIsEditingName(false);
                  }}
                  placeholder="Seu nome"
                  className="h-9 text-center"
                />
                <Button type="button" size="icon-sm" variant="outline" disabled={isSavingName || !nameDraft.trim()} onClick={handleSaveName} aria-label="Salvar nome">
                  <Check className="size-4" />
                </Button>
                <Button type="button" size="icon-sm" variant="ghost" disabled={isSavingName} onClick={() => setIsEditingName(false)} aria-label="Cancelar">
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div className={cn("flex items-center gap-1.5 pl-7", showProIdentity ? "mt-1.5" : "mt-4")}>
                <h3 className="text-xl font-semibold tracking-[-0.01em] text-foreground">{displayName}</h3>
                <button
                  type="button"
                  aria-label="Editar nome"
                  title="Editar nome"
                  className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={startEditingName}
                >
                  <PencilLine className="size-3.5" />
                </button>
              </div>
            )}
            <p className="mt-1 text-sm text-muted-foreground">{email}</p>
            {continuityStatus ? <div role="status" aria-label="Sincronização de hábitos" className="mt-3 text-sm text-muted-foreground">{continuityStatus}{onRetryContinuity ? <Button variant="ghost" size="sm" onClick={onRetryContinuity}>Tentar novamente</Button> : null}</div> : null}

            {standalone ? (
              // Cartão de assinatura: no Pro, tingido de dourado e com a pilha
              // de benefícios "acesa" — a mesma capa do Plano, agora liberada.
              <button
                type="button"
                className={cn(
                  "mt-6 flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-colors",
                  showProIdentity
                    ? "border-premium-border bg-[linear-gradient(135deg,var(--premium-soft),transparent_70%)] hover:bg-premium-soft"
                    : "border-border bg-card hover:bg-muted/60"
                )}
                onClick={() => setActiveSection("plan")}
              >
                <ProFeatureStack size="sm" className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    {planLabel}
                    {showProIdentity ? (
                      <span className="rounded-full bg-premium-soft px-1.5 py-px text-[10px] font-semibold text-premium-foreground">
                        Ativo
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{accountPlanDescription}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            ) : (
              <PanelList className="mt-6 w-full text-left">
                {visibleTopics
                  .filter((topic) => topic.id !== "account")
                  .map((topic) => {
                    const meta = MOBILE_TOPIC_META[topic.id];
                    return (
                      <React.Fragment key={topic.id}>
                      <PanelRow
                        icon={topic.icon}
                        color={meta.color}
                        iconClassName={meta.iconClassName}
                        title={topic.label}
                        description={topic.id === "plan" ? (isPro ? "Doze 52 Pro · sua assinatura" : "Plano Free · veja o que o Pro libera") : topic.description}
                        onClick={() => setActiveSection(topic.id)}
                      />
                      {topic.id === "plan" ? <ThemePanelRow /> : null}
                      </React.Fragment>
                    );
                  })}
              </PanelList>
            )}

            <PanelList className="mt-4 w-full text-left">
              {canChangePassword ? (
                <PanelRow
                  icon={KeyRound}
                  color={CATEGORY_COLOR_BASE_INDIGO}
                  title="Alterar senha"
                  description="Enviamos um link para o seu e-mail."
                  trailing={false}
                  state={isSendingPasswordReset ? "pending" : "idle"}
                  stateLabels={{ pending: "Enviando link…" }}
                  onClick={handleChangePassword}
                />
              ) : null}
              <PanelRow
                icon={LogOut}
                title="Sair"
                description="Seus dados ficam salvos nesta conta."
                trailing={false}
                state={isSigningOut ? "pending" : "idle"}
                stateLabels={{ pending: "Saindo…" }}
                onClick={handleSignOut}
              />
            </PanelList>

            <button
              type="button"
              className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-rose-600 dark:hover:text-rose-300"
              onClick={() => setDeleteAccountOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Excluir minha conta
            </button>
          </div>
        ) : (
          <div className="mx-auto max-w-sm text-left">
            <AuthForm
              open={open}
              initialMode={authInitialMode}
              onSuccess={() => onOpenChange(false)}
            />
            {/* Sem conta, a folha do mobile não tem barra lateral: os mesmos
                tópicos (Plano · Tema · Ajuda) vêm logo abaixo do formulário. */}
            {isMobile ? (
              <PanelList className="mt-5 w-full text-left">
                {visibleTopics
                  .filter((topic) => topic.id !== "account")
                  .map((topic) => (
                    <React.Fragment key={topic.id}>
                      <PanelRow
                        icon={topic.icon}
                        color={MOBILE_TOPIC_META[topic.id].color}
                        iconClassName={MOBILE_TOPIC_META[topic.id].iconClassName}
                        title={topic.label}
                        description={topic.description}
                        onClick={() => setActiveSection(topic.id)}
                      />
                      {topic.id === "plan" ? <ThemePanelRow /> : null}
                    </React.Fragment>
                  ))}
              </PanelList>
            ) : null}
          </div>
        );
      case "plan":
        return (
          <div className="max-w-xl space-y-4">
            <PanelHero
              media={<ProFeatureStack className="justify-center" />}
              eyebrow={
                <>
                  <Sparkles className="size-3" aria-hidden="true" />
                  Doze 52 Pro
                  {showProIdentity ? (
                    <span className="ml-1 rounded-full bg-premium-soft px-1.5 py-px text-[9px] tracking-[0.12em] text-premium-foreground">
                      {billingStatus.cancelAtPeriodEnd ? "Até o fim do período" : "Ativo"}
                    </span>
                  ) : null}
                </>
              }
              title={planHeroTitle}
              description={planHeroDescription}
            />
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="grid grid-cols-[minmax(0,1fr)_2.75rem_5.25rem] px-4 pt-2.5 text-sm sm:grid-cols-[minmax(0,1fr)_4rem_6rem]">
                <span className="pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">O que muda</span>
                <span className="flex items-end justify-center pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Free</span>
                <span className="flex items-end justify-center gap-1 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                  <Sparkles className="size-3" aria-hidden="true" />
                  Pro
                </span>
                {PRO_FEATURES.map((feature) => (
                  <React.Fragment key={feature.id}>
                    <span className="flex min-w-0 items-center gap-2.5 border-t border-border/60 py-1.5 text-foreground">
                      <ProFeatureIcon feature={feature} />
                      <span className="min-w-0 truncate leading-5">{feature.shortLabel}</span>
                    </span>
                    <span className="flex items-center justify-center border-t border-border/60 py-1.5 tabular-nums text-muted-foreground">{feature.free}</span>
                    <span className="flex items-center justify-center border-t border-border/60 py-1.5 font-semibold tabular-nums text-foreground">{feature.pro}</span>
                  </React.Fragment>
                ))}
              </div>
              <div className="flex items-center gap-4 border-t border-border bg-muted/30 px-4 py-3">
                <div className="min-w-0 flex-1">
                  {isPro ? (
                    <p className="text-xs leading-5 text-muted-foreground">Troque o cartão, veja faturas ou cancele.</p>
                  ) : (
                    <>
                      <p className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-lg font-semibold tracking-[-0.02em] tabular-nums text-foreground">{FOUNDER_PRICE_LABEL}</span>
                        <span className="text-[11px] font-semibold text-muted-foreground">Preço fundador</span>
                      </p>
                      <p className="text-xs text-muted-foreground">Cancele quando quiser.</p>
                    </>
                  )}
                </div>
                <Button
                  type="button"
                  variant={isPro ? "outline" : "premium"}
                  className="h-10 shrink-0 px-5"
                  disabled={isPlanActionLoading || hasBillingError}
                  onClick={handlePlanAction}
                >
                  {isPro ? <CreditCard className="size-4" /> : null}
                  {planActionLabel}
                </Button>
              </div>
            </div>
          </div>
        );
      case "data":
        return spreadsheetRequiresPro && !isPro && !isBillingLoading ? (
          <div className="max-w-xl rounded-2xl border border-border bg-card px-6 pb-6 pt-5">
            <PanelHero
              media={<PanelIcon icon={FileSpreadsheet} color={CATEGORY_COLOR_BASE_AMBER} size="lg" />}
              eyebrow={<><Sparkles className="size-3" aria-hidden="true" />Doze 52 Pro</>}
              title={PRO_UPGRADE_COPY["calendar-import-export"].title}
              description={PRO_UPGRADE_COPY["calendar-import-export"].description}
            >
              <Button type="button" variant="premium" className="mx-auto mt-5 flex h-11 w-full max-w-xs text-[15px]" onClick={() => setSpreadsheetUpgradeOpen(true)}>
                Conhecer o Pro
              </Button>
            </PanelHero>
          </div>
        ) : (
          <CalendarSpreadsheetPanel />
        );
      case "help":
        return (
          <div className="max-w-xl space-y-5">
            {standalone ? (
              <PanelHero
                media={<PanelIcon icon={HelpCircle} color={CATEGORY_COLOR_BASE_SKY} size="lg" />}
                eyebrow="Ajuda"
                title="Como podemos ajudar?"
                description={<>Tire uma dúvida, conte o que achou ou reveja a introdução. Tudo chega em {SUPPORT_EMAIL}.</>}
              />
            ) : null}
            <PanelList>
              {onOpenAnnualHelp ? (
                <PanelRow icon={Compass} color={CATEGORY_COLOR_BASE_TEAL} title="Introdução aos Eventos" description="Reveja como o ano cabe em uma página." onClick={onOpenAnnualHelp} />
              ) : null}
              {session ? (
                <PanelRow icon={Bug} color={CATEGORY_COLOR_BASE_CORAL} title="Enviar feedback" description="Conte um problema ou uma ideia, com print se quiser." onClick={openFeedback} />
              ) : null}
              <PanelRow href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Dúvida: ")}`} icon={CircleHelp} color={CATEGORY_COLOR_BASE_INDIGO} title="Enviar uma dúvida" description="Abre seu app de e-mail." trailing={<ArrowUpRight className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />} />
              <PanelRow href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Comentário: ")}`} icon={MessageCircle} color={CATEGORY_COLOR_BASE_VIOLET} title="Fazer um comentário" description="Elogios e sugestões também são bem-vindos." trailing={<ArrowUpRight className="size-4 shrink-0 text-muted-foreground/70" aria-hidden="true" />} />
            </PanelList>
          </div>
        );
      case "admin":
        return (
          <div className="max-w-xl space-y-5">
            {standalone ? (
              <PanelHero
                media={<PanelIcon icon={ShieldCheck} color={CATEGORY_COLOR_BASE_GRAPHITE} size="lg" />}
                eyebrow="Admin"
                title="Ferramentas internas"
                description="Visível só para quem administra o Doze 52."
              />
            ) : null}
            <PanelList>
              {adminCapabilities.feedback ? (
                <PanelRow icon={MessageSquareText} color={CATEGORY_COLOR_BASE_AMBER} title="Painel de feedback" description="Leia e trie o que as pessoas enviaram." onClick={() => navigateTo("/admin/feedback")} />
              ) : null}
              {adminCapabilities.calendarPacks ? (
                <PanelRow icon={CalendarCog} color={CATEGORY_COLOR_BASE_TEAL} title="Painel de calendários" description="Publique e revise os calendários prontos." onClick={() => navigateTo("/admin/calendar-packs")} />
              ) : null}
            </PanelList>
          </div>
        );
    }
  };

  const topicButtons = (
    <nav aria-label="Tópicos de conta e configurações" className="space-y-1">
      {visibleTopics.map((topic) => {
        const Icon = topic.icon;
        const selected = activeSection === topic.id;
        return (
          <React.Fragment key={topic.id}>
          <button type="button" aria-current={selected ? "page" : undefined} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60", selected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")} onClick={() => setActiveSection(topic.id)}>
            <Icon className="size-4 shrink-0" /><span className="min-w-0 truncate text-sm font-semibold">{topic.label}</span>
          </button>
          {topic.id === "plan" ? <ThemeSidebarItem /> : null}
          </React.Fragment>
        );
      })}
    </nav>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          data-app-utility-panel
          className={cn("overflow-hidden p-0", isMobile ? cn("inset-x-0 top-auto bottom-0 w-screen max-w-none translate-x-0 translate-y-0 rounded-none rounded-t-[1.75rem] border-0 border-t border-border/70 data-[state=open]:slide-in-from-bottom-2 data-[state=closed]:slide-out-to-bottom-2 sm:max-w-none", "h-auto max-h-[86dvh]") : "h-[min(600px,80dvh)] w-[min(720px,calc(100vw-5rem))] max-w-[720px] sm:max-w-[720px]")}
          onCloseAutoFocus={(event) => { event.preventDefault(); returnFocusRef.current?.focus(); }}
        >
          <DialogDescription className="sr-only">Gerencie sua conta, plano, dados e canais do Doze 52.</DialogDescription>
          {isMobile ? (
            // Altura do conteúdo (até 86dvh): o formulário de entrada cabe
            // sem rolar; só rola quando não couber mesmo.
            <div className="flex max-h-[86dvh] min-h-0 flex-col">
              <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border px-4 pr-12">
                {mobileSubTopic ? (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="-ml-1.5 shrink-0"
                      aria-label="Voltar para Conta e configurações"
                      onClick={() => setActiveSection("account")}
                    >
                      <ChevronLeft className="size-5" />
                    </Button>
                    <DialogTitle className="sr-only">Conta e configurações</DialogTitle>
                    <p className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{mobileSubTopic.label}</p>
                  </>
                ) : (
                  <div className="min-w-0 flex-1">
                    <DialogTitle>Conta e configurações</DialogTitle>
                    {session ? (
                      <p className="text-xs text-muted-foreground">
                        Sua conta, plano e canais de contato.
                      </p>
                    ) : null}
                  </div>
                )}
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
                <ViewSwap view={mobileSubTopic?.id ?? "account"} depth={mobileSubTopic ? 1 : 0}>
                  {mobileSubTopic
                    ? renderSection(mobileSubTopic.id)
                    : renderSection("account", { standalone: false })}
                </ViewSwap>
              </div>
            </div>
          ) : (
            // Marca e canais moram na barra lateral: a coluna de conteúdo usa a
            // altura inteira do painel e cada tópico cabe sem rolar.
            <div className="grid h-full min-h-0 grid-cols-[180px_minmax(0,1fr)]">
              <aside className="flex min-h-0 flex-col border-r border-border bg-muted/24 p-3">
                <DialogTitle className="sr-only">Configurações</DialogTitle>
                <div className="flex h-12 shrink-0 items-center px-3">
                  <BrandLogo className="h-6 w-[68px]" />
                </div>
                <div className="mt-2 min-h-0 flex-1">{topicButtons}</div>
                <SocialLinksRow className="shrink-0 justify-start gap-0.5 px-0.5" />
              </aside>
              <section className="min-h-0 overflow-y-auto px-8 pb-3 pt-6">{renderSection(activeSection)}</section>
            </div>
          )}
        </DialogContent>
      </Dialog>
      <ProUpgradeDialog open={spreadsheetUpgradeOpen} onOpenChange={setSpreadsheetUpgradeOpen} reason="calendar-import-export" />
      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <DeleteAccountDialog open={deleteAccountOpen} onOpenChange={setDeleteAccountOpen} />
    </>
  );
}
