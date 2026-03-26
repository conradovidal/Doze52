"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, PencilLine, Plus } from "lucide-react";
import { ProfileIcon } from "@/components/profile-icon";
import {
  arraysEqual,
  INLINE_SORTABLE_MEASURING,
  orderItemsByIds,
  pointerAwareCollisionDetection,
  preserveActivatorOffsetModifier,
} from "@/lib/inline-sortable";
import { useStore } from "@/lib/store";
import type { CalendarProfile } from "@/lib/types";
import { cn } from "@/lib/utils";

const MOTION_CLASS = "duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)]";
const CHIP_SHELL_CLASS =
  "group relative inline-flex h-8 items-center overflow-hidden rounded-full border transition-[background-color,border-color,box-shadow,transform] shadow-none";
const CHIP_HANDLE_CLASS =
  "inline-flex h-8 w-8 shrink-0 touch-none cursor-grab items-center justify-center rounded-full text-muted-foreground/72 transition-colors hover:bg-muted/42 hover:text-foreground active:cursor-grabbing";
const CHIP_EDIT_ACTION_CLASS =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground/72 transition-colors hover:bg-muted/42 hover:text-foreground";
const CHIP_PLACEHOLDER_CLASS =
  "pointer-events-none absolute inset-[3px] rounded-full border border-dashed border-border/70 bg-muted/26";
const CHIP_OVERLAY_CLASS =
  "border-border/75 bg-background shadow-[0_18px_30px_-18px_rgba(15,23,42,0.28)]";

type ProfileBarProps = {
  compact?: boolean;
  isInlineEditMode?: boolean;
  editingProfileId?: string | null;
  onEditingProfileChange?: (profileId: string) => void;
  onCreateProfile?: () => void;
  onEditProfile?: (profileId: string) => void;
};

type DragState = {
  id: string;
  width: number | null;
};

