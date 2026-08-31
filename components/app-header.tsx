"use client";

import * as React from "react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  PencilLine,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import {
  GuidedCalendarNotice,
  type GuidedSelectionNotice,
} from "@/components/onboarding/guided-selection-notice";
import {
  GuidedToolbarNoticeCard,
  type GuidedToolbarNotice,
} from "@/components/onboarding/guided-toolbar-notice";
import { GuidedTargetOutline } from "@/components/onboarding/guided-target-outline";
import { CategoryBar } from "@/components/category-bar";
import { CategoryCreationFlow } from "@/components/category-creation-flow";
import { CategoryManager } from "@/components/category-manager";
import { CalendarPackLauncher } from "@/components/calendar-packs/calendar-pack-launcher";
import {
  DesktopProductNavigation,
  type UtilityPanelSection,
} from "@/components/navigation/adaptive-navigation";
import { FilterEditPanel } from "@/components/navigation/filter-edit-panel";
import { ProfileBar } from "@/components/profile-bar";
import { ProfileIcon } from "@/components/profile-icon";
import {
  ProfileManager,
  type ProfileManagerIntent,
} from "@/components/profile-manager";
import { UserMenu } from "@/components/auth/user-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { CollapsibleControlRegion } from "@/components/ui/collapsible-control-region";
import { useStore } from "@/lib/store";
import { useScrollEdgeFade } from "@/lib/use-scroll-edge-fade";
import type { OnboardingFocusTarget } from "@/lib/onboarding";
import type { ProductDestinationId } from "@/lib/product-navigation";
import type { AnchorPoint } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DESKTOP_CONTROL_DIVIDER_CLASS,
  DESKTOP_CONTROL_GRID_GAP_CLASS,
  DESKTOP_CONTROL_MAX_WIDTH_CLASS,
  DESKTOP_CONTROL_NAV_GAP_CLASS,
  DESKTOP_CONTROL_ROW_GAP_CLASS,
} from "@/lib/desktop-control-layout";

const MOBILE_FILTERS_COLLAPSED_STORAGE_KEY = "doze52:mobile-filters:collapsed";

type AppHeaderProps = {
  year: number;
  onYearChange: (year: number) => void;
  authLoading: boolean;
  isAuthenticated: boolean;
  isMobileCalendarUi?: boolean;
  showCalendarControls?: boolean;
  useAdaptiveNavigation?: boolean;
  activeDestination?: ProductDestinationId;
  onDestinationSelect?: (destination: ProductDestinationId) => void;
  onOpenUtilityPanel?: (
    section: UtilityPanelSection,
    trigger: HTMLElement
  ) => void;
  onToggleHabitsEditing?: () => void;
  habitsEditingActive?: boolean;
  habitsOrganizeDisabled?: boolean;
  onOpenAuthDialog: (anchorPoint?: AnchorPoint) => void;
  onCalendarPackFocusYear: (year: number) => void;
  onboardingFocusTarget?: OnboardingFocusTarget;
  guidedSelectionNotice?: GuidedSelectionNotice | null;
  guidedToolbarNotice?: GuidedToolbarNotice | null;
  onDismissGuidedSelection?: () => void;
  onGuidedToolbarAction?: (target: GuidedToolbarNotice["target"]) => void;
  onGuidedCalendarOpen?: () => void;
  onGuidedCalendarClose?: () => void;
  onGuidedCalendarImported?: (uf?: string) => void;
  guidedCalendarSelectionActive?: boolean;
  guidedEditPreviewActive?: boolean;
  onboardingLayoutLocked?: boolean;
  onboardingLayoutReserved?: boolean;
  mobileExamplePreviewActive?: boolean;
  demoExplorationActive?: boolean;
  categoryCreateRequestKey?: number;
  onCategoryCreated?: (categoryId: string) => void;
  onProfileCreated?: (profileId: string) => void;
  onInlineEditModeChange?: (active: boolean) => void;
  controlledInlineEditMode?: boolean;
  onFilterLayoutChange?: () => void;
  exitInlineEditRequestKey?: number;
  onYearLabelClick?: () => void;
  onGuidedThemeChange?: () => void;
  headerMinimized?: boolean;
  onToggleHeaderMinimized?: () => void;
};

const getPreferredEditingProfileId = (
  selectedProfileIds: string[],
  profileIds: string[]
) => selectedProfileIds.find((id) => profileIds.includes(id)) ?? profileIds[0] ?? null;

