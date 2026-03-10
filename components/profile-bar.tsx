"use client";

import * as React from "react";
import { GripVertical, Pencil, Plus } from "lucide-react";
import { CategoryManager } from "@/components/category-manager";
import { ProfileIcon } from "@/components/profile-icon";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/store";
import { ProfileManager, type ProfileManagerIntent } from "@/components/profile-manager";
import type { CalendarProfile } from "@/lib/types";

const MOBILE_LONG_PRESS_MS = 300;

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
};

export function ProfileBar({ compact = false, isGlobalEditMode = false }: ProfileBarProps) {
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

  const longPressTimerRef = React.useRef<number | null>(null);
  const activePointerIdRef = React.useRef<number | null>(null);
  const isTouchDraggingRef = React.useRef(false);

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
    setDragSourceId(null);
    setDragOverId(null);
  }, [clearLongPressTimer]);

  React.useEffect(() => {
    if (!isGlobalEditMode) {
      clearDragState();
    }
  }, [isGlobalEditMode, clearDragState]);

  React.useEffect(() => clearLongPressTimer, [clearLongPressTimer]);

  const commitProfilesOrder = React.useCallback(
    (sourceId: string, targetId: string) => {
      if (sourceId === targetId) return;
      const reordered = moveInArray<CalendarProfile>(profiles, sourceId, targetId);
      const didChange = reordered.some((profile, index) => profile.id !== profiles[index]?.id);
      if (!didChange) return;
      setProfilesOrder(reordered.map((profile) => profile.id));
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
        {profiles.map((profile) => {
          const selected = selectedSet.has(profile.id);
          const chipClass = `inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
            selected
              ? "border-neutral-800 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900"
              : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-neutral-800"
          }`;
          const dragRing = isGlobalEditMode && dragOverId === profile.id ? "ring-2 ring-neutral-400/80" : "";

          if (isGlobalEditMode) {
            return (
              <div
                key={profile.id}
                data-profile-chip-id={profile.id}
                draggable
                onDragStart={(event) => {
                  setDragSourceId(profile.id);
                  setDragOverId(profile.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDragEnter={() => {
                  if (!dragSourceId || dragSourceId === profile.id) return;
                  setDragOverId(profile.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragSourceId) {
                    commitProfilesOrder(dragSourceId, profile.id);
                  }
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
                  }, MOBILE_LONG_PRESS_MS);
                }}
                onPointerMove={(event) => {
                  if (event.pointerType !== "touch") return;
                  if (activePointerIdRef.current !== event.pointerId) return;
                  if (!isTouchDraggingRef.current) return;
                  event.preventDefault();
                  const targetId = resolveProfileIdFromPoint(event.clientX, event.clientY);
                  if (targetId) {
                    setDragOverId(targetId);
                  }
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
                  if (isTouchDraggingRef.current && dragSourceId && dragOverId) {
                    commitProfilesOrder(dragSourceId, dragOverId);
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
            variant="secondary"
            size="sm"
            onClick={openCreateManager}
            aria-label="Criar novo perfil"
            title="Novo perfil"
          >
            <Plus size={14} />
          </Button>
        ) : null}
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
