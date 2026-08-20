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
import {
  PREMIUM_DROP_ANIMATION,
  PREMIUM_SORTABLE_TRANSITION,
  SORTABLE_ACCESSIBILITY,
} from "@/lib/sortable-motion";

const MOTION_CLASS = "duration-[160ms] ease-[cubic-bezier(0.22,1,0.36,1)]";
const CHIP_SHELL_CLASS =
  "group relative inline-flex h-8 items-center overflow-hidden rounded-[10px] border transition-[background-color,border-color,box-shadow,transform] shadow-none";
const CHIP_LEADING_SLOT_CLASS =
  "inline-flex h-8 w-7 shrink-0 items-center justify-center";
const READ_CHIP_LEADING_SLOT_CLASS =
  "inline-flex h-8 w-6 shrink-0 items-center justify-center";
const CHIP_HANDLE_CLASS =
  "inline-flex h-8 w-8 shrink-0 touch-none cursor-grab items-center justify-center rounded-[9px] transition-colors active:cursor-grabbing";
const CHIP_EDIT_ACTION_CLASS =
  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] transition-colors";
const CHIP_PLACEHOLDER_CLASS =
  "pointer-events-none absolute inset-[3px] rounded-[8px] border border-dashed border-border bg-muted/70";
const CHIP_OVERLAY_CLASS =
  "shadow-[0_18px_34px_-24px_rgba(15,23,42,0.36)]";
const CREATE_ACTION_CLASS = `inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-border bg-card text-foreground shadow-none transition-all ${MOTION_CLASS} hover:border-foreground/20 hover:bg-muted`;
const MOBILE_CHIP_LABEL_STYLE = {
  display: "-webkit-box",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 2,
  overflow: "hidden",
  overflowWrap: "anywhere",
} satisfies React.CSSProperties;
const MOBILE_CHIP_BUTTON_STYLE = {
  height: "2.5rem",
  minHeight: "2.5rem",
} satisfies React.CSSProperties;

type ProfileBarProps = {
  compact?: boolean;
  className?: string;
  mobileDense?: boolean;
  isInlineEditMode?: boolean;
  editingProfileId?: string | null;
  onEditingProfileChange?: (profileId: string) => void;
  onCreateProfile?: () => void;
  onEditProfile?: (profileId: string) => void;
  highlightedProfileId?: string | null;
};

type DragState = {
  id: string;
  width: number | null;
};

type SortableHandleAttributes = ReturnType<typeof useSortable>["attributes"];
type SortableHandleListeners = ReturnType<typeof useSortable>["listeners"];
type SortableHandleRef = ReturnType<typeof useSortable>["setActivatorNodeRef"];

