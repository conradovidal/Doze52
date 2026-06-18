"use client";

import * as React from "react";
import { Check, ChevronDown, PencilLine } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
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
}: AppHeaderProps) {
  const profiles = useStore((s) => s.profiles);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const setSelectedProfiles = useStore((s) => s.setSelectedProfiles);

  const [isInlineEditMode, setIsInlineEditMode] = React.useState(false);
  const [areMobileFiltersCollapsed, setAreMobileFiltersCollapsed] =
    React.useState(true);
  const [editingProfileId, setEditingProfileId] = React.useState<string | null>(null);
  const [profileManagerOpen, setProfileManagerOpen] = React.useState(false);
  const [profileManagerIntent, setProfileManagerIntent] =
    React.useState<ProfileManagerIntent | null>(null);
  const [categoryCreateOpen, setCategoryCreateOpen] = React.useState(false);
  const [categoryEditOpen, setCategoryEditOpen] = React.useState(false);
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);

  const pendingProfileCreateRestoreRef = React.useRef<{
    knownProfileIds: string[];
    selectedProfileIds: string[];
  } | null>(null);
  const previousProfileManagerOpenRef = React.useRef(false);

  const utilityIconClass =
    "h-9 w-9 rounded-2xl border-border/65 bg-background text-muted-foreground shadow-none transition-colors hover:border-border/80 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50";
  const utilityActiveEditClass =
    "h-9 rounded-full border border-foreground/15 bg-foreground px-3.5 text-sm font-medium text-background shadow-none transition-colors hover:bg-foreground/92 focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-white/15 dark:bg-white dark:text-black dark:hover:bg-white/92";
  const utilityButtonClass =
    "h-9 rounded-2xl border-border/65 bg-background px-3.5 text-sm font-medium text-foreground shadow-none transition-colors hover:border-border/80 hover:bg-muted hover:text-foreground";
  const yearSelectClass =
    "h-9 min-w-[90px] rounded-2xl border-border/70 bg-background px-3.5 text-[0.98rem] font-semibold text-foreground shadow-none hover:border-border/85 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/60 md:text-[1rem] [&_svg]:opacity-70 [&_svg]:text-muted-foreground";
  const filterPanelId = React.useId();
  const isMobileMode = isMobileCalendarUi === true;
  const showFilterPanel =
    !isMobileMode || !areMobileFiltersCollapsed || isInlineEditMode;
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

  const toggleInlineEditMode = React.useCallback(() => {
    setIsInlineEditMode((current) => {
      const next = !current;
      if (next) {
        const profileIds = profiles.map((profile) => profile.id);
        setEditingProfileId(getPreferredEditingProfileId(selectedProfileIds, profileIds));
      }
      return next;
    });
  }, [profiles, selectedProfileIds]);

  React.useEffect(() => {
    if (isInlineEditMode) {
      setAreMobileFiltersCollapsed(false);
    }
  }, [isInlineEditMode]);

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
      <header className="mb-2 space-y-2 md:mb-5 md:space-y-3.5">
        <div className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 md:items-center md:gap-4">
          <div className="justify-self-start">
            <BrandLogo />
          </div>

          <div className="min-w-0 justify-self-end">
            <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              {isInlineEditMode ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={utilityActiveEditClass}
                  onClick={toggleInlineEditMode}
                  aria-label="Finalizar edicao de perfis e categorias"
                  title="Finalizar edicao de perfis e categorias"
                >
                  <Check className="h-4 w-4" />
                  <span>Finalizar</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className={utilityIconClass}
                  onClick={toggleInlineEditMode}
                  aria-label="Editar perfis e categorias"
                  title="Editar perfis e categorias"
                >
                  <PencilLine className="h-4 w-4" />
                </Button>
              )}

              <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
                <SelectTrigger className={yearSelectClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2025">2025</SelectItem>
                  <SelectItem value="2026">2026</SelectItem>
                  <SelectItem value="2027">2027</SelectItem>
                </SelectContent>
              </Select>

              <ThemeToggle />

              <div className="flex h-9 items-center justify-end">
                {authLoading ? null : isAuthenticated ? (
                  <UserMenu />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
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

        <div className="mx-auto flex w-full max-w-[58rem] flex-col items-center border-t border-border/50 pt-2.5 md:gap-2 md:pt-3">
          <div
            className={cn(
              "w-full",
              isMobileMode
                ? "overflow-hidden rounded-[10px] border border-border bg-card"
                : "contents"
            )}
          >
            {isMobileMode ? (
              <button
                type="button"
                className="flex h-11 w-full items-center justify-between gap-3 bg-transparent px-3 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/45 md:hidden"
                aria-expanded={showFilterPanel}
                aria-controls={filterPanelId}
                onClick={() =>
                  setAreMobileFiltersCollapsed((current) => !current)
                }
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {selectedProfile ? (
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] border border-border bg-background">
                      <ProfileIcon
                        icon={selectedProfile.icon}
                        size={13}
                        className="shrink-0"
                      />
                    </span>
                  ) : null}
                  <span className="block min-w-0 truncate text-[13px] font-semibold leading-4 text-foreground">
                    {selectedProfile?.name ?? "Perfis"}
                  </span>
                </span>

                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                    showFilterPanel ? "rotate-180" : "rotate-0"
                  )}
                />
              </button>
            ) : null}

            <div
              id={filterPanelId}
              className={cn(
                "grid w-full transition-[grid-template-rows,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] md:flex md:translate-y-0 md:opacity-100",
                showFilterPanel
                  ? "grid-rows-[1fr] translate-y-0 opacity-100"
                  : "pointer-events-none grid-rows-[0fr] -translate-y-1 opacity-0 md:pointer-events-auto"
              )}
            >
              <div
                className={cn(
                  "min-h-0 overflow-hidden transition-[padding,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isMobileMode
                    ? cn(
                        "border-t px-2",
                        showFilterPanel
                          ? "border-border/55 py-2"
                          : "border-transparent py-0"
                      )
                    : "flex w-full flex-col items-center gap-1.5 md:gap-2"
                )}
              >
                <div
                  className={cn(
                    "w-full",
                    isMobileMode && !isInlineEditMode
                      ? "grid grid-cols-2 gap-1.5 min-[430px]:grid-cols-3"
                      : "flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
                  )}
                >
                  <CalendarPackLauncher
                    onFocusYear={onCalendarPackFocusYear}
                    mobileDense={isMobileMode && !isInlineEditMode}
                    className={cn(
                      isMobileMode && !isInlineEditMode
                        ? "w-full"
                        : "shrink-0"
                    )}
                  />

                  <ProfileBar
                    compact
                    mobileDense={isMobileMode}
                    className="w-auto min-w-0"
                    isInlineEditMode={isInlineEditMode}
                    editingProfileId={editingProfileId}
                    onEditingProfileChange={setEditingProfileId}
                    onCreateProfile={openCreateProfile}
                    onEditProfile={openEditProfile}
                  />
                </div>

                <div
                  className={cn(
                    "w-full",
                    isMobileMode
                      ? "mt-2 border-t border-border/55 pt-2"
                      : "contents"
                  )}
                >
                  <CategoryBar
                    compact
                    mobileDense={isMobileMode}
                    isInlineEditMode={isInlineEditMode}
                    editingProfileId={editingProfileId}
                    onCreateCategory={openCreateCategory}
                    onEditCategory={openEditCategory}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <ProfileManager
        open={profileManagerOpen}
        onOpenChange={setProfileManagerOpen}
        intent={profileManagerIntent ?? undefined}
      />

      <CategoryManager
        mode="create"
        open={categoryCreateOpen}
        onOpenChange={setCategoryCreateOpen}
        profileId={editingProfileId ?? undefined}
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