function EditProfileChip({
  profile,
  isActive,
  onSelect,
  onEdit,
  interactiveHandle = false,
  handleAttributes,
  handleListeners,
  setHandleRef,
  isPlaceholder = false,
  isOverlay = false,
  style,
  chipRef,
}: {
  profile: CalendarProfile;
  isActive: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  interactiveHandle?: boolean;
  handleAttributes?: ReturnType<typeof useSortable>["attributes"];
  handleListeners?: ReturnType<typeof useSortable>["listeners"];
  setHandleRef?: ReturnType<typeof useSortable>["setActivatorNodeRef"];
  isPlaceholder?: boolean;
  isOverlay?: boolean;
  style?: React.CSSProperties;
  chipRef?: (node: HTMLElement | null) => void;
}) {
  const BodyComp = isOverlay || isPlaceholder ? "div" : "button";
  const EditComp = isOverlay || isPlaceholder ? "div" : "button";

  return (
    <div
      ref={chipRef}
      style={style}
      className={cn(
        CHIP_SHELL_CLASS,
        isActive
          ? "border-foreground/16 bg-foreground/[0.06] text-foreground"
          : "border-border/60 bg-background text-foreground/78 hover:border-border/78 hover:bg-muted/30 hover:text-foreground",
        isOverlay && CHIP_OVERLAY_CLASS,
        isPlaceholder && "bg-muted/10"
      )}
    >
      {isPlaceholder ? <div className={CHIP_PLACEHOLDER_CLASS} /> : null}

      <div className={cn("shrink-0", isPlaceholder && "invisible")}>
        {interactiveHandle ? (
          <button
            type="button"
            ref={setHandleRef}
            aria-label={`Reordenar perfil ${profile.name}`}
            title={`Reordenar perfil ${profile.name}`}
            className={CHIP_HANDLE_CLASS}
            {...handleAttributes}
            {...handleListeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        ) : (
          <span className={cn(CHIP_HANDLE_CLASS, "cursor-default")} aria-hidden="true">
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      <BodyComp
        type={BodyComp === "button" ? "button" : undefined}
        onClick={BodyComp === "button" ? onSelect : undefined}
        aria-label={BodyComp === "button" ? `Selecionar perfil ${profile.name} para editar` : undefined}
        className={cn(
          "flex min-w-0 items-center gap-1.5 pl-1 pr-2 text-[0.78rem] font-medium",
          isPlaceholder && "invisible"
        )}
      >
        <span className="truncate">{profile.name}</span>
      </BodyComp>

      <EditComp
        type={EditComp === "button" ? "button" : undefined}
        onClick={
          EditComp === "button"
            ? (event: React.MouseEvent) => {
                event.stopPropagation();
                onEdit?.();
              }
            : undefined
        }
        aria-label={EditComp === "button" ? `Editar perfil ${profile.name}` : undefined}
        title={EditComp === "button" ? `Editar perfil ${profile.name}` : undefined}
        className={cn("pr-1", isPlaceholder && "invisible")}
      >
        <span className={CHIP_EDIT_ACTION_CLASS}>
          <PencilLine className="h-3.5 w-3.5" />
        </span>
      </EditComp>
    </div>
  );
}

function SortableEditProfileChip({
  profile,
  isActive,
  dragEnabled,
  onSelect,
  onEdit,
}: {
  profile: CalendarProfile;
  isActive: boolean;
  dragEnabled: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: profile.id,
    disabled: !dragEnabled,
  });

  const style = dragEnabled && !isDragging
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
      }
    : undefined;

  return (
    <EditProfileChip
      profile={profile}
      isActive={isActive}
      onSelect={onSelect}
      onEdit={onEdit}
      interactiveHandle={dragEnabled}
      handleAttributes={attributes}
      handleListeners={listeners}
      setHandleRef={setActivatorNodeRef}
      isPlaceholder={dragEnabled && isDragging}
      style={style}
      chipRef={setNodeRef}
    />
  );
}

export function ProfileBar({
  compact = false,
  isInlineEditMode = false,
  editingProfileId,
  onEditingProfileChange,
  onCreateProfile,
  onEditProfile,
}: ProfileBarProps) {
  const profiles = useStore((s) => s.profiles);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const toggleSelectedProfile = useStore((s) => s.toggleSelectedProfile);
  const setProfilesOrder = useStore((s) => s.setProfilesOrder);

  const [activeDrag, setActiveDrag] = React.useState<DragState | null>(null);
  const [draftOrderIds, setDraftOrderIds] = React.useState<string[] | null>(null);
  const draftOrderIdsRef = React.useRef<string[] | null>(null);
  const lastOverIdRef = React.useRef<string | null>(null);
  const overlayPortalTarget =
    typeof document !== "undefined" ? document.body : null;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const orderedProfiles = React.useMemo(
    () => orderItemsByIds(profiles, draftOrderIds),
    [profiles, draftOrderIds]
  );
  const activeProfile = React.useMemo(
    () => orderedProfiles.find((profile) => profile.id === activeDrag?.id) ?? null,
    [orderedProfiles, activeDrag]
  );
  const selectedSet = new Set(selectedProfileIds);
  const dragEnabled = isInlineEditMode && profiles.length > 1;

  const resetDragState = React.useCallback(() => {
    setActiveDrag(null);
    setDraftOrderIds(null);
    draftOrderIdsRef.current = null;
    lastOverIdRef.current = null;
  }, []);

  React.useEffect(() => {
    if (!isInlineEditMode) {
      resetDragState();
    }
  }, [isInlineEditMode, resetDragState]);

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const nextIds = orderedProfiles.map((profile) => profile.id);
      setActiveDrag({
        id: String(event.active.id),
        width: event.active.rect.current.initial?.width ?? null,
      });
      lastOverIdRef.current = String(event.active.id);
      draftOrderIdsRef.current = nextIds;
      setDraftOrderIds(nextIds);
    },
    [orderedProfiles]
  );

  const handleDragOver = React.useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      lastOverIdRef.current = String(over.id);
      setDraftOrderIds((current) => {
        const base = current ?? orderedProfiles.map((profile) => profile.id);
        const oldIndex = base.indexOf(String(active.id));
        const newIndex = base.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return base;
        const next = arrayMove(base, oldIndex, newIndex);
        draftOrderIdsRef.current = next;
        return next;
      });
    },
    [orderedProfiles]
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const currentIds = profiles.map((profile) => profile.id);
      let nextIds = draftOrderIdsRef.current;
      const resolvedOverId =
        over?.id != null ? String(over.id) : lastOverIdRef.current;

      if (!nextIds && resolvedOverId && active.id !== resolvedOverId) {
        const oldIndex = currentIds.indexOf(String(active.id));
        const newIndex = currentIds.indexOf(resolvedOverId);
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          nextIds = arrayMove(currentIds, oldIndex, newIndex);
        }
      }

      if (resolvedOverId && nextIds && !arraysEqual(nextIds, currentIds)) {
        setProfilesOrder(nextIds);
      }

      resetDragState();
    },
    [profiles, resetDragState, setProfilesOrder]
  );

  if (profiles.length === 0 && !isInlineEditMode) {
    return null;
  }

  if (!isInlineEditMode) {
    return (
      <div
        className={`${compact ? "w-full min-h-8 justify-center" : "mb-2 min-h-8 justify-center"} flex flex-wrap items-center gap-1.5 sm:gap-2`}
      >
        {profiles.map((profile) => {
          const selected = selectedSet.has(profile.id);
          return (
            <button
              key={profile.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggleSelectedProfile(profile.id)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 py-1 text-[0.78rem] font-medium shadow-none transition-all ${MOTION_CLASS} ${
                selected
                  ? "border-foreground/10 bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.085] dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/14"
                  : "border-border/55 bg-background/70 text-foreground/72 hover:border-border/75 hover:bg-muted/35 hover:text-foreground dark:bg-background/45 dark:text-foreground/70 dark:hover:bg-accent/45"
              }`}
            >
              <ProfileIcon icon={profile.icon} size={12} className="shrink-0" />
              <span>{profile.name}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerAwareCollisionDetection}
      measuring={INLINE_SORTABLE_MEASURING}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={resetDragState}
    >
      <SortableContext
        items={orderedProfiles.map((profile) => profile.id)}
        strategy={rectSortingStrategy}
      >
        <div
          className={`${compact ? "w-full min-h-8 justify-center" : "mb-2 min-h-8 justify-center"} flex flex-wrap items-center gap-1.5 sm:gap-2`}
        >
          {orderedProfiles.map((profile) => (
            <SortableEditProfileChip
              key={profile.id}
              profile={profile}
              isActive={editingProfileId === profile.id}
              dragEnabled={dragEnabled}
              onSelect={() => onEditingProfileChange?.(profile.id)}
              onEdit={() => onEditProfile?.(profile.id)}
            />
          ))}

          <button
            type="button"
            onClick={onCreateProfile}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-border/70 bg-background px-3 text-[0.78rem] font-medium text-muted-foreground shadow-none transition-all ${MOTION_CLASS} hover:border-border/85 hover:bg-muted/28 hover:text-foreground`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Novo perfil</span>
          </button>
        </div>
      </SortableContext>

      {overlayPortalTarget
        ? createPortal(
            <DragOverlay
              modifiers={[preserveActivatorOffsetModifier]}
              zIndex={80}
            >
              {activeProfile ? (
                <EditProfileChip
                  profile={activeProfile}
                  isActive={editingProfileId === activeProfile.id}
                  isOverlay
                  style={{ width: activeDrag?.width ?? undefined }}
                />
              ) : null}
            </DragOverlay>,
            overlayPortalTarget
          )
        : null}
    </DndContext>
  );
}