function EditProfileChip({
  profile,
  isActive,
  onSelect,
  onEdit,
  mobileDense = false,
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
  mobileDense?: boolean;
  interactiveHandle?: boolean;
  handleAttributes?: SortableHandleAttributes;
  handleListeners?: SortableHandleListeners;
  setHandleRef?: SortableHandleRef;
  isPlaceholder?: boolean;
  isOverlay?: boolean;
  style?: React.CSSProperties;
  chipRef?: (node: HTMLElement | null) => void;
}) {
  const contentHiddenClass = isPlaceholder ? "invisible" : "";
  const utilityToneClass = isActive
    ? "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground"
    : "text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div
      data-premium-sortable
      ref={chipRef}
      style={style}
      className={cn(
        CHIP_SHELL_CLASS,
        mobileDense && "h-10 w-full rounded-[8px]",
        isPlaceholder
          ? "border-border bg-card text-muted-foreground"
          : isActive
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-foreground/78 hover:border-foreground/18 hover:bg-muted hover:text-foreground",
        isOverlay && CHIP_OVERLAY_CLASS,
        isPlaceholder && "shadow-none"
      )}
    >
      {isPlaceholder ? <div className={CHIP_PLACEHOLDER_CLASS} /> : null}

      {interactiveHandle ? (
        <button
          type="button"
          ref={setHandleRef}
          aria-label={`Reordenar contexto ${profile.name}`}
          title={`Reordenar contexto ${profile.name}`}
          className={cn(
            CHIP_HANDLE_CLASS,
            utilityToneClass,
            mobileDense && "h-10 w-8 rounded-[8px]",
            contentHiddenClass
          )}
          {...handleAttributes}
          {...handleListeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      ) : isOverlay || isPlaceholder ? (
        <span
          className={cn(
            CHIP_HANDLE_CLASS,
            "cursor-default",
            utilityToneClass,
            mobileDense && "h-10 w-8 rounded-[8px]",
            contentHiddenClass
          )}
          aria-hidden="true"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      ) : (
        <span className={cn(CHIP_LEADING_SLOT_CLASS, contentHiddenClass)} aria-hidden="true">
          <ProfileIcon icon={profile.icon} size={12} className="shrink-0" />
        </span>
      )}

      {isOverlay || isPlaceholder ? (
        <div
          className={cn(
            "flex min-w-0 flex-1 self-stretch items-center gap-1.5 pl-1 pr-2 text-[0.78rem] font-semibold",
            mobileDense && "text-left text-[0.74rem] leading-[0.84rem]",
            contentHiddenClass
          )}
        >
          <span
            className={mobileDense ? "min-w-0" : "truncate"}
            style={mobileDense ? MOBILE_CHIP_LABEL_STYLE : undefined}
          >
            {profile.name}
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          aria-label={`Selecionar contexto ${profile.name} para editar`}
          className={cn(
            "flex min-w-0 flex-1 self-stretch items-center gap-1.5 pl-1 pr-2 text-[0.78rem] font-semibold",
            mobileDense && "text-left text-[0.74rem] leading-[0.84rem]"
          )}
        >
          <span
            className={mobileDense ? "min-w-0" : "truncate"}
            style={mobileDense ? MOBILE_CHIP_LABEL_STYLE : undefined}
          >
            {profile.name}
          </span>
        </button>
      )}

      {isOverlay || isPlaceholder ? (
        <div className={cn("pr-1", contentHiddenClass)}>
          <span
            className={cn(
              CHIP_EDIT_ACTION_CLASS,
              utilityToneClass,
              mobileDense && "h-8 w-8"
            )}
          >
            <PencilLine className="h-3.5 w-3.5" />
          </span>
        </div>
      ) : onEdit ? (
        <div className="pr-1">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onEdit?.();
            }}
            aria-label={`Editar contexto ${profile.name}`}
            title={`Editar contexto ${profile.name}`}
            className={cn(
              CHIP_EDIT_ACTION_CLASS,
              utilityToneClass,
              mobileDense && "h-8 w-8"
            )}
          >
            <PencilLine className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="pr-1">
          <span
            className={cn(CHIP_EDIT_ACTION_CLASS, mobileDense && "h-8 w-8", "opacity-0")}
            aria-hidden="true"
          >
            <PencilLine className="h-3.5 w-3.5" />
          </span>
        </div>
      )}
    </div>
  );
}

