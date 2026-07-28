"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { ProUpgradeDialog } from "@/components/billing/pro-upgrade-dialog";
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
import { isLimitReached } from "@/lib/entitlements";
import { useStore } from "@/lib/store";
import { useBilling } from "@/lib/use-billing";
import { ProfileIcon } from "@/components/profile-icon";

const PROFILE_NAME_MAX_LENGTH = 28;

export type ProfileManagerIntent =
  | { mode: "create" }
  | { mode: "edit"; profileId: string };

type ProfileManagerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent: ProfileManagerIntent | null;
  onRequireAuth?: () => void;
  bypassLimits?: boolean;
  onCreated?: (profileId: string) => void;
};

export function ProfileManager({
  open,
  onOpenChange,
  intent,
  onRequireAuth,
  bypassLimits = false,
  onCreated,
}: ProfileManagerProps) {
  const { isPro, limits } = useBilling();
  const profiles = useStore((s) => s.profiles);
  const createProfile = useStore((s) => s.createProfile);
  const updateProfile = useStore((s) => s.updateProfile);
  const deleteProfile = useStore((s) => s.deleteProfile);

  const [name, setName] = React.useState("");
  const [icon, setIcon] = React.useState<ProfileIconId>(DEFAULT_PROFILE_ICON);
  const [deleteTargetProfileId, setDeleteTargetProfileId] = React.useState<string>("");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const editingProfile = React.useMemo(
    () =>
      intent?.mode === "edit"
        ? profiles.find((profile) => profile.id === intent.profileId) ?? null
        : null,
    [intent, profiles]
  );

  const startCreate = React.useCallback(() => {
    setName("");
    setIcon(DEFAULT_PROFILE_ICON);
    setDeleteTargetProfileId("");
    setConfirmDeleteOpen(false);
    setSaveError(null);
  }, []);

  const startEdit = React.useCallback(
    (profile: (typeof profiles)[number]) => {
      setName(profile.name);
      setIcon(profile.icon);
      const fallbackReassign = profiles.find((entry) => entry.id !== profile.id)?.id ?? "";
      setDeleteTargetProfileId(fallbackReassign);
      setConfirmDeleteOpen(false);
      setSaveError(null);
    },
    [profiles]
  );

  const showMissingIntentError = React.useCallback((message: string) => {
    setName("");
    setIcon(DEFAULT_PROFILE_ICON);
    setDeleteTargetProfileId("");
    setConfirmDeleteOpen(false);
    setSaveError(message);
  }, []);

  React.useEffect(() => {
    if (!open) return;

    if (intent?.mode === "create") {
      startCreate();
      return;
    }

    if (intent?.mode === "edit") {
      if (editingProfile) {
        startEdit(editingProfile);
        return;
      }
      showMissingIntentError("Este contexto não foi encontrado. Feche e tente novamente.");
      return;
    }

    showMissingIntentError("Não foi possível identificar a ação solicitada.");
  }, [editingProfile, intent, open, showMissingIntentError, startCreate, startEdit]);

  const isEditMode = intent?.mode === "edit";
  const isCreateIntent = intent?.mode === "create";
  const isCreateBlocked =
    open &&
    isCreateIntent &&
    !bypassLimits &&
    !isPro &&
    isLimitReached(profiles.length, limits.maxProfiles);
  const normalizedName = name.trim().slice(0, PROFILE_NAME_MAX_LENGTH).trim();
  const canSave =
    normalizedName.length > 0 && (isCreateIntent || Boolean(editingProfile));
  const canDelete = isEditMode && Boolean(editingProfile) && profiles.length > 1;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      setIsSaving(true);
      setSaveError(null);
      if (isEditMode) {
        if (!editingProfile) return;
        updateProfile(editingProfile.id, {
          name: normalizedName,
          icon,
        });
        onOpenChange(false);
        return;
      }

      if (
        !bypassLimits &&
        !isPro &&
        isLimitReached(profiles.length, limits.maxProfiles)
      ) {
        setSaveError("Vários contextos fazem parte do Doze 52 Pro.");
        return;
      }

      const createdId = createProfile({ name: normalizedName, icon });
      if (createdId) {
        onCreated?.(createdId);
        onOpenChange(false);
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Falhou ao salvar o contexto. Tente novamente."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editingProfile) return;
    if (profiles.length <= 1) return;
    if (!deleteTargetProfileId || deleteTargetProfileId === editingProfile.id) {
      setSaveError("Selecione um contexto de destino para reatribuir as categorias.");
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
          : "Falhou ao excluir o contexto. Tente novamente."
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

  if (isCreateBlocked) {
    return (
      <ProUpgradeDialog
        open={open}
        onOpenChange={onOpenChange}
        reason="profiles"
        onRequireAuth={onRequireAuth}
      />
    );
  }

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
          <DialogTitle>{isEditMode ? "Editar contexto" : "Novo contexto"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/75 bg-muted/35 text-foreground shadow-sm">
              <ProfileIcon icon={icon} size={18} />
            </div>
            <Input
              id="profile-name"
              aria-label="Nome do contexto"
              value={name}
              onChange={(event) =>
                setName(event.target.value.slice(0, PROFILE_NAME_MAX_LENGTH))
              }
              maxLength={PROFILE_NAME_MAX_LENGTH}
              placeholder="Nome do contexto"
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
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
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
          <DialogTitle>Excluir contexto</DialogTitle>
          <DialogDescription>
            As categorias deste contexto serão reatribuídas para outro contexto
            antes da exclusão.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
            As categorias deste contexto serão reatribuídas para:
            </p>
          <Select value={deleteTargetProfileId} onValueChange={setDeleteTargetProfileId}>
            <SelectTrigger className="h-10 rounded-xl border-border/80 bg-background shadow-sm">
              <SelectValue placeholder="Selecione o contexto de destino" />
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
