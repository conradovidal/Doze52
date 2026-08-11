"use client";

import * as React from "react";
import { CategoryColorPicker } from "@/components/category-color-picker";
import { ProUpgradeDialog } from "@/components/billing/pro-upgrade-dialog";
import { ProfileIcon } from "@/components/profile-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useFeedback } from "@/components/ui/feedback-provider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  DEFAULT_CATEGORY_COLOR,
  getCategoryColorToken,
  getNearestCategoryColor,
} from "@/lib/category-palette";
import { calendarPacks } from "@/lib/calendar-packs";
import { isLimitReached } from "@/lib/entitlements";
import {
  findCalendarPackByCategoryId,
  getCalendarPackGroupId,
  isCalendarPackGroupPresent,
  removeCalendarPackByCategory,
} from "@/lib/calendar-packs/import";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { useBilling } from "@/lib/use-billing";
import type { AnchorPoint } from "@/lib/types";
import { cn } from "@/lib/utils";

const CHIP_TRIGGER_CLASS =
  "h-10 w-full rounded-xl border px-3 text-sm shadow-sm transition-colors";
const CATEGORY_NAME_MAX_LENGTH = 28;

type CategoryManagerProps = {
  mode: "edit" | "create";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId?: string;
  profileId?: string;
  onCreated?: (id: string) => void;
  anchorPoint?: AnchorPoint;
  onRequireAuth?: () => void;
  bypassLimits?: boolean;
};

