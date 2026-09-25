"use client";

import * as React from "react";
import {
  CalendarDays,
  ChevronDown,
  CircleCheck,
  PencilLine,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import {
  PRODUCT_DESTINATIONS,
  type ProductDestinationId,
} from "@/lib/product-navigation";
import { cn } from "@/lib/utils";
import { getDestinationTabClass } from "@/components/navigation/destination-tab-class";

export type UtilityPanelSection =
  | "account"
  | "plan"
  | "data"
  | "help"
  | "admin";

type ProductNavigationProps = {
  activeDestination: ProductDestinationId;
  authLoading: boolean;
  onDestinationSelect: (destination: ProductDestinationId) => void;
  onOpenUtilityPanel: (
    section: UtilityPanelSection,
    trigger: HTMLElement
  ) => void;
  onToggleOrganize?: () => void;
  organizeActive?: boolean;
  organizeDisabled?: boolean;
  organizeHighlighted?: boolean;
  highlightProfile?: boolean;
  highlightDestination?: ProductDestinationId;
  /**
   * Trava um destino específico (só consumido no mobile hoje). Usado pela
   * jornada própria de Hábitos (lib/mobile-habits-onboarding.ts): quem ainda
   * está criando o hábito ou marcando o primeiro dia não pode pular direto
   * para a Anual.
   */
  disabledDestination?: ProductDestinationId;
  showHeaderMinimizeToggle?: boolean;
  headerMinimized?: boolean;
  onToggleHeaderMinimized?: () => void;
};

const ICON_BY_NAME: Record<
  (typeof PRODUCT_DESTINATIONS)[number]["icon"],
  LucideIcon
> = {
  "calendar-days": CalendarDays,
  "circle-check": CircleCheck,
};

function AccountGlyph({ compact = false }: { compact?: boolean }) {
  const sizeClass = compact ? "size-5" : "size-8";

  return (
    <span
      className={cn(
        sizeClass,
        "rounded-[10px] grid place-items-center text-muted-foreground"
      )}
      aria-hidden="true"
    >
      <UserRound className={compact ? "size-4" : "size-5"} strokeWidth={1.8} />
    </span>
  );
}

function DestinationButton({
  destination,
  active,
  mobile = false,
  onSelect,
  highlighted = false,
  disabled = false,
}: {
  destination: (typeof PRODUCT_DESTINATIONS)[number];
  active: boolean;
  mobile?: boolean;
  onSelect: (destination: ProductDestinationId) => void;
  highlighted?: boolean;
  disabled?: boolean;
}) {
  const Icon = ICON_BY_NAME[destination.icon];

  return (
    <a
      href={disabled ? undefined : destination.href}
      aria-current={active ? "page" : undefined}
      aria-disabled={disabled ? "true" : undefined}
      tabIndex={disabled ? -1 : undefined}
      title={destination.label}
      data-product-destination={destination.id}
      data-onboarding-highlighted={highlighted ? "true" : undefined}
      className={cn(
        "group relative inline-flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        // Destinos com rótulo: ícone ao lado do nome no desktop, embaixo no
        // mobile. O ativo usa o mesmo fundo discreto do hover dos ícones.
        mobile
          ? cn(
              "min-h-12 min-w-16 flex-1 flex-col gap-0.5 text-[11px] font-medium",
              disabled
                ? "text-muted-foreground/30"
                : active
                  ? "text-foreground"
                  : "text-muted-foreground/70 hover:bg-muted/45 hover:text-foreground/85"
            )
          : getDestinationTabClass(active),
        highlighted && "product-spotlight-target"
      )}
      onClick={(event) => {
        // Travado: sempre previne o `href` nativo do link, senão o clique
        // navega mesmo assim (só o onSelect fica de fora).
        if (disabled) {
          event.preventDefault();
          return;
        }
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        onSelect(destination.id);
      }}
    >
      <Icon className={mobile ? "size-5" : "size-[18px]"} aria-hidden="true" />
      <span>{destination.label}</span>
    </a>
  );
}

export function DesktopProductNavigation({
  activeDestination,
  authLoading,
  onDestinationSelect,
  onOpenUtilityPanel,
  onToggleOrganize,
  organizeActive = false,
  organizeDisabled = false,
  organizeHighlighted = false,
  highlightProfile = false,
  highlightDestination,
  showHeaderMinimizeToggle = false,
  headerMinimized = false,
  onToggleHeaderMinimized,
}: ProductNavigationProps) {
  const handleAccount = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (authLoading) return;
    onOpenUtilityPanel("account", event.currentTarget);
  };

  return (
    <>
      <div className="relative col-start-2 hidden items-center justify-center md:flex">
        <nav
          aria-label="Navegação principal"
          data-product-navigation="desktop"
          className="flex items-center gap-1"
        >
          {PRODUCT_DESTINATIONS.map((destination) => (
            <DestinationButton
              key={destination.id}
              destination={destination}
              active={activeDestination === destination.id}
              onSelect={onDestinationSelect}
              highlighted={highlightDestination === destination.id}
            />
          ))}
        </nav>
        {/* Recolher a faixa de contextos/categorias fica colado ao seletor
            de visão: é o controle de "o que estou vendo", nunca some junto
            com a faixa e usa o mesmo chevron do mobile. Ancorado à direita
            para o seletor seguir exatamente no centro. */}
        {showHeaderMinimizeToggle && onToggleHeaderMinimized ? (
          <button
            type="button"
            data-product-header-minimize="desktop"
            aria-pressed={headerMinimized}
            aria-label={
              headerMinimized
                ? "Mostrar contextos e categorias"
                : "Minimizar contextos e categorias"
            }
            title={
              headerMinimized
                ? "Mostrar contextos e categorias"
                : "Minimizar contextos e categorias"
            }
            className="absolute left-full ml-1 grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            onClick={onToggleHeaderMinimized}
          >
            <ChevronDown
              className={cn(
                "size-[18px] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                headerMinimized ? "rotate-0" : "rotate-180"
              )}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>

      <div className="col-start-3 hidden items-center gap-1 justify-self-end md:flex">
        {/* Organizar (editar) colado ao perfil. */}
        {onToggleOrganize ? (
          <button
            type="button"
            data-product-organize="desktop"
            data-onboarding-highlighted={organizeHighlighted ? "true" : undefined}
            aria-pressed={organizeActive}
            aria-label={organizeActive ? "Finalizar edição" : "Editar"}
            title={organizeActive ? "Finalizar edição" : "Editar"}
            disabled={organizeDisabled}
            className={cn(
              "grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
              organizeActive && "bg-foreground text-background hover:bg-foreground/90 hover:text-background",
              organizeHighlighted && "product-spotlight-target"
            )}
            onClick={onToggleOrganize}
          >
            <PencilLine className="size-[18px]" />
          </button>
        ) : null}
        <button
          type="button"
          data-product-account="desktop"
          data-onboarding-auth-entry
          data-onboarding-highlighted={highlightProfile ? "true" : undefined}
          aria-label="Abrir perfil"
          title="Perfil"
          disabled={authLoading}
          className={cn(
            "grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-45",
            highlightProfile && "text-foreground product-spotlight-target"
          )}
          onClick={handleAccount}
        >
          {authLoading ? null : <AccountGlyph />}
        </button>
      </div>
    </>
  );
}

export function AdaptiveNavigation({
  activeDestination,
  authLoading,
  onDestinationSelect,
  onOpenUtilityPanel,
  highlightDestination,
  highlightProfile = false,
  disabledDestination,
}: ProductNavigationProps) {
  const handleAccount = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (authLoading) return;
    onOpenUtilityPanel("account", event.currentTarget);
  };

  return (
    <nav
      aria-label="Navegação principal"
      data-product-navigation="mobile"
      className="fixed inset-x-0 bottom-0 z-40 flex min-h-[calc(3.75rem+env(safe-area-inset-bottom,0px))] items-start border-t border-border/75 bg-background/96 px-2 pt-1.5 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-16px_36px_-30px_rgba(15,23,42,0.55)] backdrop-blur md:hidden"
    >
      {PRODUCT_DESTINATIONS.map((destination) => (
        <DestinationButton
          key={destination.id}
          destination={destination}
          active={activeDestination === destination.id}
          mobile
          onSelect={onDestinationSelect}
          highlighted={highlightDestination === destination.id}
          disabled={disabledDestination === destination.id}
        />
      ))}
      <button
        type="button"
        data-onboarding-auth-entry
        data-onboarding-highlighted={highlightProfile ? "true" : undefined}
        aria-label="Abrir perfil"
        disabled={authLoading}
        className={cn(
          "inline-flex min-h-12 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-medium text-muted-foreground/70 transition-colors hover:bg-muted/45 hover:text-foreground/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-45",
          highlightProfile && "text-foreground/80 product-spotlight-target"
        )}
        onClick={handleAccount}
      >
        {authLoading ? null : <AccountGlyph compact />}
        <span aria-hidden="true">Perfil</span>
      </button>
    </nav>
  );
}
