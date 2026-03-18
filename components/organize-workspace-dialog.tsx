"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
  Pencil,
  Plus,
} from "lucide-react";
import { ProfileManager, type ProfileManagerIntent } from "@/components/profile-manager";
import { CategoryManager } from "@/components/category-manager";
import { ProfileIcon } from "@/components/profile-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import type { CategoryItem } from "@/lib/types";

const TAB_BASE_CLASS =
  "inline-flex min-h-9 items-center justify-center rounded-full px-3.5 py-2 text-sm font-medium transition-colors";
const LIST_CARD_CLASS =
  "rounded-2xl border border-border/80 bg-background/90 p-3 shadow-sm transition-colors";
const ROW_BASE_CLASS =
  "flex items-center gap-3 rounded-xl border border-border/70 bg-muted/25 px-3 py-2.5 shadow-sm transition-colors";

const moveInArray = <T extends { id: string }>(items: T[], sourceId: string, targetId: string) => {
  const sourceIndex = items.findIndex((item) => item.id === sourceId);
  const targetIndex = items.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return items;
  const next = [...items];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};

const moveByStep = <T extends { id: string }>(items: T[], id: string, step: -1 | 1) => {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;
  const targetIndex = index + step;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(index, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};

const applyProfileOrderToAll = (
  allCategories: CategoryItem[],
  profileId: string,
  orderedInProfile: CategoryItem[]
) => {
  let cursor = 0;
  return allCategories.map((category) => {
    if (category.profileId !== profileId) return category;
    const replacement = orderedInProfile[cursor] ?? category;
    cursor += 1;
    return replacement;
  });
};

type OrganizeWorkspaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function OrganizeWorkspaceDialog({
  open,
  onOpenChange,
}: OrganizeWorkspaceDialogProps) {
  const profiles = useStore((s) => s.profiles);
  const categories = useStore((s) => s.categories);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const setProfilesOrder = useStore((s) => s.setProfilesOrder);
  const setCategoriesOrder = useStore((s) => s.setCategoriesOrder);

  const [activeTab, setActiveTab] = React.useState<"profiles" | "categories">("profiles");
  const [categoryProfileId, setCategoryProfileId] = React.useState("");
  const [draggingProfileId, setDraggingProfileId] = React.useState<string | null>(null);
  const [dragOverProfileId, setDragOverProfileId] = React.useState<string | null>(null);
  const [draggingCategoryId, setDraggingCategoryId] = React.useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = React.useState<string | null>(null);
  const [profileManagerOpen, setProfileManagerOpen] = React.useState(false);
  const [profileManagerIntent, setProfileManagerIntent] = React.useState<ProfileManagerIntent | null>(
    null
  );
  const [categoryCreateOpen, setCategoryCreateOpen] = React.useState(false);
  const [categoryEditOpen, setCategoryEditOpen] = React.useState(false);
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const preferredProfileId =
      selectedProfileIds.find((id) => profiles.some((profile) => profile.id === id)) ??
      profiles[0]?.id ??
      "";

    setCategoryProfileId((current) => {
      if (current && profiles.some((profile) => profile.id === current)) return current;
      return preferredProfileId;
    });
  }, [open, profiles, selectedProfileIds]);

  const categoriesForProfile = React.useMemo(
    () => categories.filter((category) => category.profileId === categoryProfileId),
    [categories, categoryProfileId]
  );

  const moveProfiles = React.useCallback(
    (sourceId: string, targetId: string) => {
      const next = moveInArray(profiles, sourceId, targetId);
      if (next === profiles) return;
      setProfilesOrder(next.map((profile) => profile.id));
    },
    [profiles, setProfilesOrder]
  );

  const moveProfileStep = React.useCallback(
    (profileId: string, step: -1 | 1) => {
      const next = moveByStep(profiles, profileId, step);
      if (next === profiles) return;
      setProfilesOrder(next.map((profile) => profile.id));
    },
    [profiles, setProfilesOrder]
  );

  const moveCategories = React.useCallback(
    (sourceId: string, targetId: string) => {
      if (!categoryProfileId) return;
      const nextProfileCategories = moveInArray(categoriesForProfile, sourceId, targetId);
      if (nextProfileCategories === categoriesForProfile) return;
      const fullOrder = applyProfileOrderToAll(categories, categoryProfileId, nextProfileCategories);
      setCategoriesOrder(fullOrder.map((category) => category.id));
    },
    [categories, categoriesForProfile, categoryProfileId, setCategoriesOrder]
  );

  const moveCategoryStep = React.useCallback(
    (categoryId: string, step: -1 | 1) => {
      if (!categoryProfileId) return;
      const nextProfileCategories = moveByStep(categoriesForProfile, categoryId, step);
      if (nextProfileCategories === categoriesForProfile) return;
      const fullOrder = applyProfileOrderToAll(categories, categoryProfileId, nextProfileCategories);
      setCategoriesOrder(fullOrder.map((category) => category.id));
    },
    [categories, categoriesForProfile, categoryProfileId, setCategoriesOrder]
  );

  const openCreateProfile = () => {
    setProfileManagerIntent({ mode: "create" });
    setProfileManagerOpen(true);
  };

  const openEditProfile = (profileId: string) => {
    setProfileManagerIntent({ mode: "edit", profileId });
    setProfileManagerOpen(true);
  };

  const openEditCategory = (categoryId: string) => {
    setEditingCategoryId(categoryId);
    setCategoryEditOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="top-auto bottom-3 max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] translate-y-0 overflow-hidden rounded-[1.75rem] px-0 pb-0 pt-5 sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-[760px] sm:-translate-y-1/2 sm:px-0 sm:pb-0">
          <DialogHeader className="px-5 sm:px-6">
            <DialogTitle>Organizar workspace</DialogTitle>
            <DialogDescription>
              Gerencie perfis e categorias sem competir com os filtros principais.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 px-5 pt-1 sm:px-6">
            <button
              type="button"
              onClick={() => setActiveTab("profiles")}
              className={`${TAB_BASE_CLASS} ${
                activeTab === "profiles"
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              Perfis
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("categories")}
              className={`${TAB_BASE_CLASS} ${
                activeTab === "categories"
                  ? "bg-foreground text-background shadow-sm"
                  : "bg-muted/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              Categorias
            </button>
          </div>

          <div className="mt-4 max-h-[calc(100dvh-12rem)] overflow-y-auto px-5 pb-5 sm:max-h-[32rem] sm:px-6 sm:pb-6">
            {activeTab === "profiles" ? (
              <section className={LIST_CARD_CLASS}>
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Perfis</p>
                    <p className="text-xs text-muted-foreground">
                      Reordene por arraste ou use as setas para ajustar a prioridade visual.
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-full" onClick={openCreateProfile}>
                    <Plus className="h-4 w-4" />
                    Novo perfil
                  </Button>
                </div>

                <div className="space-y-2">
                  {profiles.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
                      Nenhum perfil criado ainda.
                    </div>
                  ) : (
                    profiles.map((profile, index) => {
                      const categoryCount = categories.filter(
                        (category) => category.profileId === profile.id
                      ).length;
                      return (
                        <div
                          key={profile.id}
                          className={`${ROW_BASE_CLASS} ${dragOverProfileId === profile.id ? "ring-2 ring-ring/35" : ""}`}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setDragOverProfileId(profile.id);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            if (!draggingProfileId || draggingProfileId === profile.id) return;
                            moveProfiles(draggingProfileId, profile.id);
                            setDraggingProfileId(null);
                            setDragOverProfileId(null);
                          }}
                        >
                          <button
                            type="button"
                            draggable
                            onDragStart={(event) => {
                              setDraggingProfileId(profile.id);
                              setDragOverProfileId(profile.id);
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", profile.id);
                            }}
                            onDragEnd={() => {
                              setDraggingProfileId(null);
                              setDragOverProfileId(null);
                            }}
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={`Reordenar perfil ${profile.name}`}
                            title={`Reordenar perfil ${profile.name}`}
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>

                          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-background text-foreground shadow-sm">
                            <ProfileIcon icon={profile.icon} size={18} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{profile.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {categoryCount} {categoryCount === 1 ? "categoria" : "categorias"}
                            </p>
                          </div>

                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="rounded-full"
                              onClick={() => moveProfileStep(profile.id, -1)}
                              disabled={index === 0}
                              aria-label={`Mover perfil ${profile.name} para cima`}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="rounded-full"
                              onClick={() => moveProfileStep(profile.id, 1)}
                              disabled={index === profiles.length - 1}
                              aria-label={`Mover perfil ${profile.name} para baixo`}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              className="rounded-full"
                              onClick={() => openEditProfile(profile.id)}
                              aria-label={`Editar perfil ${profile.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            ) : (
              <section className={LIST_CARD_CLASS}>
                <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium text-foreground">Categorias</p>
                    <p className="text-xs text-muted-foreground">
                      Escolha um perfil e organize a ordem visual das categorias dele.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:min-w-[260px] sm:flex-row sm:items-center">
                    <Select value={categoryProfileId} onValueChange={setCategoryProfileId}>
                      <SelectTrigger className="h-9 rounded-full border-border/80 bg-background px-3 shadow-sm">
                        <span className="truncate">{profiles.find((profile) => profile.id === categoryProfileId)?.name ?? "Perfil"}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {profiles.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            <span className="inline-flex items-center gap-2">
                              <ProfileIcon icon={profile.icon} size={12} />
                              {profile.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      disabled={!categoryProfileId}
                      onClick={() => setCategoryCreateOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Nova categoria
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {!categoryProfileId ? (
                    <div className="rounded-xl border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
                      Crie um perfil antes de organizar categorias.
                    </div>
                  ) : categoriesForProfile.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/80 px-4 py-6 text-center text-sm text-muted-foreground">
                      Nenhuma categoria neste perfil.
                    </div>
                  ) : (
                    categoriesForProfile.map((category, index) => (
                      <div
                        key={category.id}
                        className={`${ROW_BASE_CLASS} ${dragOverCategoryId === category.id ? "ring-2 ring-ring/35" : ""}`}
                        onDragOver={(event) => {
                          event.preventDefault();
                          setDragOverCategoryId(category.id);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (!draggingCategoryId || draggingCategoryId === category.id) return;
                          moveCategories(draggingCategoryId, category.id);
                          setDraggingCategoryId(null);
                          setDragOverCategoryId(null);
                        }}
                      >
                        <button
                          type="button"
                          draggable
                          onDragStart={(event) => {
                            setDraggingCategoryId(category.id);
                            setDragOverCategoryId(category.id);
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", category.id);
                          }}
                          onDragEnd={() => {
                            setDraggingCategoryId(null);
                            setDragOverCategoryId(null);
                          }}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                          aria-label={`Reordenar categoria ${category.name}`}
                          title={`Reordenar categoria ${category.name}`}
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>

                        <span
                          className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/8"
                          style={{ backgroundColor: category.color }}
                          aria-hidden="true"
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">{category.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {category.visible ? "Visivel nos filtros" : "Oculta nos filtros"}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="rounded-full"
                            onClick={() => moveCategoryStep(category.id, -1)}
                            disabled={index === 0}
                            aria-label={`Mover categoria ${category.name} para cima`}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="rounded-full"
                            onClick={() => moveCategoryStep(category.id, 1)}
                            disabled={index === categoriesForProfile.length - 1}
                            aria-label={`Mover categoria ${category.name} para baixo`}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="rounded-full"
                            onClick={() => openEditCategory(category.id)}
                            aria-label={`Editar categoria ${category.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ProfileManager
        open={profileManagerOpen}
        onOpenChange={(nextOpen) => {
          setProfileManagerOpen(nextOpen);
          if (!nextOpen) {
            setProfileManagerIntent(null);
          }
        }}
        intent={profileManagerIntent ?? undefined}
      />

      <CategoryManager
        mode="create"
        open={categoryCreateOpen}
        onOpenChange={setCategoryCreateOpen}
        profileId={categoryProfileId || undefined}
      />

      <CategoryManager
        mode="edit"
        open={categoryEditOpen}
        onOpenChange={(nextOpen) => {
          setCategoryEditOpen(nextOpen);
          if (!nextOpen) {
            setEditingCategoryId(null);
          }
        }}
        categoryId={editingCategoryId ?? undefined}
      />
    </>
  );
}
