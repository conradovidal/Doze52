"use client";

import * as React from "react";
import { ProUpgradeDialog } from "@/components/billing/pro-upgrade-dialog";
import { ProfileIcon } from "@/components/profile-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  CATEGORY_COLOR_SETS,
  DEFAULT_CATEGORY_COLOR,
  getCategoryColorToken,
  getNearestCategoryColor,
} from "@/lib/category-palette";
import { calendarPacks } from "@/lib/calendar-packs";
import { isLimitReached } from "@/lib/entitlements";
import {
  findCalendarPackByCategoryId,
  removeCalendarPackCategory,
} from "@/lib/calendar-packs/import";
import { useStore } from "@/lib/store";
import { useTheme } from "@/lib/theme";
import { useBilling } from "@/lib/use-billing";
import type { AnchorPoint } from "@/lib/types";

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
}: CategoryManagerProps) {
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
        : "Selecione um perfil válido antes de criar a categoria."
    );
  }, [open, mode, category, profileId, profiles]);

  const isEdit = mode === "edit";
  const isCreateBlocked =
    open &&
    mode === "create" &&
    !isPro &&
    isLimitReached(categories.length, limits.maxCategories);
  const normalizedName = name.trim().slice(0, CATEGORY_NAME_MAX_LENGTH).trim();
  const canSave = normalizedName.length > 0 && Boolean(profileDraftId);
  const canDelete = Boolean(category) && categories.length > 1;
  const normalizedColor = color.toLowerCase();
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
        setSaveError("Selecione um perfil antes de criar a categoria.");
        return;
      }
      if (!isPro && isLimitReached(categories.length, limits.maxCategories)) {
        setSaveError("Mais categorias fazem parte do Doze52 Pro.");
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
        const result = removeCalendarPackCategory(snapshot, categoryId);
        replaceAllData(result.snapshot);
      } else {
        deleteCategory(categoryId);
      }
      onOpenChange(false);
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        anchorPoint={anchorPoint}
        desktopPlacement="right-start"
        mobileMode="sheet"
        className="sm:max-w-[500px] p-5 sm:p-6"
      >
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoria" : "Nova categoria"}</DialogTitle>
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
                aria-label="Perfil da categoria"
                className={`${CHIP_TRIGGER_CLASS} border-border/80 bg-background text-foreground hover:bg-muted/70 sm:flex-1`}
                disabled={profiles.length === 0}
              >
                <span className="inline-flex min-w-0 items-center gap-1.5 pr-2">
                  {currentProfile ? <ProfileIcon icon={currentProfile.icon} size={12} /> : null}
                  <span className="truncate">{currentProfile?.name ?? "Perfil"}</span>
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

          <div className="mx-auto w-full max-w-[21rem] space-y-3.5">
            {CATEGORY_COLOR_SETS.map((set, index) => (
              <fieldset
                key={set.id}
                className={index === 0 ? "space-y-2" : "space-y-2 border-t border-border/50 pt-3"}
              >
                <legend className="text-[11px] font-medium tracking-wide text-muted-foreground">
                  {set.label}
                </legend>
                <div className="grid grid-cols-8 gap-2 sm:gap-2.5">
                  {set.colors.map((preset) => {
                    const selected = preset.toLowerCase() === normalizedColor;
                    const presetToken = getCategoryColorToken(preset, themeMode);
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setColor(preset)}
                        aria-label={`Selecionar ${presetToken.label}`}
                        aria-pressed={selected}
                        title={presetToken.label}
                        className="grid size-[30px] place-items-center rounded-full border transition-[transform,opacity,box-shadow] hover:scale-105 hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45 sm:size-8"
                        style={{
                          backgroundColor: presetToken.soft,
                          borderColor: presetToken.border,
                          boxShadow: selected
                            ? `0 0 0 2px var(--background), 0 0 0 4px ${presetToken.indicator}`
                            : undefined,
                        }}
                      >
                        <span
                          aria-hidden="true"
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: presetToken.indicator }}
                        />
                        <span className="sr-only">{presetToken.label}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
        <DialogFooter className="sm:justify-between">
          {isEdit ? (
            <Button variant="dangerSoft" onClick={handleDelete} disabled={!canDelete || isSaving}>
              Deletar
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
  );
}
