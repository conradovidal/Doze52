"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
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
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";

const DEFAULT_PROFILE_COLOR = "#64748B";

type ProfileManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProfileManager({ open, onOpenChange }: ProfileManagerProps) {
  const profiles = useStore((s) => s.profiles);
  const createProfile = useStore((s) => s.createProfile);
  const updateProfile = useStore((s) => s.updateProfile);
  const deleteProfile = useStore((s) => s.deleteProfile);
  const setProfilesOrder = useStore((s) => s.setProfilesOrder);

  const [editingProfileId, setEditingProfileId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState(DEFAULT_PROFILE_COLOR);
  const [reassignProfileId, setReassignProfileId] = React.useState<string>("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);

  const editingProfile = React.useMemo(
    () => profiles.find((profile) => profile.id === editingProfileId) ?? null,
    [profiles, editingProfileId]
  );

  const reorder = React.useCallback(
    (profileId: string, delta: -1 | 1) => {
      const currentIndex = profiles.findIndex((profile) => profile.id === profileId);
      if (currentIndex === -1) return;
      const targetIndex = currentIndex + delta;
      if (targetIndex < 0 || targetIndex >= profiles.length) return;
      const next = [...profiles];
      const [moved] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, moved);
      setProfilesOrder(next.map((profile) => profile.id));
    },
    [profiles, setProfilesOrder]
  );

  const startCreate = React.useCallback(() => {
    setEditingProfileId(null);
    setName("");
    setColor(DEFAULT_PROFILE_COLOR);
    setReassignProfileId(profiles[0]?.id ?? "");
    setSaveError(null);
  }, [profiles]);

  const startEdit = React.useCallback(
    (profileId: string) => {
      const profile = profiles.find((entry) => entry.id === profileId);
      if (!profile) return;
      setEditingProfileId(profile.id);
      setName(profile.name);
      setColor(profile.color || DEFAULT_PROFILE_COLOR);
      const fallbackReassign = profiles.find((entry) => entry.id !== profile.id)?.id ?? "";
      setReassignProfileId(fallbackReassign);
      setSaveError(null);
    },
    [profiles]
  );

  React.useEffect(() => {
    if (!open) return;
    if (profiles.length === 0) {
      startCreate();
      return;
    }

    const firstProfile = profiles[0];
    const keepCurrent = editingProfileId
      ? profiles.find((profile) => profile.id === editingProfileId)
      : null;
    if (keepCurrent) {
      startEdit(keepCurrent.id);
      return;
    }
    startEdit(firstProfile.id);
  }, [open, profiles, editingProfileId, startCreate, startEdit]);

  const canSave = name.trim().length > 0;
  const isEditMode = Boolean(editingProfile);

  const handleSave = async () => {
    if (!canSave) return;
    try {
      setIsSaving(true);
      setSaveError(null);
      if (editingProfile) {
        updateProfile(editingProfile.id, {
          name: name.trim(),
          color,
        });
      } else {
        const createdId = createProfile({ name: name.trim(), color });
        if (createdId) {
          setEditingProfileId(createdId);
        }
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Falhou ao salvar perfil. Tente novamente."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingProfile) return;
    if (profiles.length <= 1) return;
    const target =
      reassignProfileId && reassignProfileId !== editingProfile.id
        ? reassignProfileId
        : profiles.find((profile) => profile.id !== editingProfile.id)?.id;
    if (!target) return;

    try {
      setIsSaving(true);
      setSaveError(null);
      deleteProfile({ profileId: editingProfile.id, reassignToProfileId: target });
      const nextProfile = profiles.find((profile) => profile.id !== editingProfile.id);
      if (nextProfile) {
        startEdit(nextProfile.id);
      } else {
        startCreate();
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Falhou ao excluir perfil. Tente novamente."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Gerenciar perfis</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              Perfis
            </div>
            <div className="space-y-2">
              {profiles.map((profile, index) => (
                <div
                  key={profile.id}
                  className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${
                    editingProfileId === profile.id
                      ? "border-neutral-400 bg-neutral-50 dark:border-neutral-500 dark:bg-neutral-900"
                      : "border-neutral-200"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => startEdit(profile.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded px-2 py-1 text-left hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: profile.color }}
                    />
                    <span className="truncate text-sm">{profile.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => reorder(profile.id, -1)}
                    disabled={index === 0}
                    className="inline-flex rounded p-1 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-neutral-800"
                    aria-label={`Mover perfil ${profile.name} para esquerda`}
                  >
                    <ChevronLeft size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => reorder(profile.id, 1)}
                    disabled={index === profiles.length - 1}
                    className="inline-flex rounded p-1 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-neutral-800"
                    aria-label={`Mover perfil ${profile.name} para direita`}
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={startCreate}>
              <Plus size={14} className="mr-1" />
              Novo perfil
            </Button>
          </div>

          <div className="grid gap-3 rounded-xl border border-neutral-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {isEditMode ? "Editar perfil" : "Criar perfil"}
            </div>
            <div className="space-y-1">
              <label htmlFor="profile-name" className="text-sm text-neutral-600">
                Nome do perfil
              </label>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Profissional"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="profile-color" className="text-sm text-neutral-600">
                Cor
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="profile-color"
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-10 w-10 cursor-pointer rounded-md border border-neutral-200 p-0"
                />
                <Input
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  placeholder="#64748B"
                />
              </div>
            </div>

            {isEditMode && profiles.length > 1 ? (
              <div className="space-y-1">
                <label className="text-sm text-neutral-600">Reatribuir categorias para</label>
                <Select value={reassignProfileId} onValueChange={setReassignProfileId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Perfil de destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles
                      .filter((profile) => profile.id !== editingProfile?.id)
                      .map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {isEditMode ? (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={profiles.length <= 1 || isSaving}
            >
              <Trash2 size={14} className="mr-1" />
              Excluir
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              Fechar
            </Button>
            <Button onClick={handleSave} disabled={!canSave || isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </DialogFooter>

        {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
