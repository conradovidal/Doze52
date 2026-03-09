"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
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
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_PROFILE_ICON,
  PROFILE_ICON_OPTIONS,
  type ProfileIconId,
} from "@/lib/profile-icons";
import { useStore } from "@/lib/store";

export type ProfileManagerIntent =
  | { mode: "create" }
  | { mode: "edit"; profileId: string };

type ProfileManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent?: ProfileManagerIntent;
  onProfileCreated?: (profileId: string) => void;
};

export function ProfileManager({
  open,
  onOpenChange,
  intent,
  onProfileCreated,
}: ProfileManagerProps) {
  const profiles = useStore((s) => s.profiles);
  const createProfile = useStore((s) => s.createProfile);
  const updateProfile = useStore((s) => s.updateProfile);
  const deleteProfile = useStore((s) => s.deleteProfile);
  const setProfilesOrder = useStore((s) => s.setProfilesOrder);

  const [editorMode, setEditorMode] = React.useState<"create" | "edit">("edit");
  const [editingProfileId, setEditingProfileId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [icon, setIcon] = React.useState<ProfileIconId>(DEFAULT_PROFILE_ICON);
  const [reassignProfileId, setReassignProfileId] = React.useState<string>("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const initializedRef = React.useRef(false);

  const editingProfile = React.useMemo(
    () =>
      editorMode === "edit"
        ? profiles.find((profile) => profile.id === editingProfileId) ?? null
        : null,
    [editorMode, profiles, editingProfileId]
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
    setEditorMode("create");
    setEditingProfileId(null);
    setName("");
    setIcon(DEFAULT_PROFILE_ICON);
    setReassignProfileId(profiles[0]?.id ?? "");
    setSaveError(null);
  }, [profiles]);

  const startEdit = React.useCallback(
    (profileId: string) => {
      const profile = profiles.find((entry) => entry.id === profileId);
      if (!profile) return;
      setEditorMode("edit");
      setEditingProfileId(profile.id);
      setName(profile.name);
      setIcon(profile.icon);
      const fallbackReassign = profiles.find((entry) => entry.id !== profile.id)?.id ?? "";
      setReassignProfileId(fallbackReassign);
      setSaveError(null);
    },
    [profiles]
  );

  React.useEffect(() => {
    if (!open) {
      initializedRef.current = false;
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;

    if (profiles.length === 0) {
      startCreate();
      return;
    }

    if (intent?.mode === "create") {
      startCreate();
      return;
    }

    if (intent?.mode === "edit") {
      const intendedProfile = profiles.find((profile) => profile.id === intent.profileId);
      if (intendedProfile) {
        startEdit(intendedProfile.id);
        return;
      }
    }

    const preferredId =
      editingProfileId && profiles.some((profile) => profile.id === editingProfileId)
        ? editingProfileId
        : profiles[0]?.id;
    if (!preferredId) {
      startCreate();
      return;
    }
    startEdit(preferredId);
  }, [open, intent, profiles, editingProfileId, startCreate, startEdit]);

  React.useEffect(() => {
    if (!open || editorMode !== "edit") return;
    if (profiles.length === 0) {
      startCreate();
      return;
    }
    if (!editingProfileId) {
      startEdit(profiles[0].id);
      return;
    }
    const current = profiles.find((profile) => profile.id === editingProfileId);
    if (!current) {
      startEdit(profiles[0].id);
      return;
    }
    const fallbackReassign = profiles.find((entry) => entry.id !== current.id)?.id ?? "";
    setReassignProfileId(fallbackReassign);
    setName(current.name);
    setIcon(current.icon);
  }, [open, editorMode, profiles, editingProfileId, startCreate, startEdit]);

  const canSave = name.trim().length > 0;
  const isEditMode = editorMode === "edit" && Boolean(editingProfile);

  const handleSave = async () => {
    if (!canSave) return;
    try {
      setIsSaving(true);
      setSaveError(null);
      if (editingProfile) {
        updateProfile(editingProfile.id, {
          name: name.trim(),
          icon,
        });
      } else {
        const createdId = createProfile({ name: name.trim(), icon });
        if (createdId) {
          onOpenChange(false);
          onProfileCreated?.(createdId);
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
                    <ProfileIcon icon={profile.icon} className="text-neutral-500" />
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
              <label htmlFor="profile-icon" className="text-sm text-neutral-600">
                Icone
              </label>
              <Select
                value={icon}
                onValueChange={(value) => setIcon(value as ProfileIconId)}
              >
                <SelectTrigger id="profile-icon">
                  <SelectValue placeholder="Selecione um icone" />
                </SelectTrigger>
                <SelectContent>
                  {PROFILE_ICON_OPTIONS.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      <span className="inline-flex items-center gap-2">
                        <ProfileIcon icon={option.id} size={14} />
                        {option.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
