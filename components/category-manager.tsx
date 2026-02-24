"use client";

import * as React from "react";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CATEGORY_PRESET_COLORS } from "@/lib/category-palette";
import { useStore } from "@/lib/store";
const DEFAULT_CATEGORY_COLOR = CATEGORY_PRESET_COLORS[0];

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
  onCreated?: (id: string) => void;
};

export function CategoryManager({
  mode,
  open,
  onOpenChange,
  categoryId,
  onCreated,
}: CategoryManagerProps) {
  const categories = useStore((s) => s.categories);
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
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    if (mode === "edit") {
      setName(category?.name ?? "");
      const initial = normalizeHex(category?.color ?? "") ?? DEFAULT_CATEGORY_COLOR;
      setColor(initial);
      setCustomHexDraft(initial);
      setCustomHexError(false);
      setCustomPopoverOpen(false);
      setIsSaving(false);
      setSaveError(null);
      return;
    }
    setName("");
    setColor(DEFAULT_CATEGORY_COLOR);
    setCustomHexDraft(DEFAULT_CATEGORY_COLOR);
    setCustomHexError(false);
    setCustomPopoverOpen(false);
    setIsSaving(false);
    setSaveError(null);
  }, [open, mode, category]);

  const canSave = name.trim().length > 0;
  const isEdit = mode === "edit";
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
        updateCategory(categoryId, { name: name.trim(), color });
        onOpenChange(false);
        return;
      }
      const id = createCategory({ name: name.trim(), color });
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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="text-sm text-neutral-600">Nome da categoria</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
              Preview
            </div>
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white"
              style={{ backgroundColor: color }}
            >
              <span className="h-2 w-2 rounded-full bg-white/80" />
              {name.trim() || "Categoria"}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-neutral-600">Cor da categoria</div>
            <div className="flex flex-wrap items-center gap-3">
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
                  <button
                    type="button"
                    aria-label="Selecionar cor personalizada"
                    className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 bg-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 ${
                      !isPresetColor || customPopoverOpen
                        ? "ring-2 ring-neutral-400 ring-offset-2"
                        : ""
                    }`}
                  >
                    <Palette size={14} className="text-neutral-600" />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-60 rounded-2xl border-neutral-200 bg-white p-3 shadow-lg"
                >
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Custom
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
        </div>
        <DialogFooter className="sm:justify-between">
          {isEdit ? (
            <Button variant="destructive" onClick={handleDelete} disabled={!canDelete || isSaving}>
              Deletar
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!canSave || isSaving}>
              {isSaving ? "Salvando..." : isEdit ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogFooter>
        {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
