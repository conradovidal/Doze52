"use client";

import * as React from "react";
import { Check, GripVertical, Pencil, Plus } from "lucide-react";
import { CategoryManager } from "@/components/category-manager";
import { ProfileIcon } from "@/components/profile-icon";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { ProfileManager, type ProfileManagerIntent } from "@/components/profile-manager";
import type { CalendarProfile } from "@/lib/types";

const MOBILE_LONG_PRESS_MS = 300;
const ADD_BUTTON_CLASS =
  "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800";

const moveInArray = <T extends { id: string }>(
  arr: T[],
  sourceId: string,
  targetId: string
) => {
  const sourceIndex = arr.findIndex((item) => item.id === sourceId);
  const targetIndex = arr.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return arr;
  const next = [...arr];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
};

type ProfileBarProps = {
  compact?: boolean;
  isGlobalEditMode?: boolean;
  onGlobalEditModeChange?: (enabled: boolean) => void;
};

export function ProfileBar({
  compact = false,
  isGlobalEditMode = false,
  onGlobalEditModeChange,
}: ProfileBarProps) {
  const profiles = useStore((s) => s.profiles);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const setProfilesOrder = useStore((s) => s.setProfilesOrder);
  const toggleSelectedProfile = useStore((s) => s.toggleSelectedProfile);

  const [managerOpen, setManagerOpen] = React.useState(false);
  const [managerIntent, setManagerIntent] = React.useState<ProfileManagerIntent | null>(
    null
  );
  const [pendingCategoryProfileId, setPendingCategoryProfileId] = React.useState<
    string | null
  >(null);
  const [dragSourceId, setDragSourceId] = React.useState<string | null>(null);
  const [dragOverId, setDragOverId] = React.useState<string | null>(null);
  const [previewOrder, setPreviewOrder] = React.useState<CalendarProfile[] | null>(null);

  const longPressTimerRef = React.useRef<number | null>(null);
  const activePointerIdRef = React.useRef<number | null>(null);
  const isTouchDraggingRef = React.useRef(false);
  const previewOrderRef = React.useRef<CalendarProfile[] | null>(null);

  React.useEffect(() => {
    previewOrderRef.current = previewOrder;
  }, [previewOrder]);

  const clearLongPressTimer = React.useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const clearDragState = React.useCallback(() => {
    clearLongPressTimer();
    activePointerIdRef.current = null;
    isTouchDraggingRef.current = false;
    previewOrderRef.current = null;
    setDragSourceId(null);
    setDragOverId(null);
    setPreviewOrder(null);
  }, [clearLongPressTimer]);

  React.useEffect(() => {
    if (!isGlobalEditMode) {
      clearDragState();
    }
  }, [isGlobalEditMode, clearDragState]);

  React.useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const displayedProfiles = previewOrder ?? profiles;

  const commitProfilesOrder = React.useCallback(
    (finalOrder: CalendarProfile[] | null) => {
      if (!finalOrder || finalOrder.length === 0) return;
      const didChange = finalOrder.some((profile, index) => profile.id !== profiles[index]?.id);
      if (!didChange) return;
      setProfilesOrder(finalOrder.map((profile) => profile.id));
    },
    [profiles, setProfilesOrder]
  );

  const resolveProfileIdFromPoint = React.useCallback((x: number, y: number) => {
    if (typeof document === "undefined") return null;
    const node = document.elementFromPoint(x, y) as HTMLElement | null;
    return node?.closest<HTMLElement>("[data-profile-chip-id]")?.dataset.profileChipId ?? null;
  }, []);

  if (profiles.length === 0) {
    return null;
  }

  const selectedSet = new Set(selectedProfileIds);
  const openCreateManager = () => {
    setManagerIntent({ mode: "create" });
    setManagerOpen(true);
  };
  const openEditManager = (profileId: string) => {
    setManagerIntent({ mode: "edit", profileId });
    setManagerOpen(true);
  };

  return (
    <>
      <div
        className={`${compact ? "w-full justify-center" : "mb-3 justify-center"} flex flex-wrap items-center gap-2`}
      >
        {displayedProfiles.map((profile) => {
          const selected = selectedSet.has(profile.id);
          const chipClass = `inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-all duration-150 ${
            selected
              ? "border-neutral-500 bg-neutral-300 text-neutral-900 hover:bg-neutral-400 dark:border-neutral-500 dark:bg-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-500"
              : "border-neutral-300 bg-neutral-100 text-neutral-700 hover:bg-neutral-200 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
          }`;
          const dragRing =
            isGlobalEditMode && dragOverId === profile.id ? "ring-2 ring-neutral-400/80" : "";

          if (isGlobalEditMode) {
            return (
              <div
                key={profile.id}
                data-profile-chip-id={profile.id}
                draggable
                onDragStart={(event) => {
                  setDragSourceId(profile.id);
                  setDragOverId(profile.id);
                  setPreviewOrder(displayedProfiles);
                  previewOrderRef.current = displayedProfiles;
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnter={() => {
                  if (!dragSourceId || dragSourceId === profile.id) return;
                  setDragOverId(profile.id);
                  const nextOrder = moveInArray(
                    previewOrderRef.current ?? displayedProfiles,
                    dragSourceId,
                    profile.id
                  );
                  setPreviewOrder(nextOrder);
                  previewOrderRef.current = nextOrder;
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  commitProfilesOrder(previewOrderRef.current ?? previewOrder ?? displayedProfiles);
                  clearDragState();
                }}
                onDragEnd={() => {
                  clearDragState();
                }}
                onPointerDown={(event) => {
                  if (event.pointerType !== "touch") return;
                  activePointerIdRef.current = event.pointerId;
                  event.currentTarget.setPointerCapture(event.pointerId);
                  clearLongPressTimer();
                  longPressTimerRef.current = window.setTimeout(() => {
                    isTouchDraggingRef.current = true;
                    setDragSourceId(profile.id);
                    setDragOverId(profile.id);
                    setPreviewOrder(displayedProfiles);
                    previewOrderRef.current = displayedProfiles;
                  }, MOBILE_LONG_PRESS_MS);
                }}
                onPointerMove={(event) => {
                  if (event.pointerType !== "touch") return;
                  if (activePointerIdRef.current !== event.pointerId) return;
                  if (!isTouchDraggingRef.current || !dragSourceId) return;
                  event.preventDefault();
                  const targetId = resolveProfileIdFromPoint(event.clientX, event.clientY);
                  if (!targetId || targetId === dragOverId) return;
                  setDragOverId(targetId);
                  const nextOrder = moveInArray(
                    previewOrderRef.current ?? displayedProfiles,
                    dragSourceId,
                    targetId
                  );
                  setPreviewOrder(nextOrder);
                  previewOrderRef.current = nextOrder;
                }}
                onPointerUp={(event) => {
                  if (event.pointerType !== "touch") return;
                  if (activePointerIdRef.current !== event.pointerId) return;
                  clearLongPressTimer();
                  try {
                    event.currentTarget.releasePointerCapture(event.pointerId);
                  } catch {
                    // no-op
                  }
                  if (isTouchDraggingRef.current) {
                    commitProfilesOrder(
                      previewOrderRef.current ?? previewOrder ?? displayedProfiles
                    );
                  }
                  clearDragState();
                }}
                onPointerCancel={(event) => {
                  if (event.pointerType !== "touch") return;
                  if (activePointerIdRef.current !== event.pointerId) return;
                  clearDragState();
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                }}
                className={`${chipClass} ${dragRing} cursor-grab`}
              >
                <GripVertical size={12} className="shrink-0" />
                <span>{profile.name}</span>
                <button
                  type="button"
                  onClick={() => openEditManager(profile.id)}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                  }}
                  onDragStart={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                  className="ml-1 inline-flex rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
                  aria-label={`Editar perfil ${profile.name}`}
                  title={`Editar perfil ${profile.name}`}
                >
                  <Pencil size={12} />
                </button>
              </div>
            );
          }

          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => toggleSelectedProfile(profile.id)}
              className={chipClass}
            >
              <ProfileIcon icon={profile.icon} size={12} className="shrink-0" />
              <span>{profile.name}</span>
            </button>
          );
        })}

        {isGlobalEditMode ? (
          <Button
            variant="outline"
            size="sm"
            onClick={openCreateManager}
            className={ADD_BUTTON_CLASS}
            aria-label="Criar novo perfil"
            title="Novo perfil"
          >
            <Plus size={14} />
          </Button>
        ) : null}

        <Button
          variant={isGlobalEditMode ? "default" : "ghost"}
          size="sm"
          onClick={() => onGlobalEditModeChange?.(!isGlobalEditMode)}
          aria-label={isGlobalEditMode ? "Finalizar edição" : "Ativar edição"}
          title={isGlobalEditMode ? "Finalizar edição" : "Editar perfis e categorias"}
        >
          {isGlobalEditMode ? (
            <>
              <Check size={14} />
              Done
            </>
          ) : (
            <Pencil size={14} />
          )}
        </Button>
      </div>

      <ProfileManager
        open={managerOpen}
        onOpenChange={(open) => {
          setManagerOpen(open);
          if (!open) {
            setManagerIntent(null);
          }
        }}
        intent={managerIntent ?? undefined}
        onProfileCreated={(profileId) => {
          setPendingCategoryProfileId(profileId);
        }}
      />
      <CategoryManager
        mode="create"
        open={Boolean(pendingCategoryProfileId)}
        onOpenChange={(open) => {
          if (!open) {
            setPendingCategoryProfileId(null);
          }
        }}
        profileId={pendingCategoryProfileId ?? undefined}
      />
    </>
  );
}
