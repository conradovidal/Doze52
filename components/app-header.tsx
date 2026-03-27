"use client";

import * as React from "react";
import { PencilLine } from "lucide-react";
import { CategoryBar } from "@/components/category-bar";
import { CategoryManager } from "@/components/category-manager";
import { ProfileBar } from "@/components/profile-bar";
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

type AppHeaderProps = {
  year: number;
  onYearChange: (year: number) => void;
  authLoading: boolean;
  isAuthenticated: boolean;
  onOpenAuthDialog: (anchorPoint?: AnchorPoint) => void;
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
  onOpenAuthDialog,
}: AppHeaderProps) {
  const profiles = useStore((s) => s.profiles);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const setSelectedProfiles = useStore((s) => s.setSelectedProfiles);

  const [isInlineEditMode, setIsInlineEditMode] = React.useState(false);
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
    "h-9 w-9 rounded-2xl border-border/65 bg-background/70 text-muted-foreground shadow-none transition-colors hover:border-border/80 hover:bg-muted/45 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50";
  const utilityButtonClass =
    "h-9 rounded-2xl border-border/65 bg-background/70 px-3.5 text-sm font-medium text-foreground shadow-none transition-colors hover:border-border/80 hover:bg-muted/45 hover:text-foreground";
  const yearSelectClass =
    "h-9 min-w-[90px] rounded-2xl border-border/70 bg-background/80 px-3.5 text-[0.98rem] font-semibold text-foreground shadow-none hover:border-border/85 hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring/60 md:text-[1rem] [&_svg]:opacity-70 [&_svg]:text-muted-foreground";

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
      <header className="mb-4 space-y-3 md:mb-5 md:space-y-3.5">
        <div className="grid min-h-10 grid-cols-[minmax(0,1fr)_auto] items-start gap-3 md:items-center md:gap-4">
          <div className="justify-self-start">
            <img src="/logo-doze52.png" alt="doze 52" className="h-8 w-auto md:h-9" />
          </div>

          <div className="min-w-0 justify-self-end">
            <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className={`${utilityIconClass} ${
                  isInlineEditMode ? "border-border/80 bg-muted/65 text-foreground" : ""
                }`}
                onClick={toggleInlineEditMode}
                aria-label={
                  isInlineEditMode
                    ? "Finalizar edicao de perfis e categorias"
                    : "Editar perfis e categorias"
                }
                title={
                  isInlineEditMode
                    ? "Finalizar edicao de perfis e categorias"
                    : "Editar perfis e categorias"
                }
              >
                <PencilLine className="h-4 w-4" />
              </Button>

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

        <div className="mx-auto flex w-full max-w-[58rem] flex-col items-center gap-1.5 border-t border-border/45 pt-2.5 md:gap-2 md:pt-3">
          {isInlineEditMode ? (
            <p className="text-center text-[0.74rem] font-medium text-muted-foreground">
              Modo de edicao ativo. Toque no lapis para finalizar.
            </p>
          ) : null}

          <ProfileBar
            compact
            isInlineEditMode={isInlineEditMode}
            editingProfileId={editingProfileId}
            onEditingProfileChange={setEditingProfileId}
            onCreateProfile={openCreateProfile}
            onEditProfile={openEditProfile}
          />

          <CategoryBar
            compact
            isInlineEditMode={isInlineEditMode}
            editingProfileId={editingProfileId}
            onCreateCategory={openCreateCategory}
            onEditCategory={openEditCategory}
          />
        </div>

        <div className="mx-auto h-px w-full max-w-[58rem] bg-border/45" />
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
