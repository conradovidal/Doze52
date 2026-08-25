"use client";

import * as React from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  CircleCheck,
  PencilLine,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  GuidedToolbarNoticeCard,
  type GuidedToolbarNotice,
} from "@/components/onboarding/guided-toolbar-notice";
import { useBilling } from "@/lib/use-billing";
import {
  PRODUCT_DESTINATIONS,
  type ProductDestinationId,
} from "@/lib/product-navigation";
import { cn } from "@/lib/utils";

export type UtilityPanelSection =
  | "account"
  | "plan"
  | "appearance"
  | "data"
  | "help"
  | "about"
  | "admin";

type AdaptiveNavigationProps = {
  activeDestination: ProductDestinationId;
  authLoading: boolean;
  onDestinationSelect: (destination: ProductDestinationId) => void;
  onOpenUtilityPanel: (
    section: UtilityPanelSection,
    trigger: HTMLElement
  ) => void;
  year: number;
  onYearChange: (year: number) => void;
  editActive: boolean;
  editDisabled?: boolean;
  onToggleEdit: () => void;
  guidedToolbarNotice?: GuidedToolbarNotice | null;
  onDismissGuidedNotice?: () => void;
  onGuidedToolbarAction?: (target: GuidedToolbarNotice["target"]) => void;
};

const ICON_BY_NAME: Record<
  (typeof PRODUCT_DESTINATIONS)[number]["icon"],
  LucideIcon
> = {
  "calendar-days": CalendarDays,
  "circle-check": CircleCheck,
};

function AccountGlyph({
  compact = false,
  desktopRail = false,
}: {
  compact?: boolean;
  desktopRail?: boolean;
}) {
  const { session } = useAuth();
  const { isPro, isLoading, error } = useBilling();
  const [brokenAvatar, setBrokenAvatar] = React.useState(false);
  const metadata = session?.user.metadata ?? {};
  const displayName =
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (typeof metadata.name === "string" && metadata.name) ||
    session?.user.email ||
    "";
  const avatarUrl =
    (typeof metadata.avatar_url === "string" && metadata.avatar_url) ||
    (typeof metadata.picture === "string" && metadata.picture) ||
    null;
  const showProBorder = Boolean(session && isPro && !isLoading && !error);
  const sizeClass = compact ? "size-6" : "size-9";
  const sharedClassName = cn(
    sizeClass,
    "rounded-[10px]",
    showProBorder && "ring-2 ring-amber-400 ring-offset-1 ring-offset-background"
  );

  if (avatarUrl && !brokenAvatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={cn(sharedClassName, "object-cover")}
        onError={() => setBrokenAvatar(true)}
      />
    );
  }

  if (desktopRail) {
    return (
      <span
        className={cn(
          sharedClassName,
          "grid place-items-center text-muted-foreground"
        )}
        aria-hidden="true"
      >
        <UserRound className="size-5" strokeWidth={1.8} />
      </span>
    );
  }

  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  if (session) {
    return (
      <span
        className={cn(
          sharedClassName,
          "grid place-items-center bg-foreground text-[10px] font-semibold text-background"
        )}
        aria-hidden="true"
      >
        {initial}
      </span>
    );
  }

  return (
    <span className={cn(sharedClassName, "grid place-items-center bg-foreground text-background")}>
      <UserRound className="size-4" aria-hidden="true" />
    </span>
  );
}

