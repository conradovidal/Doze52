"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
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
      <DialogContent className="sm:max-w-[480px] p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle>{isEditMode ? "Editar perfil" : "Novo perfil"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/75 bg-muted/35 text-foreground shadow-sm">
              <ProfileIcon icon={icon} size={18} />
            </div>
            <Input
              id="profile-name"
              aria-label="Nome do perfil"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do perfil"
              className="h-11 flex-1 rounded-xl"
            />
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
                      ? "border-foreground/80 bg-foreground text-background shadow-sm"
                      : "border-border/80 bg-muted/25 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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

        {saveError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            {saveError}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
    <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Excluir perfil</DialogTitle>
          <DialogDescription>
            As categorias deste perfil serao reatribuidas para outro perfil antes da exclusao.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
            As categorias deste perfil serao reatribuidas para:
            </p>
          <Select value={deleteTargetProfileId} onValueChange={setDeleteTargetProfileId}>
            <SelectTrigger className="h-10 rounded-xl border-border/80 bg-background shadow-sm">
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
