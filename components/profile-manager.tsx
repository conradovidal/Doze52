"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
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
import { ProfileIcon } from "@/components/profile-icon";

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

  const isEditMode = editorMode === "edit";
  const canSave =
    name.trim().length > 0 && (editorMode === "create" || Boolean(editingProfile));
  const canDelete = isEditMode && profiles.length > 1;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      setIsSaving(true);
      setSaveError(null);
      if (editorMode === "edit") {
        if (!editingProfile) return;
        updateProfile(editingProfile.id, {
          name: name.trim(),
          icon,
        });
        onOpenChange(false);
        return;
      }

      const createdId = createProfile({ name: name.trim(), icon });
      if (createdId) {
        onOpenChange(false);
        onProfileCreated?.(createdId);
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
      onOpenChange(false);
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
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Editar perfil" : "Novo perfil"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 rounded-xl border border-neutral-200 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            {isEditMode ? "Perfil" : "Criar perfil"}
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
            <Select value={icon} onValueChange={(value) => setIcon(value as ProfileIconId)}>
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

        <DialogFooter className="sm:justify-between">
          {canDelete ? (
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              <Trash2 size={14} className="mr-1" />
              Excluir
            </Button>
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
              {isEditMode ? "Fechar" : "Cancelar"}
            </Button>
            <Button onClick={handleSave} disabled={!canSave || isSaving}>
              {isSaving ? "Salvando..." : isEditMode ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogFooter>

        {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
      </DialogContent>
    </Dialog>
  );
}