function DestinationButton({
  destination,
  active,
  mobile = false,
  onSelect,
}: {
  destination: (typeof PRODUCT_DESTINATIONS)[number];
  active: boolean;
  mobile?: boolean;
  onSelect: (destination: ProductDestinationId) => void;
}) {
  const Icon = ICON_BY_NAME[destination.icon];

  return (
    <a
      href={destination.href}
      aria-current={active ? "page" : undefined}
      title={destination.label}
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

export function AdaptiveNavigation({
  activeDestination,
  authLoading,
  onDestinationSelect,
  onOpenUtilityPanel,
  year,
  onYearChange,
  editActive,
  editDisabled = false,
  onToggleEdit,
  guidedToolbarNotice = null,
  onDismissGuidedNotice,
  onGuidedToolbarAction,
}: AdaptiveNavigationProps) {
  const handleAccount = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (authLoading) return;
    onOpenUtilityPanel("account", event.currentTarget);
  };

  return (
    <>
      <nav
        aria-label="Navegação principal"
        data-product-navigation="desktop"
        className="fixed inset-y-0 left-0 z-40 hidden w-[52px] flex-col items-center border-r border-border/70 bg-background/96 px-1.5 py-2 backdrop-blur md:flex"
      >
        <div className="relative">
        <button
          type="button"
          data-onboarding-auth-entry
          aria-label="Abrir perfil"
          title="Perfil"
          disabled={authLoading}
          className="grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:opacity-45"
          onClick={handleAccount}
        >
          {authLoading ? null : <AccountGlyph desktopRail />}
        </button>

        <div className="my-2 h-px w-6 bg-border/70" aria-hidden="true" />

        <div className="flex flex-col items-center gap-1">
          {PRODUCT_DESTINATIONS.map((destination) => (
            <DestinationButton
              key={destination.id}
              destination={destination}
              active={activeDestination === destination.id}
              onSelect={onDestinationSelect}
            />
          ))}
        </div>

        <div className="my-2 h-px w-6 bg-border/70" aria-hidden="true" />

        <button
          type="button"
          data-onboarding-edit-control
          data-onboarding-highlighted={
            guidedToolbarNotice?.target === "edit" ? "true" : undefined
          }
          data-rail-edit-active={editActive ? "true" : "false"}
          aria-pressed={editActive}
          aria-label={editActive ? "Finalizar edição" : "Editar"}
          title={editActive ? "Finalizar edição" : "Editar"}
          disabled={editDisabled}
          className={cn(
            "grid size-10 place-items-center rounded-xl transition-[color,background-color,transform] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-40",
            guidedToolbarNotice?.target === "edit" && "product-spotlight-target",
            editActive
              ? "bg-foreground text-background shadow-sm"
              : "text-muted-foreground/55 hover:bg-muted/45 hover:text-foreground/80"
          )}
          onClick={() => {
            onToggleEdit();
            if (guidedToolbarNotice?.target === "edit") {
              onGuidedToolbarAction?.("edit");
            }
          }}
        >
          {editActive ? (
            <Check className="size-5" aria-hidden="true" />
          ) : (
            <PencilLine className="size-5" aria-hidden="true" />
          )}
        </button>
        {guidedToolbarNotice?.target === "edit" && onDismissGuidedNotice ? (
          <GuidedToolbarNoticeCard
            notice={guidedToolbarNotice}
            onClose={onDismissGuidedNotice}
            onAction={() => onGuidedToolbarAction?.("edit")}
            placement="right"
          />
        ) : null}
        </div>

        <div className="my-2 h-px w-6 bg-border/70" aria-hidden="true" />

        <div
          data-rail-year-stepper
          className={cn(
            "relative flex flex-col items-center text-muted-foreground",
            guidedToolbarNotice?.target === "year" && "product-spotlight-target rounded-xl"
          )}
        >
          <button
            type="button"
            data-onboarding-year-control
            aria-label={`Avançar para ${year + 1}`}
            title={`Avançar para ${year + 1}`}
            className="grid size-8 place-items-center rounded-lg transition-colors hover:bg-muted/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            onClick={() => onYearChange(year + 1)}
          >
            <ChevronUp className="size-4" aria-hidden="true" />
          </button>
          <span
            aria-label={`Ano ${year}`}
            className="py-1 text-[11px] font-semibold tracking-[-0.02em] tabular-nums text-foreground/82"
          >
            {year}
          </span>
          <button
            type="button"
            aria-label={`Voltar para ${year - 1}`}
            title={`Voltar para ${year - 1}`}
            className="grid size-8 place-items-center rounded-lg transition-colors hover:bg-muted/45 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            onClick={() => onYearChange(year - 1)}
          >
            <ChevronDown className="size-4" aria-hidden="true" />
          </button>
          {guidedToolbarNotice?.target === "year" && onDismissGuidedNotice ? (
            <GuidedToolbarNoticeCard
              notice={guidedToolbarNotice}
              onClose={onDismissGuidedNotice}
              onAction={() => onGuidedToolbarAction?.("year")}
              placement="right"
            />
          ) : null}
        </div>
      </nav>

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
    </>
  );
}