function SortableEditProfileChip({
  profile,
  isActive,
  dragEnabled,
  mobileDense = false,
  onSelect,
  onEdit,
}: {
  profile: CalendarProfile;
  isActive: boolean;
  dragEnabled: boolean;
  mobileDense?: boolean;
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
    data: { sortableLabel: profile.name },
    transition: PREMIUM_SORTABLE_TRANSITION,
  });

  const style =
    dragEnabled && !isDragging
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
      mobileDense={mobileDense}
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
  className,
  mobileDense = false,
  isInlineEditMode = false,
  editingProfileId,
  onEditingProfileChange,
  onCreateProfile,
  onEditProfile,
  highlightedProfileId,
}: ProfileBarProps) {
  const profiles = useStore((s) => s.profiles);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const toggleSelectedProfile = useStore((s) => s.toggleSelectedProfile);
  const setProfilesOrder = useStore((s) => s.setProfilesOrder);

  const [activeDrag, setActiveDrag] = React.useState<DragState | null>(null);
  const [draftOrderIds, setDraftOrderIds] = React.useState<string[] | null>(null);
  const draftOrderIdsRef = React.useRef<string[] | null>(null);
  const lastOverIdRef = React.useRef<string | null>(null);
  const overlayPortalTarget = typeof document !== "undefined" ? document.body : null;

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
  const selectedSet = React.useMemo(() => new Set(selectedProfileIds), [selectedProfileIds]);
  const dragEnabled = isInlineEditMode && profiles.length > 1;
  const barClass = cn(
    mobileDense
      ? "contents"
      : compact
        ? "w-full min-h-8 justify-center"
        : "mb-2 min-h-8 justify-center",
    mobileDense ? "" : "flex flex-wrap items-center gap-1.5 sm:gap-2.5",
    className
  );

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
      <div className={barClass}>
        {profiles.map((profile) => {
          const selected = selectedSet.has(profile.id);
          return (
            <button
              key={profile.id}
              type="button"
              data-onboarding-profile-id={profile.id}
              data-onboarding-highlighted={
                highlightedProfileId === profile.id ? "true" : undefined
              }
              aria-pressed={selected}
              onClick={() => toggleSelectedProfile(profile.id)}
              title={profile.name}
              style={mobileDense ? MOBILE_CHIP_BUTTON_STYLE : undefined}
              className={cn(
                `inline-flex items-center overflow-hidden border text-[0.78rem] font-semibold shadow-none transition-[background-color,border-color,color,transform] ${MOTION_CLASS} active:translate-y-[1px]`,
                mobileDense
                  ? "h-10 w-full justify-start rounded-[8px] px-2 text-left"
                  : "h-8 rounded-[10px]",
                selected
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border-border bg-card text-foreground/72 hover:border-foreground/18 hover:bg-muted hover:text-foreground",
                highlightedProfileId === profile.id &&
                  "relative z-[46] ring-2 ring-primary ring-offset-2 ring-offset-background shadow-[0_0_0_7px_hsl(var(--primary)/0.12)] motion-safe:animate-[pulse_700ms_ease-in-out_2]"
              )}
            >
              <span
                className={cn(
                  mobileDense
                    ? "mr-1.5 inline-flex h-6 w-6 shrink-0 items-center justify-center"
                    : READ_CHIP_LEADING_SLOT_CLASS
                )}
                aria-hidden="true"
              >
                <ProfileIcon icon={profile.icon} size={12} className="shrink-0" />
              </span>
              <span
                className={cn(
                  "min-w-0",
                  mobileDense
                    ? "pr-1 text-left text-[0.74rem] leading-[0.84rem]"
                    : "truncate pr-2.5"
                )}
                style={mobileDense ? MOBILE_CHIP_LABEL_STYLE : undefined}
              >
                {profile.name}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <DndContext
      accessibility={SORTABLE_ACCESSIBILITY}
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
        <div className={barClass}>
          {orderedProfiles.map((profile) => (
            <SortableEditProfileChip
              key={profile.id}
              profile={profile}
              isActive={editingProfileId === profile.id}
              dragEnabled={dragEnabled}
              mobileDense={mobileDense}
              onSelect={() => onEditingProfileChange?.(profile.id)}
              onEdit={() => onEditProfile?.(profile.id)}
            />
          ))}

          <button
            type="button"
            onClick={onCreateProfile}
            className={cn(CREATE_ACTION_CLASS, mobileDense && "h-10 w-full rounded-[8px]")}
            aria-label="Criar novo contexto"
            title="Criar novo contexto"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </SortableContext>

      {overlayPortalTarget
        ? createPortal(
            <DragOverlay
              dropAnimation={PREMIUM_DROP_ANIMATION}
              modifiers={[preserveActivatorOffsetModifier]}
              zIndex={80}
            >
              {activeProfile ? (
                <EditProfileChip
                  profile={activeProfile}
                  isActive={editingProfileId === activeProfile.id}
                  mobileDense={mobileDense}
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
