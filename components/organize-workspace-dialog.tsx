"use client";

import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  GripVertical,
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
  "inline-flex min-h-8 items-center justify-center rounded-full px-3 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow]";
const SECTION_CLASS =
  "rounded-[1.35rem] border border-border/65 bg-card/58 p-4 transition-colors";
const LIST_CLASS = "overflow-hidden rounded-[1.1rem] border border-border/55 bg-background/78";
const ROW_SHELL_CLASS =
  "group flex items-stretch gap-0 border-b border-border/55 transition-[background-color,border-color] last:border-b-0";
const HANDLE_BUTTON_CLASS =
  "hidden shrink-0 cursor-grab items-center justify-center px-3 text-muted-foreground/55 transition-colors hover:text-foreground focus-visible:text-foreground active:cursor-grabbing sm:inline-flex";
const ROW_BUTTON_CLASS =
  "flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-3 text-left transition-[background-color,box-shadow,color,transform] hover:bg-muted/35 focus-visible:bg-muted/38 focus-visible:ring-2 focus-visible:ring-ring/20 active:bg-muted/45";
const MOBILE_REORDER_GROUP_CLASS = "flex shrink-0 items-center gap-0.5 px-2 sm:hidden";

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
        <DialogContent className="top-auto bottom-2 max-h-[calc(100dvh-0.5rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] translate-y-0 overflow-hidden rounded-[1.85rem] border-border/80 bg-background/98 px-0 pb-0 pt-0 shadow-[0_28px_70px_-34px_rgba(15,23,42,0.34)] sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-[780px] sm:-translate-y-1/2 sm:px-0 sm:pb-0">
          <div className="sticky top-0 z-10 border-b border-border/60 bg-background/94 px-5 pb-4 pt-5 backdrop-blur sm:px-6">
            <DialogHeader className="gap-1">
              <DialogTitle>Organizar workspace</DialogTitle>
              <DialogDescription>
                Ajuste perfis e categorias sem poluir a leitura principal do calendario.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 inline-flex rounded-full border border-border/70 bg-muted/35 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("profiles")}
                aria-pressed={activeTab === "profiles"}
                className={`${TAB_BASE_CLASS} ${
                  activeTab === "profiles"
                    ? "bg-background/95 text-foreground ring-1 ring-border/70"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Perfis
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("categories")}
                aria-pressed={activeTab === "categories"}
                className={`${TAB_BASE_CLASS} ${
                  activeTab === "categories"
                    ? "bg-background/95 text-foreground ring-1 ring-border/70"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Categorias
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto px-5 pb-5 pt-4 sm:max-h-[33rem] sm:px-6 sm:pb-6">
            {activeTab === "profiles" ? (
              <section className={SECTION_CLASS}>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">Perfis</p>
                    <p className="max-w-md text-xs leading-5 text-muted-foreground">
                      Reordene a identidade principal do workspace e ajuste cada perfil sem mexer nos filtros.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full border-border/65 bg-background/80 px-3.5 shadow-none hover:bg-muted/40"
                    onClick={openCreateProfile}
                  >
                    <Plus className="h-4 w-4" />
                    Novo perfil
                  </Button>
                </div>

                <div className={LIST_CLASS}>
                  {profiles.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Nenhum perfil criado ainda.
                    </div>
                  ) : (
                    profiles.map((profile, index) => {
                      const categoryCount = categories.filter(
                        (category) => category.profileId === profile.id
                      ).length;
                      const isSelected = selectedProfileIds.includes(profile.id);
                      return (
                        <div
                          key={profile.id}
                          className={`${ROW_SHELL_CLASS} ${
                            dragOverProfileId === profile.id
                              ? "bg-muted/28"
                              : "hover:bg-muted/12"
                          }`}
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
                            className={HANDLE_BUTTON_CLASS}
                            aria-label={`Reordenar perfil ${profile.name}`}
                            title={`Reordenar perfil ${profile.name}`}
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditProfile(profile.id)}
                            className={ROW_BUTTON_CLASS}
                            aria-label={`Editar perfil ${profile.name}`}
                          >
                            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-muted/42 ring-1 ring-border/55">
                              <ProfileIcon icon={profile.icon} size={18} />
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {profile.name}
                                </p>
                                {isSelected ? (
                                  <span className="rounded-full bg-muted/55 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                    ativo
                                  </span>
                                ) : null}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {categoryCount} {categoryCount === 1 ? "categoria" : "categorias"}
                              </p>
                            </div>
                          </button>

                          <div className={MOBILE_REORDER_GROUP_CLASS}>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="h-8 w-8 rounded-full text-muted-foreground/70 hover:bg-muted/55 hover:text-foreground"
                              onClick={() => moveProfileStep(profile.id, -1)}
                              disabled={index === 0}
                              aria-label={`Mover perfil ${profile.name} para cima`}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="h-8 w-8 rounded-full text-muted-foreground/70 hover:bg-muted/55 hover:text-foreground"
                              onClick={() => moveProfileStep(profile.id, 1)}
                              disabled={index === profiles.length - 1}
                              aria-label={`Mover perfil ${profile.name} para baixo`}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            ) : (
              <section className={SECTION_CLASS}>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-semibold text-foreground">Categorias</p>
                    <p className="max-w-md text-xs leading-5 text-muted-foreground">
                      Escolha um perfil e ajuste a ordem visual das categorias exibidas nos filtros.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:min-w-[260px] sm:flex-row sm:items-center">
                    <Select value={categoryProfileId} onValueChange={setCategoryProfileId}>
                      <SelectTrigger className="h-9 rounded-full border-border/65 bg-background/80 px-3 shadow-none">
                        <span className="truncate">
                          {profiles.find((profile) => profile.id === categoryProfileId)?.name ?? "Perfil"}
                        </span>
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
                      className="h-9 rounded-full border-border/65 bg-background/80 px-3.5 shadow-none hover:bg-muted/40"
                      disabled={!categoryProfileId}
                      onClick={() => setCategoryCreateOpen(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Nova categoria
                    </Button>
                  </div>
                </div>

                <div className={LIST_CLASS}>
                  {!categoryProfileId ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Crie um perfil antes de organizar categorias.
                    </div>
                  ) : categoriesForProfile.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Nenhuma categoria neste perfil.
                    </div>
                  ) : (
                    categoriesForProfile.map((category, index) => (
                      <div
                        key={category.id}
                        className={`${ROW_SHELL_CLASS} ${
                          dragOverCategoryId === category.id
                            ? "bg-muted/28"
                            : "hover:bg-muted/12"
                        }`}
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
                          className={HANDLE_BUTTON_CLASS}
                          aria-label={`Reordenar categoria ${category.name}`}
                          title={`Reordenar categoria ${category.name}`}
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditCategory(category.id)}
                          className={ROW_BUTTON_CLASS}
                          aria-label={`Editar categoria ${category.name}`}
                        >
                          <span
                            className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/8"
                            style={{ backgroundColor: category.color }}
                            aria-hidden="true"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">
                              {category.name}
                            </p>
                          </div>
                        </button>

                        <div className={MOBILE_REORDER_GROUP_CLASS}>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 rounded-full text-muted-foreground/70 hover:bg-muted/55 hover:text-foreground"
                            onClick={() => moveCategoryStep(category.id, -1)}
                            disabled={index === 0}
                            aria-label={`Mover categoria ${category.name} para cima`}
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="h-8 w-8 rounded-full text-muted-foreground/70 hover:bg-muted/55 hover:text-foreground"
                            onClick={() => moveCategoryStep(category.id, 1)}
                            disabled={index === categoriesForProfile.length - 1}
                            aria-label={`Mover categoria ${category.name} para baixo`}
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
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