export function AppHeader({
  year,
  onYearChange,
  authLoading,
  isAuthenticated,
  isMobileCalendarUi = false,
  showCalendarControls = true,
  useAdaptiveNavigation = false,
  activeDestination = "annual",
  onDestinationSelect,
  onOpenUtilityPanel,
  onToggleHabitsEditing,
  habitsEditingActive = false,
  habitsOrganizeDisabled = false,
  onOpenAuthDialog,
  onCalendarPackFocusYear,
  onboardingFocusTarget = null,
  guidedSelectionNotice = null,
  guidedToolbarNotice = null,
  onDismissGuidedSelection,
  onGuidedToolbarAction,
  onGuidedCalendarOpen,
  onGuidedCalendarClose,
  onGuidedCalendarImported,
  guidedCalendarSelectionActive = false,
  guidedEditPreviewActive = false,
  onboardingLayoutLocked = false,
  onboardingLayoutReserved = false,
  mobileExamplePreviewActive = false,
  demoExplorationActive = false,
  categoryCreateRequestKey = 0,
  onCategoryCreated,
  onProfileCreated,
  onInlineEditModeChange,
  controlledInlineEditMode,
  onFilterLayoutChange,
  exitInlineEditRequestKey = 0,
  onYearLabelClick,
  onGuidedThemeChange,
  headerMinimized = false,
  onToggleHeaderMinimized,
}: AppHeaderProps) {
  const profiles = useStore((s) => s.profiles);
  const categories = useStore((s) => s.categories);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const setSelectedProfiles = useStore((s) => s.setSelectedProfiles);
  const setCategoriesVisibility = useStore((s) => s.setCategoriesVisibility);

  const [isInlineEditMode, setIsInlineEditMode] = React.useState(false);
  const [yearSelectOpen, setYearSelectOpen] = React.useState(false);
  const [editingProfileId, setEditingProfileId] = React.useState<string | null>(null);
  const [profileManagerOpen, setProfileManagerOpen] = React.useState(false);
  const [profileManagerIntent, setProfileManagerIntent] =
    React.useState<ProfileManagerIntent | null>(null);
  const [categoryCreateOpen, setCategoryCreateOpen] = React.useState(false);
  const [categoryEditOpen, setCategoryEditOpen] = React.useState(false);
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [categoriesExpanded, setCategoriesExpanded] = React.useState(true);
  const [areMobileFiltersCollapsed, setAreMobileFiltersCollapsedState] =
    React.useState(() => {
      if (typeof window === "undefined") return false;
      try {
        return (
          window.localStorage.getItem(MOBILE_FILTERS_COLLAPSED_STORAGE_KEY) ===
          "true"
        );
      } catch {
        return false;
      }
    });
  const setAreMobileFiltersCollapsed = React.useCallback(
    (updater: boolean | ((current: boolean) => boolean)) => {
      setAreMobileFiltersCollapsedState((current) => {
        const next = typeof updater === "function" ? updater(current) : updater;
        try {
          window.localStorage.setItem(
            MOBILE_FILTERS_COLLAPSED_STORAGE_KEY,
            String(next)
          );
        } catch {
          // Sem persistência entre navegações se o storage falhar; sem impacto na sessão atual.
        }
        return next;
      });
    },
    []
  );
  const { ref: categoryScrollRef, style: categoryScrollFadeStyle } =
    useScrollEdgeFade<HTMLDivElement>();
  const previousOnboardingLayoutLockedRef = React.useRef(false);
  const effectiveInlineEditMode = onboardingLayoutLocked
    ? guidedEditPreviewActive
    : controlledInlineEditMode ?? isInlineEditMode;

  const pendingProfileCreateRestoreRef = React.useRef<{
    knownProfileIds: string[];
    selectedProfileIds: string[];
  } | null>(null);
  const previousProfileManagerOpenRef = React.useRef(false);
  const handledCategoryCreateRequestRef = React.useRef(0);
  const handledExitInlineEditRequestRef = React.useRef(0);

  const utilityIconClass =
    "h-8 w-8 rounded-[10px] border-border bg-card text-muted-foreground shadow-none transition-colors hover:border-foreground/18 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 md:h-9 md:w-9";
  const utilityActiveEditClass =
    "h-8 rounded-[10px] border border-primary bg-primary px-2.5 text-xs font-semibold text-primary-foreground shadow-none transition-colors hover:border-primary/20 hover:bg-primary/90 hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring/50 md:h-9 md:px-3.5 md:text-sm";
  const utilityButtonClass =
    "h-8 rounded-[10px] border-border bg-card px-2.5 text-xs font-semibold text-foreground shadow-none transition-colors hover:border-foreground/18 hover:bg-muted hover:text-foreground md:h-9 md:px-3.5 md:text-sm";
  const yearSelectClass =
    "h-8 min-w-[82px] rounded-[10px] border-border bg-card px-2.5 text-[0.9rem] font-semibold text-foreground shadow-none hover:border-foreground/18 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60 md:h-9 md:min-w-[90px] md:px-3.5 md:text-[1rem] [&_svg]:opacity-70 [&_svg]:text-muted-foreground";
  const categoryToggleClass =
    "inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-border bg-card text-foreground/70 shadow-none transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out hover:border-foreground/18 hover:bg-muted hover:text-foreground active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45";
  const highlightedProfileId =
    onboardingFocusTarget?.kind === "profile" ? onboardingFocusTarget.id : null;
  const highlightedCategoryId =
    onboardingFocusTarget?.kind === "category" ? onboardingFocusTarget.id : null;
  const highlightedCategoryEffect =
    onboardingFocusTarget?.kind === "category"
      ? onboardingFocusTarget.effect ?? "focus"
      : "focus";
  const effectiveCategoriesExpanded =
    categoriesExpanded ||
    effectiveInlineEditMode ||
    highlightedCategoryEffect === "reveal";
  const filtersLocked = onboardingLayoutLocked || Boolean(guidedSelectionNotice);
  const inlineEditDisabled =
    mobileExamplePreviewActive ||
    (onboardingLayoutLocked && guidedToolbarNotice?.target !== "edit");
  const calendarLauncherDisabled =
    mobileExamplePreviewActive ||
    (onboardingLayoutLocked && !guidedCalendarSelectionActive);
  const yearSelectDisabled = onboardingLayoutLocked;
  const themeToggleDisabled =
    onboardingLayoutLocked && guidedToolbarNotice?.target !== "theme";
  const isMobileMode = isMobileCalendarUi === true;
  const filterPanelId = React.useId();
  const showMobileFilterPanel =
    !isMobileMode ||
    !areMobileFiltersCollapsed ||
    effectiveInlineEditMode ||
    highlightedCategoryEffect === "reveal";
  const selectedProfile = React.useMemo(
    () =>
      profiles.find((profile) => selectedProfileIds.includes(profile.id)) ??
      profiles[0] ??
      null,
    [profiles, selectedProfileIds]
  );

  const canMinimizeHeader = useAdaptiveNavigation && !isMobileMode;
  // Initial value matches SSR (always expanded) to avoid a hydration
  // mismatch; the real viewport-based default is applied client-side right
  // after mount, before paint. headerMinimized itself is owned by the parent
  // (shared with the Habits surface, which has its own equivalent chrome to
  // hide using the very same toggle).
  const [categoriesRowExpanded, setCategoriesRowExpanded] = React.useState(true);

  React.useLayoutEffect(() => {
    if (!canMinimizeHeader) return;
    setCategoriesRowExpanded(window.innerHeight >= 900);
  }, [canMinimizeHeader]);

  React.useEffect(() => {
    if (!effectiveInlineEditMode) return;
    const profileIds = profiles.map((profile) => profile.id);
    setEditingProfileId((current) => {
      if (current && profileIds.includes(current)) return current;
      return getPreferredEditingProfileId(selectedProfileIds, profileIds);
    });
  }, [effectiveInlineEditMode, profiles, selectedProfileIds]);

  React.useEffect(() => {
    if (!useAdaptiveNavigation || guidedToolbarNotice?.target !== "calendars") return;
    const profileIds = profiles.map((profile) => profile.id);
    setEditingProfileId(
      getPreferredEditingProfileId(selectedProfileIds, profileIds)
    );
  }, [guidedToolbarNotice?.target, profiles, selectedProfileIds, useAdaptiveNavigation]);

  React.useEffect(() => {
    const wasOpen = previousProfileManagerOpenRef.current;
    previousProfileManagerOpenRef.current = profileManagerOpen;

    if (!wasOpen || profileManagerOpen) {
      return;
    }

    const pendingCreateRestore = pendingProfileCreateRestoreRef.current;
    if (!pendingCreateRestore) {
      return;
    }

    pendingProfileCreateRestoreRef.current = null;

    const createdProfile =
      profiles.find((profile) => !pendingCreateRestore.knownProfileIds.includes(profile.id)) ??
      null;

    setSelectedProfiles(pendingCreateRestore.selectedProfileIds);

    if (createdProfile) {
      setEditingProfileId(createdProfile.id);
    }
  }, [profileManagerOpen, profiles, setSelectedProfiles]);

  React.useEffect(() => {
    if (effectiveInlineEditMode) {
      setAreMobileFiltersCollapsed(false);
    }
  }, [effectiveInlineEditMode, setAreMobileFiltersCollapsed]);

  React.useEffect(() => {
    const wasLocked = previousOnboardingLayoutLockedRef.current;
    previousOnboardingLayoutLockedRef.current = onboardingLayoutLocked;
    if (wasLocked && !onboardingLayoutLocked) {
      setIsInlineEditMode(false);
    }
  }, [onboardingLayoutLocked]);

  React.useEffect(() => {
    if (
      exitInlineEditRequestKey <= 0 ||
      exitInlineEditRequestKey === handledExitInlineEditRequestRef.current
    ) {
      return;
    }
    handledExitInlineEditRequestRef.current = exitInlineEditRequestKey;
    setIsInlineEditMode(false);
    onInlineEditModeChange?.(false);
  }, [exitInlineEditRequestKey, onInlineEditModeChange]);

  React.useEffect(() => {
    if (
      categoryCreateRequestKey <= 0 ||
      categoryCreateRequestKey === handledCategoryCreateRequestRef.current
    ) {
      return;
    }
    handledCategoryCreateRequestRef.current = categoryCreateRequestKey;
    const profileId =
      selectedProfileIds[0] ?? profiles[0]?.id ?? null;
    if (!profileId) return;
    setEditingProfileId(profileId);
    setCategoryCreateOpen(true);
  }, [categoryCreateRequestKey, profiles, selectedProfileIds]);

  React.useEffect(() => {
    if (!highlightedCategoryId) return;
    const highlightedCategory = useStore
      .getState()
      .categories.find((category) => category.id === highlightedCategoryId);
    if (!highlightedCategory) return;
    const wasVisible = highlightedCategory.visible;
    if (!wasVisible) setCategoriesVisibility([highlightedCategoryId], true);

    return () => {
      if (!wasVisible) setCategoriesVisibility([highlightedCategoryId], false);
    };
  }, [highlightedCategoryId, setCategoriesVisibility]);

  React.useEffect(() => {
    if (!highlightedCategoryId) return;
    const highlightedCategory = categories.find(
      (category) => category.id === highlightedCategoryId
    );
    if (highlightedCategory && !highlightedCategory.visible) {
      setCategoriesVisibility([highlightedCategoryId], true);
    }
  }, [categories, highlightedCategoryId, setCategoriesVisibility]);

  const toggleInlineEditMode = React.useCallback(() => {
    const next = !effectiveInlineEditMode;
    if (next) {
      const profileIds = profiles.map((profile) => profile.id);
      setEditingProfileId(
        getPreferredEditingProfileId(selectedProfileIds, profileIds)
      );
    }
    if (!onboardingLayoutLocked && controlledInlineEditMode === undefined) {
      setIsInlineEditMode(next);
    }
    onInlineEditModeChange?.(next);
    if (guidedToolbarNotice?.target === "edit") {
      onGuidedToolbarAction?.("edit");
    }
  }, [
    guidedToolbarNotice?.target,
    effectiveInlineEditMode,
    onboardingLayoutLocked,
    controlledInlineEditMode,
    onGuidedToolbarAction,
    onInlineEditModeChange,
    profiles,
    selectedProfileIds,
  ]);

  // Desktop consolidates Anual + Hábitos editing into the same panel/trigger
  // (FilterEditPanel); mobile keeps each surface's own separate edit mode.
  const organizeActive =
    isMobileMode && activeDestination === "habits"
      ? habitsEditingActive
      : effectiveInlineEditMode;
  const organizeDisabled =
    isMobileMode && activeDestination === "habits"
      ? habitsOrganizeDisabled
      : inlineEditDisabled;

  const handleToggleOrganize = React.useCallback(() => {
    if (organizeDisabled) return;
    if (isMobileMode && activeDestination === "habits") {
      onToggleHabitsEditing?.();
      return;
    }
    toggleInlineEditMode();
  }, [
    activeDestination,
    isMobileMode,
    organizeDisabled,
    onToggleHabitsEditing,
    toggleInlineEditMode,
  ]);

  const openCreateProfile = React.useCallback(() => {
    pendingProfileCreateRestoreRef.current = {
      knownProfileIds: profiles.map((profile) => profile.id),
      selectedProfileIds: [...selectedProfileIds],
    };
    setProfileManagerIntent({ mode: "create" });
    setProfileManagerOpen(true);
  }, [profiles, selectedProfileIds]);

  const openEditProfile = React.useCallback((profileId: string) => {
    setProfileManagerIntent({ mode: "edit", profileId });
    setProfileManagerOpen(true);
  }, []);

  const handleProfileManagerOpenChange = React.useCallback((nextOpen: boolean) => {
    setProfileManagerOpen(nextOpen);
    if (!nextOpen) {
      setProfileManagerIntent(null);
    }
  }, []);

  const openCreateCategory = React.useCallback(() => {
    if (!editingProfileId) return;
    setCategoryCreateOpen(true);
  }, [editingProfileId]);

  const openEditCategory = React.useCallback((categoryId: string) => {
    setEditingCategoryId(categoryId);
    setCategoryEditOpen(true);
  }, []);

  const guidedOutlineSelector =
    guidedToolbarNotice?.target === "edit"
      ? '[data-onboarding-edit-control][data-onboarding-highlighted="true"], [data-product-organize="desktop"][data-onboarding-highlighted="true"]'
      : guidedToolbarNotice?.target === "calendars"
        ? '[data-onboarding-calendar-control][data-onboarding-highlighted="true"]'
        : guidedToolbarNotice?.target === "habit-surface"
          ? '[data-product-navigation="desktop"] [data-product-destination="habits"]'
          : null;

  return (
    <>
      {guidedOutlineSelector ? (
        <GuidedTargetOutline selector={guidedOutlineSelector} />
      ) : null}
      <header
        className={cn(
          "bg-background",
          isMobileMode
            ? "space-y-0"
            : "space-y-3",
          useAdaptiveNavigation
            ? DESKTOP_CONTROL_NAV_GAP_CLASS
            : "md:space-y-3.5",
          isMobileMode
            ? "mb-0"
            : headerMinimized
              ? DESKTOP_CONTROL_GRID_GAP_CLASS
              : useAdaptiveNavigation && !showCalendarControls
                ? "mb-0"
                : useAdaptiveNavigation
                  ? DESKTOP_CONTROL_GRID_GAP_CLASS
                  : "mb-4 md:mb-5"
        )}
      >
        <div
          data-app-header-navigation-row
          className={cn(
            "relative min-h-9 md:min-h-10",
            useAdaptiveNavigation && isMobileMode
              ? "fixed inset-x-0 top-0 z-40 flex h-12 items-center justify-between bg-background/92 px-3 pt-[env(safe-area-inset-top,0px)] backdrop-blur"
              : useAdaptiveNavigation
                ? "flex items-center justify-between md:grid md:grid-cols-[1fr_auto_1fr]"
                : "grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4"
          )}
        >
          <div
            data-brand-logo-position={
              useAdaptiveNavigation ? "header-adaptive" : undefined
            }
            className={cn(useAdaptiveNavigation && "md:justify-self-start")}
          >
            <BrandLogo />
          </div>

          {useAdaptiveNavigation && onDestinationSelect && onOpenUtilityPanel ? (
            <DesktopProductNavigation
              activeDestination={activeDestination}
              authLoading={authLoading}
              onDestinationSelect={onDestinationSelect}
              onOpenUtilityPanel={onOpenUtilityPanel}
              onToggleOrganize={handleToggleOrganize}
              organizeActive={organizeActive}
              organizeDisabled={organizeDisabled}
              organizeHighlighted={guidedToolbarNotice?.target === "edit"}
              highlightProfile={guidedToolbarNotice?.target === "profile"}
              highlightDestination={
                guidedToolbarNotice?.target === "habit-surface" ? "habits" : undefined
              }
              themeHighlighted={guidedToolbarNotice?.target === "theme"}
              themeDisabled={themeToggleDisabled}
              onGuidedThemeChange={onGuidedThemeChange}
              showHeaderMinimizeToggle={canMinimizeHeader}
              headerMinimized={headerMinimized}
              onToggleHeaderMinimized={() => {
                onToggleHeaderMinimized?.();
                onFilterLayoutChange?.();
              }}
            />
          ) : null}
          {guidedToolbarNotice?.target === "theme" &&
          onDismissGuidedSelection ? (
            <GuidedToolbarNoticeCard
              notice={guidedToolbarNotice}
              onClose={onDismissGuidedSelection}
              onAction={
                guidedToolbarNotice.actionLabel
                  ? () => onGuidedToolbarAction?.("theme")
                  : undefined
              }
              placement="viewport"
              portaled
              anchorSelector="[data-product-theme='desktop']"
              anchorPlacement="below-end"
            />
          ) : null}
          {guidedToolbarNotice?.target === "profile" &&
          onDismissGuidedSelection ? (
            <GuidedToolbarNoticeCard
              notice={guidedToolbarNotice}
              onClose={onDismissGuidedSelection}
              placement="viewport"
              portaled
              anchorSelector="[data-product-account='desktop']"
              anchorPlacement="below-end"
            />
          ) : null}
          {guidedToolbarNotice?.target === "habit-surface" &&
          onDismissGuidedSelection ? (
            <GuidedToolbarNoticeCard
              notice={guidedToolbarNotice}
              onClose={onDismissGuidedSelection}
              placement="viewport"
              portaled
              anchorSelector="[data-product-navigation='desktop'] [data-product-destination='habits']"
              anchorPlacement="below-center"
            />
          ) : null}

          <div
            className={cn(
              "min-w-0",
              useAdaptiveNavigation ? "md:hidden" : "w-full justify-self-end"
            )}
          >
            <div
              data-onboarding-toolbar-spotlight={
                guidedToolbarNotice ? "true" : undefined
              }
              className="flex min-w-0 flex-wrap items-center justify-end gap-1 sm:gap-2"
            >
              {useAdaptiveNavigation ? (
                <button
                  type="button"
                  data-product-organize="mobile"
                  aria-pressed={organizeActive}
                  aria-label={organizeActive ? "Finalizar organização" : "Organizar"}
                  title={organizeActive ? "Finalizar organização" : "Organizar"}
                  disabled={organizeDisabled}
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground",
                    organizeActive &&
                      "bg-foreground text-background hover:bg-foreground/90 hover:text-background"
                  )}
                  onClick={handleToggleOrganize}
                >
                  <LayoutGrid className="size-[18px]" />
                </button>
              ) : null}
              {useAdaptiveNavigation ? (
                <span
                  data-onboarding-spotlight-target={
                    guidedToolbarNotice?.target === "theme" ? "true" : undefined
                  }
                  className="relative"
                >
                  <ThemeToggle
                    variant="bare"
                    highlighted={guidedToolbarNotice?.target === "theme"}
                    disabled={themeToggleDisabled}
                    onThemeChange={onGuidedThemeChange}
                  />
                  {guidedToolbarNotice?.target === "theme" &&
                  onDismissGuidedSelection ? (
                    <GuidedToolbarNoticeCard
                      notice={guidedToolbarNotice}
                      onClose={onDismissGuidedSelection}
                      onAction={
                        guidedToolbarNotice.actionLabel
                          ? () => onGuidedToolbarAction?.("theme")
                          : undefined
                      }
                      align="end"
                    />
                  ) : null}
                </span>
              ) : null}
              {showCalendarControls && !useAdaptiveNavigation ? (
                <div
                  data-onboarding-spotlight-target={
                    guidedToolbarNotice?.target === "edit" ? "true" : undefined
                  }
                  className={cn(
                    "relative shrink-0",
                    useAdaptiveNavigation && "md:hidden"
                  )}
                >
                {effectiveInlineEditMode ? (
                  <Button
                    type="button"
                    data-onboarding-edit-control
                    data-onboarding-highlighted={
                      guidedToolbarNotice?.target === "edit"
                        ? "true"
                        : undefined
                    }
                    variant="premium"
                    size="sm"
                    disabled={inlineEditDisabled}
                    className={utilityActiveEditClass}
                    onClick={toggleInlineEditMode}
                    aria-label="Finalizar edição de contextos e categorias"
                    title="Finalizar edição de contextos e categorias"
                  >
                    <Check className="h-4 w-4" />
                    <span className="hidden min-[420px]:inline">Finalizar</span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    data-onboarding-edit-control
                    data-onboarding-highlighted={
                      guidedToolbarNotice?.target === "edit"
                        ? "true"
                        : undefined
                    }
                    variant="outline"
                    size="icon-sm"
                    disabled={inlineEditDisabled}
                    className={utilityIconClass}
                    onClick={toggleInlineEditMode}
                    aria-label="Editar contextos e categorias"
                    title="Editar contextos e categorias"
                  >
                    <PencilLine className="h-4 w-4" />
                  </Button>
                )}
                {guidedToolbarNotice?.target === "edit" &&
                onDismissGuidedSelection ? (
                  <GuidedToolbarNoticeCard
                    notice={guidedToolbarNotice}
                    onClose={onDismissGuidedSelection}
                    onAction={() => onGuidedToolbarAction?.("edit")}
                  />
                ) : null}
                </div>
              ) : null}

              {showCalendarControls && !useAdaptiveNavigation ? (
                <div
                  data-onboarding-spotlight-target={
                    guidedToolbarNotice?.target === "calendars" ? "true" : undefined
                  }
                  className="relative shrink-0"
                >
                <CalendarPackLauncher
                  onFocusYear={onCalendarPackFocusYear}
                  className="shrink-0"
                  onRequireAuth={() => onOpenAuthDialog()}
                  disabled={calendarLauncherDisabled}
                  bypassLimits={demoExplorationActive}
                  highlighted={guidedToolbarNotice?.target === "calendars"}
                  guidedVariantGroupId={
                    guidedCalendarSelectionActive
                      ? "holidays-by-state"
                      : undefined
                  }
                  requireExplicitVariant={guidedCalendarSelectionActive}
                  onOpen={onGuidedCalendarOpen}
                  onClose={onGuidedCalendarClose}
                  onImported={(pack) =>
                    onGuidedCalendarImported?.(pack.regionCode)
                  }
                />
                {guidedToolbarNotice?.target === "calendars" &&
                onDismissGuidedSelection ? (
                  <GuidedToolbarNoticeCard
                    notice={guidedToolbarNotice}
                    onClose={onDismissGuidedSelection}
                  />
                ) : null}
                </div>
              ) : null}

              <div
                data-onboarding-spotlight-target={
                  guidedToolbarNotice?.target === "year" ? "true" : undefined
                }
                className={cn(
                  "relative shrink-0",
                  useAdaptiveNavigation && "md:hidden"
                )}
              >
                {useAdaptiveNavigation ? (
                  <div
                    data-onboarding-year-control
                    data-onboarding-highlighted={
                      guidedToolbarNotice?.target === "year" ? "true" : undefined
                    }
                    className={cn(
                      "inline-flex h-9 items-center rounded-xl border border-border bg-card",
                      guidedToolbarNotice?.target === "year" &&
                        "product-spotlight-target"
                    )}
                  >
                    <button
                      type="button"
                      aria-label={`Voltar para ${year - 1}`}
                      title={`Voltar para ${year - 1}`}
                      disabled={yearSelectDisabled}
                      className="grid size-9 place-items-center rounded-l-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-45"
                      onClick={() => onYearChange(year - 1)}
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    {onYearLabelClick ? (
                      <button
                        type="button"
                        aria-label={`Ano ${year}. Ir para hoje`}
                        aria-live="polite"
                        title="Ir para hoje"
                        className="min-w-9 text-center text-[0.9rem] font-semibold tabular-nums text-foreground transition-colors hover:text-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:rounded-md"
                        onClick={onYearLabelClick}
                      >
                        {year}
                      </button>
                    ) : (
                      <span
                        aria-label={`Ano ${year}`}
                        aria-live="polite"
                        className="min-w-9 text-center text-[0.9rem] font-semibold tabular-nums text-foreground"
                      >
                        {year}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`Avançar para ${year + 1}`}
                      title={`Avançar para ${year + 1}`}
                      disabled={yearSelectDisabled}
                      className="grid size-9 place-items-center rounded-r-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-45"
                      onClick={() => onYearChange(year + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                ) : (
                  <Select
                    value={String(year)}
                    disabled={yearSelectDisabled}
                    open={yearSelectOpen}
                    onOpenChange={setYearSelectOpen}
                    onValueChange={(v) => onYearChange(Number(v))}
                  >
                    <SelectTrigger
                      data-onboarding-year-control
                      data-onboarding-highlighted={
                        guidedToolbarNotice?.target === "year" ? "true" : undefined
                      }
                      className={cn(
                        yearSelectClass,
                        guidedToolbarNotice?.target === "year" &&
                          "product-spotlight-target"
                      )}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(year - 1)}>{year - 1}</SelectItem>
                      <SelectItem value={String(year)}>{year}</SelectItem>
                      <SelectItem value={String(year + 1)}>{year + 1}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {guidedToolbarNotice?.target === "year" &&
                !yearSelectOpen &&
                onDismissGuidedSelection ? (
                  <GuidedToolbarNoticeCard
                    notice={guidedToolbarNotice}
                    onClose={onDismissGuidedSelection}
                    onAction={() => onGuidedToolbarAction?.("year")}
                    align="end"
                  />
                ) : null}
              </div>

              {!useAdaptiveNavigation ? (
                <>
                  <div
                    data-onboarding-spotlight-target={
                      guidedToolbarNotice?.target === "theme" ? "true" : undefined
                    }
                    className="relative shrink-0"
                  >
                    <ThemeToggle
                      highlighted={guidedToolbarNotice?.target === "theme"}
                      disabled={themeToggleDisabled}
                    />
                    {guidedToolbarNotice?.target === "theme" &&
                    onDismissGuidedSelection ? (
                      <GuidedToolbarNoticeCard
                        notice={guidedToolbarNotice}
                        onClose={onDismissGuidedSelection}
                        onAction={
                          guidedToolbarNotice.actionLabel
                            ? () => onGuidedToolbarAction?.("theme")
                            : undefined
                        }
                        align="end"
                      />
                    ) : null}
                  </div>

                  <div className="flex h-8 items-center justify-end md:h-9">
                    {authLoading ? null : isAuthenticated ? (
                      <UserMenu />
                    ) : (
                      <Button
                        data-onboarding-auth-entry
                        size="sm"
                        variant="outline"
                        disabled={onboardingLayoutLocked}
                        className={utilityButtonClass}
                        onClick={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          onOpenAuthDialog({ x: rect.right, y: rect.bottom });
                        }}
                      >
                        Entrar
                      </Button>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
        {useAdaptiveNavigation && isMobileMode && showCalendarControls ? (
          <div aria-hidden="true" className="h-12" />
        ) : null}

        {showCalendarControls &&
        !(headerMinimized && canMinimizeHeader && !onboardingLayoutLocked) ? (
          <div
            data-onboarding-filter-region
            className={cn(
              "relative isolate mx-auto flex w-full flex-col items-center gap-1.5 md:gap-2",
              isMobileMode
                ? "max-w-[31rem]"
                : cn(
                    useAdaptiveNavigation
                      ? DESKTOP_CONTROL_MAX_WIDTH_CLASS
                      : "max-w-[62rem]",
                    useAdaptiveNavigation
                      ? cn(
                          DESKTOP_CONTROL_DIVIDER_CLASS,
                          DESKTOP_CONTROL_ROW_GAP_CLASS
                        )
                      : "border-t border-border/45 pt-2.5 md:pt-3"
                  ),
              onboardingLayoutReserved &&
                (isMobileMode ? "min-h-[10.25rem]" : "min-h-[5.6rem]")
            )}
          >
          <div
            className={cn(
              "flex w-full flex-col items-center gap-1.5 transition-opacity duration-150 md:gap-2"
            )}
            inert={filtersLocked ? true : undefined}
            aria-hidden={filtersLocked ? true : undefined}
          >
            {isMobileMode ? (
              <div className="w-full overflow-hidden rounded-[10px] border border-border bg-card">
              <div className="m-[3px] flex h-10 w-[calc(100%-6px)] items-center gap-1 rounded-[8px] px-2.5">
                <span className="flex min-w-0 items-center gap-2.5">
                  {!effectiveInlineEditMode && selectedProfile ? (
                    <span className="grid h-7 w-7 shrink-0 place-items-center text-foreground/72">
                      <ProfileIcon
                        icon={selectedProfile.icon}
                        size={13}
                        className="shrink-0"
                      />
                    </span>
                  ) : null}
                  <span className="block min-w-0 truncate text-[13px] font-semibold leading-4 text-foreground">
                    {effectiveInlineEditMode
                      ? "Contextos"
                      : (selectedProfile?.name ?? "Contextos")}
                  </span>
                </span>
                <span className="relative ml-auto flex shrink-0 items-center gap-1">
                  {!useAdaptiveNavigation ? (
                    <>
                      <button
                        type="button"
                        data-onboarding-edit-control
                        data-onboarding-highlighted={
                          guidedToolbarNotice?.target === "edit" ? "true" : undefined
                        }
                        aria-pressed={effectiveInlineEditMode}
                        aria-label={effectiveInlineEditMode ? "Finalizar edição" : "Editar"}
                        title={effectiveInlineEditMode ? "Finalizar edição" : "Editar"}
                        disabled={inlineEditDisabled}
                        className={cn(
                          categoryToggleClass,
                          effectiveInlineEditMode &&
                            "border-foreground bg-foreground text-background hover:bg-foreground/90 hover:text-background"
                        )}
                        onClick={toggleInlineEditMode}
                      >
                        {effectiveInlineEditMode ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <PencilLine className="h-3.5 w-3.5" />
                        )}
                      </button>
                      {guidedToolbarNotice?.target === "edit" &&
                      onDismissGuidedSelection ? (
                        <GuidedToolbarNoticeCard
                          notice={guidedToolbarNotice}
                          onClose={onDismissGuidedSelection}
                          onAction={() => onGuidedToolbarAction?.("edit")}
                        />
                      ) : null}
                    </>
                  ) : null}
                  {!effectiveInlineEditMode ? (
                    <button
                      type="button"
                      className={categoryToggleClass}
                      aria-expanded={showMobileFilterPanel}
                      aria-controls={filterPanelId}
                      aria-label={
                        showMobileFilterPanel
                          ? "Recolher contextos e categorias"
                          : "Mostrar contextos e categorias"
                      }
                      onClick={() =>
                        setAreMobileFiltersCollapsed((current) => !current)
                      }
                    >
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                          showMobileFilterPanel ? "rotate-180" : "rotate-0"
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  ) : null}
                </span>
              </div>

              <CollapsibleControlRegion
                id={filterPanelId}
                expanded={showMobileFilterPanel}
                contentClassName={cn(
                  "px-2",
                  showMobileFilterPanel
                    ? "border-t border-border/55 py-2"
                    : "border-0 py-0"
                )}
              >
                  <div className="grid w-full grid-cols-1 gap-1.5">
                    <ProfileBar
                      compact
                      mobileDense
                      className="w-full"
                      isInlineEditMode={effectiveInlineEditMode}
                      editingProfileId={editingProfileId}
                      onEditingProfileChange={setEditingProfileId}
                      onCreateProfile={openCreateProfile}
                      onEditProfile={openEditProfile}
                      highlightedProfileId={highlightedProfileId}
                    />
                  </div>

                  <div className="relative mt-2 border-t border-border/55 pt-2">
                    <CategoryBar
                      compact
                      mobileDense
                      isInlineEditMode={effectiveInlineEditMode}
                      editingProfileId={editingProfileId}
                      onCreateCategory={openCreateCategory}
                      onEditCategory={openEditCategory}
                      highlightedCategoryId={highlightedCategoryId}
                      highlightedCategoryEffect={highlightedCategoryEffect}
                      highlightCreate={guidedToolbarNotice?.target === "calendars"}
                    />
                    {guidedToolbarNotice?.target === "calendars" &&
                    !categoryCreateOpen &&
                    onDismissGuidedSelection ? (
                      <GuidedToolbarNoticeCard
                        notice={guidedToolbarNotice}
                        onClose={onDismissGuidedSelection}
                      />
                    ) : null}
                  </div>
              </CollapsibleControlRegion>
              </div>
            ) : useAdaptiveNavigation ? (
              <div
                ref={categoryScrollRef}
                style={categoryScrollFadeStyle}
                className="relative -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 pb-0.5 doze52-scrollbar-none sm:mx-0 sm:w-full sm:px-0"
              >
                <div className="flex w-max min-w-full flex-nowrap items-center justify-center gap-x-2 gap-y-1.5 sm:gap-x-2.5">
                  <div className="flex shrink-0 flex-nowrap items-center justify-center gap-1.5 sm:gap-2">
                    <ProfileBar
                      compact
                      className="w-max flex-nowrap justify-start sm:w-auto"
                      highlightedProfileId={highlightedProfileId}
                    />

                    {guidedToolbarNotice?.target === "edit" &&
                    onDismissGuidedSelection ? (
                      <GuidedToolbarNoticeCard
                        notice={guidedToolbarNotice}
                        onClose={onDismissGuidedSelection}
                        onAction={() => onGuidedToolbarAction?.("edit")}
                        placement="viewport"
                        portaled
                        anchorSelector='[data-product-organize="desktop"][data-onboarding-highlighted="true"]'
                        anchorPlacement="below-center"
                      />
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setCategoriesRowExpanded((current) => !current);
                      onFilterLayoutChange?.();
                    }}
                    aria-pressed={categoriesRowExpanded}
                    aria-expanded={categoriesRowExpanded}
                    aria-controls="app-header-categories-inline"
                    aria-label={
                      categoriesRowExpanded
                        ? "Recolher categorias"
                        : "Mostrar categorias"
                    }
                    title={
                      categoriesRowExpanded
                        ? "Recolher categorias"
                        : "Mostrar categorias"
                    }
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-foreground/70 shadow-none transition-colors duration-150 ease-out hover:bg-muted hover:text-foreground active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
                  >
                    {categoriesRowExpanded ? (
                      <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>

                  {categoriesRowExpanded ? (
                    <div
                      id="app-header-categories-inline"
                      className="flex shrink-0 flex-nowrap items-center justify-center gap-1.5 sm:gap-2"
                    >
                      <CategoryBar
                        compact
                        className="w-max flex-nowrap justify-start sm:w-auto"
                        highlightedCategoryId={highlightedCategoryId}
                        highlightedCategoryEffect={highlightedCategoryEffect}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <>
              <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 pb-0.5 doze52-scrollbar-none sm:mx-0 sm:w-full sm:px-0">
                <div className="flex w-max min-w-full flex-nowrap items-center justify-center gap-x-1.5 gap-y-1.5 sm:gap-x-2">
                  <div className="flex shrink-0 flex-nowrap items-center justify-center gap-1.5 sm:gap-2">
                    <ProfileBar
                      compact
                      className="w-max flex-nowrap justify-start sm:w-auto"
                      isInlineEditMode={effectiveInlineEditMode}
                      editingProfileId={editingProfileId}
                      onEditingProfileChange={setEditingProfileId}
                      onCreateProfile={openCreateProfile}
                      onEditProfile={openEditProfile}
                      highlightedProfileId={highlightedProfileId}
                    />

                    {guidedToolbarNotice?.target === "edit" &&
                    onDismissGuidedSelection ? (
                      <GuidedToolbarNoticeCard
                        notice={guidedToolbarNotice}
                        onClose={onDismissGuidedSelection}
                        onAction={() => onGuidedToolbarAction?.("edit")}
                        placement="viewport"
                        portaled
                        anchorSelector='[data-product-organize="desktop"][data-onboarding-highlighted="true"]'
                        anchorPlacement="below-center"
                      />
                    ) : null}

                    {!effectiveInlineEditMode ? (
                      <button
                        type="button"
                        className={categoryToggleClass}
                        onClick={() => {
                          setCategoriesExpanded((current) => !current);
                          onFilterLayoutChange?.();
                        }}
                        aria-label={
                          effectiveCategoriesExpanded
                            ? "Recolher categorias"
                            : "Mostrar categorias"
                        }
                        aria-expanded={effectiveCategoriesExpanded}
                        aria-controls={
                          effectiveCategoriesExpanded
                            ? "app-header-categories"
                            : undefined
                        }
                        title={
                          effectiveCategoriesExpanded
                            ? "Recolher categorias"
                            : "Mostrar categorias"
                        }
                      >
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                            effectiveCategoriesExpanded ? "rotate-180" : ""
                          }`}
                          aria-hidden="true"
                        />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {effectiveCategoriesExpanded ? (
                <div
                  id="app-header-categories"
                  className="w-full origin-top transition-[opacity,transform] duration-150 ease-out"
                >
                  <div
                    ref={categoryScrollRef}
                    style={categoryScrollFadeStyle}
                    className="-mx-4 overflow-x-auto px-4 pb-0.5 doze52-scrollbar-none sm:mx-0 sm:px-0"
                  >
                    <CategoryBar
                      compact
                      className="w-max min-w-full flex-nowrap justify-center"
                      isInlineEditMode={effectiveInlineEditMode}
                      editingProfileId={editingProfileId}
                      onCreateCategory={openCreateCategory}
                      onEditCategory={openEditCategory}
                      highlightedCategoryId={highlightedCategoryId}
                      highlightedCategoryEffect={highlightedCategoryEffect}
                    />
                  </div>
                </div>
              ) : null}
              </>
            )}
          </div>

          {guidedSelectionNotice && onDismissGuidedSelection ? (
            <div
              data-guided-selection-overlay
              className={cn(
                "pointer-events-auto absolute inset-x-0 z-[50] flex w-full items-center justify-center overflow-hidden bg-background",
                isMobileMode ? "inset-y-0" : "top-px -bottom-3"
              )}
            >
              <div
                data-guided-selection-card
                className="inverse-product-surface pointer-events-auto w-[min(34rem,calc(100%-1rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-22px_rgba(15,23,42,0.84)]"
              >
                <GuidedCalendarNotice
                  notice={guidedSelectionNotice}
                  onClose={onDismissGuidedSelection}
                />
              </div>
            </div>
          ) : null}
          </div>
        ) : null}

        {!showCalendarControls || isMobileMode || useAdaptiveNavigation ? null : (
          <div
            data-onboarding-filter-separator
            className="mx-auto h-px w-full max-w-[62rem] bg-border/45"
          />
        )}

      </header>

      {useAdaptiveNavigation && !isMobileMode ? (
        <FilterEditPanel
          open={effectiveInlineEditMode}
          activeDestination={activeDestination}
          onOpenChange={(next) => {
            if (!next && effectiveInlineEditMode) {
              toggleInlineEditMode();
            }
          }}
          editingProfileId={editingProfileId}
          onEditingProfileChange={setEditingProfileId}
          onCreateProfile={openCreateProfile}
          onEditProfile={openEditProfile}
          onCreateCategory={openCreateCategory}
          onEditCategory={openEditCategory}
          highlightedProfileId={highlightedProfileId}
          highlightedCategoryId={highlightedCategoryId}
          highlightedCategoryEffect={highlightedCategoryEffect}
          guidedToolbarNotice={guidedToolbarNotice}
          onDismissGuidedSelection={onDismissGuidedSelection}
          onRequireAuth={() => onOpenAuthDialog()}
        />
      ) : null}

      <ProfileManager
        open={profileManagerOpen}
        onOpenChange={handleProfileManagerOpenChange}
        intent={profileManagerIntent}
        onRequireAuth={() => onOpenAuthDialog()}
        bypassLimits={demoExplorationActive}
        onCreated={onProfileCreated}
      />

      {useAdaptiveNavigation ? (
        <CategoryCreationFlow
          open={categoryCreateOpen}
          onOpenChange={setCategoryCreateOpen}
          profileId={editingProfileId ?? undefined}
          onCreated={onCategoryCreated}
          onFocusYear={onCalendarPackFocusYear}
          onRequireAuth={() => onOpenAuthDialog()}
          bypassLimits={demoExplorationActive}
          guidedCalendarSelection={guidedCalendarSelectionActive}
          onCalendarOpen={onGuidedCalendarOpen}
          onCalendarClose={onGuidedCalendarClose}
          onCalendarImported={(pack) =>
            onGuidedCalendarImported?.(pack.regionCode)
          }
        />
      ) : (
        <CategoryManager
          mode="create"
          open={categoryCreateOpen}
          onOpenChange={setCategoryCreateOpen}
          profileId={editingProfileId ?? undefined}
          onCreated={onCategoryCreated}
          onRequireAuth={() => onOpenAuthDialog()}
          bypassLimits={demoExplorationActive}
        />
      )}

      <CategoryManager
        mode="edit"
        open={categoryEditOpen}
        onOpenChange={(open) => {
          setCategoryEditOpen(open);
          if (!open) {
            setEditingCategoryId(null);
          }
        }}
        categoryId={editingCategoryId ?? undefined}
        bypassLimits={demoExplorationActive}
      />
    </>
  );
}
