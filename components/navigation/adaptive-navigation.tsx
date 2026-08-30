"use client";

import * as React from "react";
import {
  CalendarDays,
  CircleCheck,
  LayoutGrid,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useBilling } from "@/lib/use-billing";
import {
  PRODUCT_DESTINATIONS,
  type ProductDestinationId,
} from "@/lib/product-navigation";
import { cn } from "@/lib/utils";

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
};

const ICON_BY_NAME: Record<
  (typeof PRODUCT_DESTINATIONS)[number]["icon"],
  LucideIcon
> = {
  "calendar-days": CalendarDays,
  "circle-check": CircleCheck,
};

function AccountGlyph({ compact = false }: { compact?: boolean }) {
  const { session } = useAuth();
  const { isPro, isLoading, error } = useBilling();
  const showProBorder = Boolean(session && isPro && !isLoading && !error);
  const sizeClass = compact ? "size-5" : "size-8";

  return (
    <span
      className={cn(
        sizeClass,
        "rounded-[10px] grid place-items-center text-muted-foreground",
        showProBorder && "ring-[3px] ring-premium"
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
}: {
  destination: (typeof PRODUCT_DESTINATIONS)[number];
  active: boolean;
  mobile?: boolean;
  onSelect: (destination: ProductDestinationId) => void;
  highlighted?: boolean;
}) {
  const Icon = ICON_BY_NAME[destination.icon];

  return (
    <a
      href={destination.href}
      aria-current={active ? "page" : undefined}
      title={destination.label}
      data-product-destination={destination.id}
      data-onboarding-highlighted={highlighted ? "true" : undefined}
      className={cn(
        "group relative inline-flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        mobile ? "min-h-12 min-w-16 flex-1 flex-col gap-0.5 px-2" : "size-10",
        active
          ? "text-foreground"
          : "text-muted-foreground/55 hover:bg-muted/45 hover:text-foreground/80"
      )}
      onClick={(event) => {
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
      <Icon className="size-5" aria-hidden="true" />
      {mobile ? (
        <span className="text-[10px] font-semibold leading-none">
          {destination.label}
        </span>
      ) : (
        <span className="sr-only">{destination.label}</span>
      )}
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
}: ProductNavigationProps) {
  const handleAccount = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (authLoading) return;
    onOpenUtilityPanel("account", event.currentTarget);
  };

  return (
    <>
      <nav
        aria-label="Navegação principal"
        data-product-navigation="desktop"
        className="col-start-2 hidden items-center justify-center gap-1 md:flex"
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

      <div className="col-start-3 hidden items-center gap-1 justify-self-end md:flex">
        {onToggleOrganize ? (
          <button
            type="button"
            data-product-organize="desktop"
            data-onboarding-highlighted={organizeHighlighted ? "true" : undefined}
            aria-pressed={organizeActive}
            aria-label={organizeActive ? "Finalizar organização" : "Organizar"}
            title={organizeActive ? "Finalizar organização" : "Organizar"}
            disabled={organizeDisabled}
            className={cn(
              "grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
              organizeActive && "bg-foreground text-background hover:bg-foreground/90 hover:text-background"
            )}
            onClick={onToggleOrganize}
          >
            <LayoutGrid className="size-[18px]" />
          </button>
        ) : null}
        <button
          type="button"
          data-product-account="desktop"
          data-onboarding-auth-entry
          aria-label="Abrir perfil"
          title="Perfil"
          disabled={authLoading}
          className={cn(
            "grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-45",
            highlightProfile && "text-foreground"
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
      {[...PRODUCT_DESTINATIONS].reverse().map((destination) => (
        <DestinationButton
          key={destination.id}
          destination={destination}
          active={activeDestination === destination.id}
          mobile
          onSelect={onDestinationSelect}
        />
      ))}
      <button
        type="button"
        data-onboarding-auth-entry
        aria-label="Abrir perfil"
        disabled={authLoading}
        className="inline-flex min-h-12 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-muted-foreground/55 transition-colors hover:bg-muted/45 hover:text-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-45"
        onClick={handleAccount}
      >
        {authLoading ? null : <AccountGlyph compact />}
        <span className="text-[10px] font-semibold leading-none">Perfil</span>
      </button>
    </nav>
  );
}
