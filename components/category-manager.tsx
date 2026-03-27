"use client";

import * as React from "react";
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
  getNearestCategoryColor,
} from "@/lib/category-palette";
import { useStore } from "@/lib/store";
import type { AnchorPoint } from "@/lib/types";

const CHIP_TRIGGER_CLASS =
  "h-10 w-full rounded-xl border px-3 text-sm shadow-sm transition-colors";

type CategoryManagerProps = {
  mode: "edit" | "create";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId?: string;
  profileId?: string;
  onCreated?: (id: string) => void;
  anchorPoint?: AnchorPoint;
};

export function CategoryManager({
  mode,
  open,
  onOpenChange,
  categoryId,
  profileId,
  onCreated,
  anchorPoint,
}: CategoryManagerProps) {
  const categories = useStore((s) => s.categories);
  const profiles = useStore((s) => s.profiles);
  const createCategory = useStore((s) => s.createCategory);
  const updateCategory = useStore((s) => s.updateCategory);
  const deleteCategory = useStore((s) => s.deleteCategory);

  const category = React.useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  );

  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(DEFAULT_CATEGORY_COLOR);
  const [profileDraftId, setProfileDraftId] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const effectiveCreateProfileId = profileId ?? profiles[0]?.id ?? "";
  const effectiveProfileId = category?.profileId ?? effectiveCreateProfileId;
  const currentProfile = React.useMemo(
    () => profiles.find((profile) => profile.id === profileDraftId || profile.id === effectiveProfileId) ?? null,
    [effectiveProfileId, profileDraftId, profiles]
  );

  React.useEffect(() => {
    if (!open) return;
    if (mode === "edit") {
      setName(category?.name ?? "");
      const initial = getNearestCategoryColor(category?.color ?? DEFAULT_CATEGORY_COLOR);
      setColor(initial);
      setProfileDraftId(category?.profileId ?? effectiveCreateProfileId);
      setIsSaving(false);
      setSaveError(null);
      return;
    }
    setName("");
    setColor(DEFAULT_CATEGORY_COLOR);
    setProfileDraftId(effectiveCreateProfileId);
    setIsSaving(false);
    setSaveError(null);
  }, [open, mode, category, effectiveCreateProfileId]);

  const isEdit = mode === "edit";
  const canSave = name.trim().length > 0 && Boolean(profileDraftId);
  const canDelete = categories.length > 1;
  const normalizedColor = color.toLowerCase();

  const handleSave = async () => {
    if (!canSave) return;
    try {
      setIsSaving(true);
      setSaveError(null);
      if (isEdit) {
        if (!categoryId) return;
        updateCategory(categoryId, {
          name: name.trim(),
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
      const id = createCategory({
        name: name.trim(),
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
      deleteCategory(categoryId);
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
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome da categoria"
            className="h-10 rounded-xl"
          />

          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <Select value={profileDraftId} onValueChange={setProfileDraftId}>
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

            <div className="inline-flex h-10 max-w-full items-center gap-2 rounded-xl border border-border/75 bg-muted/20 px-3 text-sm text-foreground shadow-sm sm:max-w-[220px]">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/8"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="truncate">{name.trim() || "Categoria"}</span>
            </div>
          </div>

          <div className="space-y-2">
            {CATEGORY_COLOR_SETS.map((set) => (
              <div key={set.id} className="flex justify-center">
                <div className="grid grid-cols-7 gap-2">
                  {set.colors.map((preset) => {
                    const selected = preset.toLowerCase() === normalizedColor;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setColor(preset)}
                        aria-label={`Selecionar cor ${preset.toUpperCase()}`}
                        className={`h-8 w-8 rounded-full border border-black/5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 ${
                          selected
                            ? "ring-2 ring-neutral-400 ring-offset-2"
                            : "hover:opacity-90"
                        }`}
                        style={{ backgroundColor: preset }}
                      >
                        <span className="sr-only">{preset.toUpperCase()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
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
