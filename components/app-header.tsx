"use client";

import * as React from "react";
import { Check, ChevronDown, PencilLine } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import {
  GuidedCalendarNotice,
  type GuidedSelectionNotice,
} from "@/components/onboarding/guided-selection-notice";
import {
  GuidedToolbarNoticeCard,
  type GuidedToolbarNotice,
} from "@/components/onboarding/guided-toolbar-notice";
import { CategoryBar } from "@/components/category-bar";
import { CategoryManager } from "@/components/category-manager";
import { CalendarPackLauncher } from "@/components/calendar-packs/calendar-pack-launcher";
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
import { useStore } from "@/lib/store";
import type { OnboardingFocusTarget } from "@/lib/onboarding";
import type { AnchorPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

type AppHeaderProps = {
  year: number;
  onYearChange: (year: number) => void;
  authLoading: boolean;
  isAuthenticated: boolean;
  isMobileCalendarUi?: boolean;
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
  onboardingLayoutLocked?: boolean;
  categoryCreateRequestKey?: number;
  onCategoryCreated?: (categoryId: string) => void;
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
  onboardingLayoutLocked = false,
  categoryCreateRequestKey = 0,
  onCategoryCreated,
}: AppHeaderProps) {
  const profiles = useStore((s) => s.profiles);
  const categories = useStore((s) => s.categories);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const setSelectedProfiles = useStore((s) => s.setSelectedProfiles);
  const setCategoriesVisibility = useStore((s) => s.setCategoriesVisibility);

  const [isInlineEditMode, setIsInlineEditMode] = React.useState(false);
  const [editingProfileId, setEditingProfileId] = React.useState<string | null>(null);
  const [profileManagerOpen, setProfileManagerOpen] = React.useState(false);
  const [profileManagerIntent, setProfileManagerIntent] =
    React.useState<ProfileManagerIntent | null>(null);
  const [categoryCreateOpen, setCategoryCreateOpen] = React.useState(false);
  const [categoryEditOpen, setCategoryEditOpen] = React.useState(false);
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);
  const [categoriesExpanded, setCategoriesExpanded] = React.useState(true);
  const [areMobileFiltersCollapsed, setAreMobileFiltersCollapsed] =
    React.useState(false);
  const previousOnboardingLayoutLockedRef = React.useRef(false);

  const pendingProfileCreateRestoreRef = React.useRef<{
    knownProfileIds: string[];
    selectedProfileIds: string[];
  } | null>(null);
  const previousProfileManagerOpenRef = React.useRef(false);
  const handledCategoryCreateRequestRef = React.useRef(0);

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
  const effectiveCategoriesExpanded =
    categoriesExpanded || isInlineEditMode;
  const filtersLocked = onboardingLayoutLocked && !isInlineEditMode;
  const inlineEditDisabled = onboardingLayoutLocked;
  const calendarLauncherDisabled =
    onboardingLayoutLocked && !guidedCalendarSelectionActive;
  const yearSelectDisabled = onboardingLayoutLocked;
  const themeToggleDisabled =
    onboardingLayoutLocked && guidedToolbarNotice?.target !== "theme";
  const isMobileMode = isMobileCalendarUi === true;
  const filterPanelId = React.useId();
  const showMobileFilterPanel =
    !isMobileMode ||
    !areMobileFiltersCollapsed ||
    isInlineEditMode;
  const selectedProfile = React.useMemo(
    () =>
      profiles.find((profile) => selectedProfileIds.includes(profile.id)) ??
      profiles[0] ??
      null,
    [profiles, selectedProfileIds]
  );

  React.useEffect(() => {
    if (!isInlineEditMode) return;
    const profileIds = profiles.map((profile) => profile.id);
    setEditingProfileId((current) => {
      if (current && profileIds.includes(current)) return current;
      return getPreferredEditingProfileId(selectedProfileIds, profileIds);
    });
  }, [isInlineEditMode, profiles, selectedProfileIds]);

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
    if (isInlineEditMode) {
      setAreMobileFiltersCollapsed(false);
    }
  }, [isInlineEditMode]);

  React.useEffect(() => {
    const wasLocked = previousOnboardingLayoutLockedRef.current;
    previousOnboardingLayoutLockedRef.current = onboardingLayoutLocked;
    if (wasLocked && !onboardingLayoutLocked) {
      setIsInlineEditMode(false);
    }
  }, [onboardingLayoutLocked]);

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
    const next = !isInlineEditMode;
    if (next) {
      const profileIds = profiles.map((profile) => profile.id);
      setEditingProfileId(
        getPreferredEditingProfileId(selectedProfileIds, profileIds)
      );
    }
    setIsInlineEditMode(next);
  }, [
    isInlineEditMode,
    profiles,
    selectedProfileIds,
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

  return (
    <>
      <header
        className={cn(
          "space-y-3 bg-background md:space-y-3.5",
          isMobileMode ? "mb-1" : "mb-4 md:mb-5"
        )}
      >
        <div className="grid min-h-9 grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5 md:min-h-10 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4">
          <div className="justify-self-start">
            <BrandLogo />
          </div>

          <div className="w-full min-w-0 justify-self-end">
            <div
              data-onboarding-toolbar-spotlight={
                guidedToolbarNotice ? "true" : undefined
              }
              className="flex min-w-0 flex-wrap items-center justify-end gap-1 sm:gap-2"
            >
              <div
                data-onboarding-spotlight-target={
                  guidedToolbarNotice?.target === "edit" ? "true" : undefined
                }
                className="relative shrink-0"
              >
                {isInlineEditMode ? (
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
                    className={cn(
                      utilityActiveEditClass,
                      guidedToolbarNotice?.target === "edit" &&
                        "product-spotlight-target"
                    )}
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
                    className={cn(
                      utilityIconClass,
                      guidedToolbarNotice?.target === "edit" &&
                        "product-spotlight-target"
                    )}
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
                  highlighted={guidedToolbarNotice?.target === "calendars"}
                  guidedVariantGroupId={
                    guidedCalendarSelectionActive
                      ? "holidays-by-state"
                      : undefined
                  }
                  requireExplicitVariant={
                    guidedCalendarSelectionActive
                  }
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

              <div
                data-onboarding-spotlight-target={
                  guidedToolbarNotice?.target === "year" ? "true" : undefined
                }
                className="relative shrink-0"
              >
                <Select
                  value={String(year)}
                  disabled={yearSelectDisabled}
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
                {guidedToolbarNotice?.target === "year" &&
                onDismissGuidedSelection ? (
                  <GuidedToolbarNoticeCard
                    notice={guidedToolbarNotice}
                    onClose={onDismissGuidedSelection}
                    onAction={() => onGuidedToolbarAction?.("year")}
                    align="end"
                  />
                ) : null}
              </div>

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
            </div>
          </div>
        </div>

        <div
          data-onboarding-filter-region
          className={cn(
            "relative mx-auto flex w-full flex-col items-center gap-1.5 md:gap-2",
            isMobileMode
              ? "max-w-[31rem]"
              : "max-w-[62rem] border-t border-border/45 pt-2.5 md:pt-3",
            onboardingLayoutLocked &&
              (isMobileMode ? "min-h-[10.25rem]" : "min-h-[5.6rem]")
          )}
        >
          <div
            className={cn(
              "flex w-full flex-col items-center gap-1.5 transition-opacity duration-150 md:gap-2",
              guidedSelectionNotice && "opacity-0"
            )}
            inert={filtersLocked ? true : undefined}
            aria-hidden={guidedSelectionNotice ? true : undefined}
          >
            {isMobileMode ? (
              <div className="w-full overflow-hidden rounded-[10px] border border-border bg-card">
              <button
                type="button"
                className="m-[3px] flex h-10 w-[calc(100%-6px)] items-center justify-between gap-3 rounded-[8px] bg-transparent px-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/45"
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
                <span className="flex min-w-0 items-center gap-2.5">
                  {selectedProfile ? (
                    <span className="grid h-7 w-7 shrink-0 place-items-center text-foreground/72">
                      <ProfileIcon
                        icon={selectedProfile.icon}
                        size={13}
                        className="shrink-0"
                      />
                    </span>
                  ) : null}
                  <span className="block min-w-0 truncate text-[13px] font-semibold leading-4 text-foreground">
                    {selectedProfile?.name ?? "Contextos"}
                  </span>
                </span>

                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    showMobileFilterPanel ? "rotate-180" : "rotate-0"
                  )}
                  aria-hidden="true"
                />
              </button>

              <div
                id={filterPanelId}
                className={cn(
                  "grid w-full transition-[grid-template-rows,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  showMobileFilterPanel
                    ? "grid-rows-[1fr] translate-y-0 opacity-100"
                    : "pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0"
                )}
              >
                <div
                  className={cn(
                    "min-h-0 overflow-hidden px-2 transition-[padding,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
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
                      isInlineEditMode={isInlineEditMode}
                      editingProfileId={editingProfileId}
                      onEditingProfileChange={setEditingProfileId}
                      onCreateProfile={openCreateProfile}
                      onEditProfile={openEditProfile}
                      highlightedProfileId={highlightedProfileId}
                    />
                  </div>

                  <div className="mt-2 border-t border-border/55 pt-2">
                    <CategoryBar
                      compact
                      mobileDense
                      isInlineEditMode={isInlineEditMode}
                      editingProfileId={editingProfileId}
                      onCreateCategory={openCreateCategory}
                      onEditCategory={openEditCategory}
                      highlightedCategoryId={highlightedCategoryId}
                    />
                  </div>
                </div>
              </div>
              </div>
            ) : (
              <>
              <div className="-mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 pb-0.5 doze52-scrollbar-none sm:mx-0 sm:w-full sm:px-0 md:overflow-visible">
                <div className="flex w-max min-w-full flex-nowrap items-center justify-start gap-x-1.5 gap-y-1.5 sm:w-full sm:flex-wrap sm:justify-center sm:gap-x-2">
                  <div className="flex shrink-0 flex-nowrap items-center justify-center gap-1.5 sm:flex-wrap sm:gap-2">
                    <ProfileBar
                      compact
                      className="w-max flex-nowrap justify-start sm:w-auto"
                      isInlineEditMode={isInlineEditMode}
                      editingProfileId={editingProfileId}
                      onEditingProfileChange={setEditingProfileId}
                      onCreateProfile={openCreateProfile}
                      onEditProfile={openEditProfile}
                      highlightedProfileId={highlightedProfileId}
                    />

                    <button
                      type="button"
                      className={`${categoryToggleClass} ${
                        isInlineEditMode
                          ? "cursor-default opacity-70 hover:border-border hover:bg-card hover:text-foreground/70 active:translate-y-0"
                          : ""
                      }`}
                      disabled={isInlineEditMode}
                      onClick={() =>
                        setCategoriesExpanded(!categoriesExpanded)
                      }
                      aria-label={
                        isInlineEditMode
                          ? "Categorias abertas durante a edicao"
                          : effectiveCategoriesExpanded
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
                        isInlineEditMode
                          ? "Categorias abertas durante a edicao"
                          : effectiveCategoriesExpanded
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
                  </div>
                </div>
              </div>

              {effectiveCategoriesExpanded ? (
                <div
                  id="app-header-categories"
                  className="w-full origin-top transition-[opacity,transform] duration-150 ease-out"
                >
                  <div className="-mx-4 overflow-x-auto px-4 pb-0.5 doze52-scrollbar-none sm:mx-0 sm:px-0 md:overflow-visible">
                    <CategoryBar
                      compact
                      className="w-max min-w-full flex-nowrap justify-start sm:w-full sm:flex-wrap sm:justify-center"
                      isInlineEditMode={isInlineEditMode}
                      editingProfileId={editingProfileId}
                      onCreateCategory={openCreateCategory}
                      onEditCategory={openEditCategory}
                      highlightedCategoryId={highlightedCategoryId}
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
              className="absolute inset-0 z-40 flex items-center justify-center rounded-2xl bg-background"
            >
              <div
                data-guided-selection-card
                className="inverse-product-surface w-[min(34rem,calc(100%-1rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_60px_-22px_rgba(15,23,42,0.84)]"
              >
                <GuidedCalendarNotice
                  notice={guidedSelectionNotice}
                  onClose={onDismissGuidedSelection}
                />
              </div>
            </div>
          ) : null}
        </div>

        {isMobileMode ? null : (
          <div className="mx-auto h-px w-full max-w-[62rem] bg-border/45" />
        )}
      </header>

      <ProfileManager
        open={profileManagerOpen}
        onOpenChange={handleProfileManagerOpenChange}
        intent={profileManagerIntent}
        onRequireAuth={() => onOpenAuthDialog()}
      />

      <CategoryManager
        mode="create"
        open={categoryCreateOpen}
        onOpenChange={setCategoryCreateOpen}
        profileId={editingProfileId ?? undefined}
        onCreated={onCategoryCreated}
        onRequireAuth={() => onOpenAuthDialog()}
      />

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
      />
    </>
  );
}
