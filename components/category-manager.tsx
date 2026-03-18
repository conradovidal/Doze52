"use client";

import * as React from "react";
import { Palette } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CATEGORY_PRESET_COLORS } from "@/lib/category-palette";
import { useStore } from "@/lib/store";
import type { AnchorPoint } from "@/lib/types";

const DEFAULT_CATEGORY_COLOR = CATEGORY_PRESET_COLORS[0];
const CHIP_TRIGGER_CLASS =
  "h-10 w-full rounded-xl border px-3 text-sm shadow-sm transition-colors";
const FIELD_LABEL_CLASS =
  "text-[12px] font-semibold tracking-[-0.01em] text-foreground/78";

const normalizeHashPrefix = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
};

const isValidHexColor = (value: string) =>
  /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);

const normalizeHex = (value: string) => {
  const withHash = normalizeHashPrefix(value);
  if (!isValidHexColor(withHash)) return null;
  const hex = withHash.slice(1);
  if (hex.length === 3) {
    return `#${hex
      .split("")
      .map((c) => `${c}${c}`)
      .join("")
      .toUpperCase()}`;
  }
  return `#${hex.toUpperCase()}`;
};

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
  const [customHexDraft, setCustomHexDraft] = React.useState(DEFAULT_CATEGORY_COLOR);
  const [customHexError, setCustomHexError] = React.useState(false);
  const [customPopoverOpen, setCustomPopoverOpen] = React.useState(false);
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
      const initial = normalizeHex(category?.color ?? "") ?? DEFAULT_CATEGORY_COLOR;
      setColor(initial);
      setCustomHexDraft(initial);
      setCustomHexError(false);
      setCustomPopoverOpen(false);
      setProfileDraftId(category?.profileId ?? effectiveCreateProfileId);
      setIsSaving(false);
      setSaveError(null);
      return;
    }
    setName("");
    setColor(DEFAULT_CATEGORY_COLOR);
    setCustomHexDraft(DEFAULT_CATEGORY_COLOR);
    setCustomHexError(false);
    setCustomPopoverOpen(false);
    setProfileDraftId(effectiveCreateProfileId);
    setIsSaving(false);
    setSaveError(null);
  }, [open, mode, category, effectiveCreateProfileId]);

  const isEdit = mode === "edit";
  const canSave = name.trim().length > 0 && Boolean(profileDraftId);
  const canDelete = categories.length > 1;
  const normalizedColor = color.toLowerCase();
  const isPresetColor = CATEGORY_PRESET_COLORS.some(
    (c) => c.toLowerCase() === normalizedColor
  );

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

  const applyHexDraft = (raw: string) => {
    setCustomHexDraft(raw);
    const normalized = normalizeHex(raw);
    if (normalized) {
      setColor(normalized);
      setCustomHexError(false);
      return;
    }
    setCustomHexError(raw.trim().length > 0);
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
          <DialogDescription>
            Defina o essencial primeiro: nome, cor e perfil.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="category-name" className={FIELD_LABEL_CLASS}>
              Nome
            </label>
            <Input
              id="category-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da categoria"
              className="h-10 rounded-xl"
            />
          </div>

          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className={FIELD_LABEL_CLASS}>Cor</div>
                <p className="text-xs text-muted-foreground">
                  Use a cor como pista rapida de leitura.
                </p>
              </div>
              <div
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/80 px-3 text-xs font-medium text-white shadow-sm"
                style={{
                  backgroundColor: color,
                  borderColor: "rgba(255,255,255,0.28)",
                }}
              >
                <span className="h-2 w-2 rounded-full bg-white/80" />
                <span className="truncate">{name.trim() || "Categoria"}</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {CATEGORY_PRESET_COLORS.map((preset) => {
                const selected = preset.toLowerCase() === normalizedColor;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      const normalizedPreset = normalizeHex(preset) ?? preset;
                      setColor(normalizedPreset);
                      setCustomHexDraft(normalizedPreset);
                      setCustomHexError(false);
                    }}
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

              <Popover
                open={customPopoverOpen}
                onOpenChange={(nextOpen) => {
                  setCustomPopoverOpen(nextOpen);
                  if (nextOpen) {
                    setCustomHexDraft(color);
                    setCustomHexError(false);
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`h-8 rounded-full px-3 text-xs ${
                      !isPresetColor || customPopoverOpen ? "border-neutral-400 bg-muted/60" : ""
                    }`}
                  >
                    <Palette size={14} />
                    Mais cores
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-64 p-3"
                >
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Cor personalizada
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => {
                          const normalized = normalizeHex(e.target.value) ?? color;
                          setColor(normalized);
                          setCustomHexDraft(normalized);
                          setCustomHexError(false);
                        }}
                        className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-neutral-200 p-0"
                        aria-label="Color picker"
                      />
                      <Input
                        value={customHexDraft}
                        onChange={(e) => applyHexDraft(e.target.value)}
                        onBlur={() => {
                          const normalized = normalizeHex(customHexDraft);
                          if (!normalized) {
                            setCustomHexDraft(color);
                            setCustomHexError(false);
                            return;
                          }
                          setColor(normalized);
                          setCustomHexDraft(normalized);
                          setCustomHexError(false);
                        }}
                        placeholder="#RRGGBB"
                        aria-label="Código HEX"
                        className={customHexError ? "border-red-300 focus-visible:ring-red-200" : ""}
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={FIELD_LABEL_CLASS}>Perfil</label>
            <Select value={profileDraftId} onValueChange={setProfileDraftId}>
              <SelectTrigger
                size="sm"
                className={`${CHIP_TRIGGER_CLASS} border-border/80 bg-background text-foreground hover:bg-muted/70`}
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