export function CategoryManager({
  mode,
  open,
  onOpenChange,
  categoryId,
  profileId,
  onCreated,
  anchorPoint,
  onRequireAuth,
  bypassLimits = false,
}: CategoryManagerProps) {
  const { notify } = useFeedback();
  const { isPro, limits } = useBilling();
  const { mode: themeMode } = useTheme();
  const categories = useStore((s) => s.categories);
  const profiles = useStore((s) => s.profiles);
  const events = useStore((s) => s.events);
  const createCategory = useStore((s) => s.createCategory);
  const updateCategory = useStore((s) => s.updateCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);
  const replaceAllData = useStore((s) => s.replaceAllData);

  const category = React.useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(DEFAULT_CATEGORY_COLOR);
  const [profileDraftId, setProfileDraftId] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteStrategy, setDeleteStrategy] = React.useState<
    "move" | "delete-events"
  >("move");
  const [deleteTargetCategoryId, setDeleteTargetCategoryId] = React.useState("");
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const currentProfile = React.useMemo(
    () => profiles.find((profile) => profile.id === profileDraftId) ?? null,
    [profileDraftId, profiles]
  );
  const snapshot = React.useMemo(
    () => ({ profiles, categories, events }),
    [categories, events, profiles]
  );
  const calendarPackCategory = React.useMemo(
    () =>
      categoryId
        ? findCalendarPackByCategoryId(snapshot, calendarPacks, categoryId)
        : null,
    [categoryId, snapshot]
  );
  const calendarPackCategoryIds = React.useMemo(
    () =>
      new Set(
        categories
          .filter((candidate) =>
            findCalendarPackByCategoryId(snapshot, calendarPacks, candidate.id)
          )
          .map((candidate) => candidate.id)
      ),
    [categories, snapshot]
  );
  const categoryEventCount = React.useMemo(
    () => events.filter((event) => event.categoryId === categoryId).length,
    [categoryId, events]
  );
  const deletionDestinations = React.useMemo(() => {
    if (!category) return [];
    return categories
      .filter(
        (candidate) =>
          candidate.id !== category.id &&
          !candidate.calendarPackGroupId &&
          !calendarPackCategoryIds.has(candidate.id)
      )
      .sort((left, right) => {
        const leftSameProfile = left.profileId === category.profileId ? 0 : 1;
        const rightSameProfile = right.profileId === category.profileId ? 0 : 1;
        return leftSameProfile - rightSameProfile;
      });
  }, [calendarPackCategoryIds, categories, category]);
  const profileNameById = React.useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile.name])),
    [profiles]
  );
  const deleteTargetCategory = deletionDestinations.find(
    (candidate) => candidate.id === deleteTargetCategoryId
  );

  React.useEffect(() => {
    if (!open) return;
    if (mode === "edit") {
      if (!category) {
        setName("");
        setColor(DEFAULT_CATEGORY_COLOR);
        setProfileDraftId("");
        setIsSaving(false);
        setSaveError("Esta categoria não foi encontrada. Feche e tente novamente.");
        return;
      }
      setName(category.name);
      const initial = getNearestCategoryColor(category.color);
      setColor(initial);
      setProfileDraftId(category.profileId);
      setIsSaving(false);
      setSaveError(null);
      setDeleteDialogOpen(false);
      setDeleteError(null);
      return;
    }
    setName("");
    setColor(DEFAULT_CATEGORY_COLOR);
    setProfileDraftId(
      profileId && profiles.some((profile) => profile.id === profileId) ? profileId : ""
    );
    setIsSaving(false);
    setSaveError(
      profileId && profiles.some((profile) => profile.id === profileId)
        ? null
        : "Selecione um contexto válido antes de criar a categoria."
    );
  }, [open, mode, category, profileId, profiles]);

  const isEdit = mode === "edit";
  const isCreateBlocked =
    open &&
    mode === "create" &&
    !bypassLimits &&
    !isPro &&
    isLimitReached(categories.length, limits.maxCategories);
  const normalizedName = name.trim().slice(0, CATEGORY_NAME_MAX_LENGTH).trim();
  const canSave = normalizedName.length > 0 && Boolean(profileDraftId);
  const canDelete =
    Boolean(category) &&
    (Boolean(calendarPackCategory) || deletionDestinations.length > 0);
  const currentColorToken = React.useMemo(
    () => getCategoryColorToken(color, themeMode),
    [color, themeMode]
  );

  const handleSave = async () => {
    if (!canSave) return;
    try {
      setIsSaving(true);
      setSaveError(null);
      if (isEdit) {
        if (!categoryId || !category) {
          setSaveError("Esta categoria não foi encontrada. Feche e tente novamente.");
          return;
        }
        updateCategory(categoryId, {
          name: normalizedName,
          color,
          profileId: profileDraftId,
        });
        onOpenChange(false);
        return;
      }
      if (!profileDraftId) {
        setSaveError("Selecione um contexto antes de criar a categoria.");
        return;
      }
      if (
        !bypassLimits &&
        !isPro &&
        isLimitReached(categories.length, limits.maxCategories)
      ) {
        setSaveError("Mais categorias fazem parte do Doze 52 Pro.");
        return;
      }
      const id = createCategory({
        name: normalizedName,
        color,
        profileId: profileDraftId,
      });
      if (id) onCreated?.(id);
      onOpenChange(false);
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Falhou ao salvar categoria. Tente novamente."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !categoryId || !canDelete) return;
    try {
      setIsSaving(true);
      setSaveError(null);
      if (calendarPackCategory) {
        const groupId = getCalendarPackGroupId(calendarPackCategory.pack);
        const relatedPacks = calendarPacks.filter(
          (candidate) => getCalendarPackGroupId(candidate) === groupId
        );
        const result = removeCalendarPackByCategory(
          snapshot,
          calendarPacks,
          categoryId
        );
        if (
          result.removedCategoryCount === 0 &&
          result.removedEventCount === 0
        ) {
          throw new Error("Nenhum dado do calendário foi encontrado para remover.");
        }
        if (isCalendarPackGroupPresent(result.snapshot, relatedPacks)) {
          throw new Error("O calendário ainda está presente após a remoção.");
        }
        replaceAllData(result.snapshot);
        notify({
          tone: "success",
          title: "Calendário removido",
          description: "A categoria e todos os eventos foram excluídos.",
        });
        onOpenChange(false);
      } else {
        setDeleteStrategy(categoryEventCount > 0 ? "move" : "delete-events");
        setDeleteTargetCategoryId(deletionDestinations[0]?.id ?? "");
        setDeleteError(null);
        setDeleteDialogOpen(true);
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Falhou ao excluir categoria. Tente novamente."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!categoryId || !category || calendarPackCategory) return;
    if (deleteStrategy === "move" && !deleteTargetCategoryId) {
      setDeleteError("Escolha uma categoria de destino.");
      return;
    }

    try {
      setIsSaving(true);
      setDeleteError(null);
      const didDelete = deleteCategory({
        categoryId,
        strategy:
          deleteStrategy === "move"
            ? { type: "move", targetCategoryId: deleteTargetCategoryId }
            : { type: "delete-events" },
      });
      if (!didDelete) {
        throw new Error("Não foi possível excluir esta categoria.");
      }

      setDeleteDialogOpen(false);
      onOpenChange(false);
      notify({
        tone: "success",
        title: "Categoria excluída",
        description:
          deleteStrategy === "move"
            ? `${categoryEventCount} ${categoryEventCount === 1 ? "evento foi movido" : "eventos foram movidos"}.`
            : categoryEventCount > 0
              ? `${categoryEventCount} ${categoryEventCount === 1 ? "evento foi excluído" : "eventos foram excluídos"}.`
              : "A categoria vazia foi excluída.",
      });
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "Falhou ao excluir categoria. Tente novamente."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isCreateBlocked) {
    return (
      <ProUpgradeDialog
        open={open}
        onOpenChange={onOpenChange}
        reason="categories"
        onRequireAuth={onRequireAuth}
      />
    );
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        anchorPoint={anchorPoint}
        desktopPlacement="right-start"
        mobileMode="sheet"
        className="sm:max-w-[500px] p-5 sm:p-6"
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          <DialogDescription className="sr-only">
            {isEdit
              ? "Ajuste o nome, o contexto e a cor desta categoria."
              : "Defina o nome, o contexto e a cor da nova categoria."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <Input
            id="category-name"
            aria-label="Nome da categoria"
            value={name}
            onChange={(e) =>
              setName(e.target.value.slice(0, CATEGORY_NAME_MAX_LENGTH))
            }
            maxLength={CATEGORY_NAME_MAX_LENGTH}
            placeholder="Nome da categoria"
            className="h-10 rounded-xl"
          />

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Select
              value={profileDraftId}
              onValueChange={(nextProfileId) => {
                setProfileDraftId(nextProfileId);
                setSaveError(null);
              }}
            >
              <SelectTrigger
                size="sm"
                aria-label="Contexto da categoria"
                className={`${CHIP_TRIGGER_CLASS} border-border/80 bg-background text-foreground hover:bg-muted/70 sm:flex-1`}
                disabled={profiles.length === 0}
              >
                <span className="inline-flex min-w-0 items-center gap-1.5 pr-2">
                  {currentProfile ? <ProfileIcon icon={currentProfile.icon} size={12} /> : null}
                  <span className="truncate">{currentProfile?.name ?? "Contexto"}</span>
                </span>
              </SelectTrigger>
              <SelectContent position="popper" side="bottom" align="start">
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

            <div
              className="inline-flex h-10 max-w-full items-center gap-2 rounded-xl border px-3 text-sm font-medium shadow-sm sm:max-w-[220px]"
              style={{
                backgroundColor: currentColorToken.soft,
                borderColor: currentColorToken.border,
                color: currentColorToken.text,
              }}
            >
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/8"
                style={{ backgroundColor: currentColorToken.indicator }}
                aria-hidden="true"
              />
              <span className="truncate">{name.trim() || "Categoria"}</span>
            </div>
          </div>

          <CategoryColorPicker
            value={color}
            onChange={setColor}
            className="mx-auto max-w-[21rem]"
          />
        </div>
        <DialogFooter className="sm:justify-between">
          {isEdit ? (
            <Button variant="dangerSoft" onClick={handleDelete} disabled={!canDelete || isSaving}>
              {calendarPackCategory ? "Remover calendário" : "Deletar"}
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button variant="premium" onClick={handleSave} disabled={!canSave || isSaving}>
              {isSaving ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogFooter>
        {saveError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {saveError}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Excluir categoria</DialogTitle>
          <DialogDescription>
            {categoryEventCount > 0
              ? `Esta categoria contém ${categoryEventCount} ${categoryEventCount === 1 ? "evento" : "eventos"}. Escolha o que deve acontecer com esse conteúdo.`
              : "Esta categoria está vazia e será excluída."}
          </DialogDescription>
        </DialogHeader>

        {categoryEventCount > 0 ? (
          <div className="space-y-3" role="radiogroup" aria-label="Destino dos eventos">
            <div
              className={cn(
                "grid w-full grid-cols-1 items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors sm:grid-cols-[minmax(0,1fr)_minmax(10rem,14rem)]",
                deleteStrategy === "move"
                  ? "border-primary/45 bg-primary/5"
                  : "border-border hover:bg-muted/45"
              )}
            >
              <label className="min-w-0 cursor-pointer">
                <input
                  type="radio"
                  name="category-delete-strategy"
                  value="move"
                  checked={deleteStrategy === "move"}
                  onChange={() => {
                    setDeleteStrategy("move");
                    setDeleteError(null);
                  }}
                  className="sr-only"
                />
                <span className="block text-sm font-semibold text-foreground">
                  Mover eventos
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  Preserve os eventos em outra categoria.
                </span>
              </label>

              <Select
                value={deleteTargetCategoryId}
                onValueChange={(nextCategoryId) => {
                  setDeleteTargetCategoryId(nextCategoryId);
                  setDeleteStrategy("move");
                  setDeleteError(null);
                }}
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Categoria de destino dos eventos"
                  className="h-9 w-full rounded-[9px] bg-card text-xs font-semibold shadow-none"
                >
                  <span className="truncate">
                    {deleteTargetCategory
                      ? `${deleteTargetCategory.name} · ${profileNameById.get(deleteTargetCategory.profileId) ?? "Contexto"}`
                      : "Escolha uma categoria"}
                  </span>
                </SelectTrigger>
                <SelectContent align="start">
                  {deletionDestinations.map((destination) => (
                    <SelectItem key={destination.id} value={destination.id}>
                      {destination.name} · {profileNameById.get(destination.profileId) ?? "Contexto"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <label
              className={cn(
                "block w-full cursor-pointer rounded-xl border px-4 py-3 text-left transition-colors",
                deleteStrategy === "delete-events"
                  ? "border-destructive/45 bg-destructive/5"
                  : "border-border hover:bg-muted/45"
              )}
            >
              <input
                type="radio"
                name="category-delete-strategy"
                value="delete-events"
                checked={deleteStrategy === "delete-events"}
                onChange={() => {
                  setDeleteStrategy("delete-events");
                  setDeleteError(null);
                }}
                className="sr-only"
              />
              <span className="block text-sm font-semibold text-destructive">
                Excluir categoria e {categoryEventCount} {categoryEventCount === 1 ? "evento" : "eventos"}
              </span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                Essa ação não pode ser desfeita.
              </span>
            </label>
          </div>
        ) : null}

        {deleteError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {deleteError}
          </p>
        ) : null}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setDeleteDialogOpen(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            variant={deleteStrategy === "delete-events" ? "destructive" : "premium"}
            onClick={handleConfirmDelete}
            disabled={
              isSaving ||
              (deleteStrategy === "move" && !deleteTargetCategoryId)
            }
          >
            {isSaving
              ? "Excluindo..."
              : deleteStrategy === "move"
                ? "Mover e excluir categoria"
                : categoryEventCount > 0
                  ? "Excluir categoria e eventos"
                  : "Excluir categoria"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
