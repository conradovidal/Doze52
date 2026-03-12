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
};

export function ProfileManager({
  open,
  onOpenChange,
  intent,
}: ProfileManagerProps) {
  const profiles = useStore((s) => s.profiles);
  const createProfile = useStore((s) => s.createProfile);
  const updateProfile = useStore((s) => s.updateProfile);
  const deleteProfile = useStore((s) => s.deleteProfile);

  const [editorMode, setEditorMode] = React.useState<"create" | "edit">("edit");
  const [editingProfileId, setEditingProfileId] = React.useState<string | null>(null);
  const [name, setName] = React.useState("");
  const [icon, setIcon] = React.useState<ProfileIconId>(DEFAULT_PROFILE_ICON);
  const [deleteTargetProfileId, setDeleteTargetProfileId] = React.useState<string>("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
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
    setDeleteTargetProfileId("");
    setConfirmDeleteOpen(false);
    setSaveError(null);
  }, []);

  const startEdit = React.useCallback(
    (profileId: string) => {
      const profile = profiles.find((entry) => entry.id === profileId);
      if (!profile) return;
      setEditorMode("edit");
      setEditingProfileId(profile.id);
      setName(profile.name);
      setIcon(profile.icon);
      const fallbackReassign = profiles.find((entry) => entry.id !== profile.id)?.id ?? "";
      setDeleteTargetProfileId(fallbackReassign);
      setConfirmDeleteOpen(false);
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
    setDeleteTargetProfileId(fallbackReassign);
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
    if (!deleteTargetProfileId || deleteTargetProfileId === editingProfile.id) {
      setSaveError("Selecione um perfil de destino para reatribuir as categorias.");
      return;
    }
    const target =
      deleteTargetProfileId && deleteTargetProfileId !== editingProfile.id
        ? deleteTargetProfileId
        : profiles.find((profile) => profile.id !== editingProfile.id)?.id;
    if (!target) return;

    try {
      setIsSaving(true);
      setSaveError(null);
      deleteProfile({ profileId: editingProfile.id, reassignToProfileId: target });
      setConfirmDeleteOpen(false);
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

  const openDeleteConfirm = () => {
    if (!editingProfile || profiles.length <= 1) return;
    const fallbackTarget = profiles.find((profile) => profile.id !== editingProfile.id)?.id;
    setDeleteTargetProfileId((current) =>
      current && current !== editingProfile.id ? current : (fallbackTarget ?? "")
    );
    setConfirmDeleteOpen(true);
  };

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setConfirmDeleteOpen(false);
        }
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-[460px] p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Editar perfil" : "Novo perfil"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-100 text-neutral-700 shadow-sm dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
              <ProfileIcon icon={icon} size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="profile-name" className="sr-only">
                Nome do perfil
              </label>
              <Input
                id="profile-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Titulo do perfil"
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {PROFILE_ICON_OPTIONS.map((option) => {
              const selected = option.id === icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setIcon(option.id as ProfileIconId)}
                  aria-label={option.label}
                  title={option.label}
                  className={`inline-flex h-10 items-center justify-center rounded-xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-300 ${
                    selected
                      ? "border-neutral-900 bg-neutral-900 text-neutral-50 shadow-sm dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
                      : "border-neutral-200 bg-neutral-50 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  }`}
                >
                  <ProfileIcon icon={option.id} size={18} />
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          {canDelete ? (
            <Button variant="dangerSoft" onClick={openDeleteConfirm} disabled={isSaving}>
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
            <Button variant="premium" onClick={handleSave} disabled={!canSave || isSaving}>
              {isSaving ? "Salvando..." : isEditMode ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogFooter>

        {saveError ? <p className="text-sm text-red-600">{saveError}</p> : null}
      </DialogContent>
    </Dialog>
    <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Excluir perfil</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            As categorias deste perfil serao reatribuidas para:
          </p>
          <Select value={deleteTargetProfileId} onValueChange={setDeleteTargetProfileId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o perfil de destino" />
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
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setConfirmDeleteOpen(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button
            variant="dangerSoft"
            onClick={handleDelete}
            disabled={!deleteTargetProfileId || isSaving}
          >
            Confirmar exclusao
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
