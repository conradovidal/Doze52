"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type Modifier,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, GripVertical, Plus } from "lucide-react";
import { CategoryManager } from "@/components/category-manager";
import { ProfileIcon } from "@/components/profile-icon";
import { ProfileManager, type ProfileManagerIntent } from "@/components/profile-manager";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useStore } from "@/lib/store";
import type { CalendarProfile, CategoryItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const TAB_BASE_CLASS =
  "inline-flex min-h-8 items-center justify-center rounded-full px-3 py-1.5 text-sm font-medium transition-[background-color,color,box-shadow]";
const SECTION_CLASS = "space-y-3";
const LIST_CLASS =
  "overflow-hidden rounded-[1.1rem] border border-border/70 bg-background shadow-[inset_0_1px_0_rgba(255,255,255,0.82)]";
const ROW_CONTAINER_BASE_CLASS =
  "group relative flex items-stretch gap-0 border-b border-border/55 bg-background transition-[background-color,box-shadow,transform,border-color] last:border-b-0";
const ROW_BODY_BUTTON_CLASS =
  "flex min-w-0 flex-1 cursor-pointer items-center gap-3 px-3 py-3 text-left transition-[background-color,box-shadow,color] hover:bg-muted/28 focus-visible:bg-muted/34 focus-visible:ring-2 focus-visible:ring-ring/20 active:bg-muted/40";
const ROW_BODY_STATIC_CLASS = "flex min-w-0 flex-1 items-center gap-3 px-3 py-3 text-left";
const HANDLE_SLOT_CLASS = "hidden shrink-0 items-center justify-center px-3 sm:inline-flex";
const HANDLE_BUTTON_CLASS =
  "inline-flex h-9 w-9 cursor-grab items-center justify-center rounded-full text-muted-foreground/58 transition-[background-color,color,transform] hover:bg-muted/36 hover:text-foreground focus-visible:bg-muted/42 focus-visible:text-foreground active:cursor-grabbing active:scale-[0.98]";
const HANDLE_GHOST_CLASS =
  "inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground/50";
const MOBILE_REORDER_GROUP_CLASS = "flex shrink-0 items-center gap-0.5 px-2 sm:hidden";
const PLACEHOLDER_PANEL_CLASS =
  "pointer-events-none absolute inset-x-3 inset-y-2 rounded-[0.95rem] border border-dashed border-border/70 bg-muted/32";
const OVERLAY_ROW_CLASS =
  "overflow-hidden rounded-[1.05rem] border border-border/75 bg-background shadow-[0_22px_42px_-24px_rgba(15,23,42,0.34)]";
const DROP_ANIMATION = {
  duration: 180,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  sideEffects: null,
};
const DIALOG_DRAG_MEASURING = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};
const CURSOR_OVERLAY_OFFSET_X = 14;

const pointerAwareCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
};

function getEventCoordinates(event: Event | null) {
  if (!event) return null;

  if (
    "clientX" in event &&
    "clientY" in event &&
    typeof event.clientX === "number" &&
    typeof event.clientY === "number"
  ) {
    return { x: event.clientX, y: event.clientY };
  }

  if ("touches" in event) {
    const touchEvent = event as TouchEvent;

    if (touchEvent.touches.length > 0) {
      return {
        x: touchEvent.touches[0]?.clientX ?? 0,
        y: touchEvent.touches[0]?.clientY ?? 0,
      };
    }
  }

  if ("changedTouches" in event) {
    const touchEvent = event as TouchEvent;

    if (touchEvent.changedTouches.length > 0) {
    return {
        x: touchEvent.changedTouches[0]?.clientX ?? 0,
        y: touchEvent.changedTouches[0]?.clientY ?? 0,
      };
    };
  }

  return null;
}

const followCursorModifier: Modifier = ({
  activatorEvent,
  activeNodeRect,
  overlayNodeRect,
  transform,
}) => {
  const pointer = getEventCoordinates(activatorEvent);

  if (!pointer || !activeNodeRect) {
    return transform;
  }

  const currentPointerX = pointer.x + transform.x;
  const currentPointerY = pointer.y + transform.y;
  const overlayHeight = overlayNodeRect?.height ?? activeNodeRect.height;

  return {
    ...transform,
    x: currentPointerX - activeNodeRect.left + CURSOR_OVERLAY_OFFSET_X,
    y: currentPointerY - activeNodeRect.top - overlayHeight / 2,
  };
};

type OrganizeWorkspaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type DragState = {
  id: string;
  width: number | null;
};

type SortableHandleAttributes = ReturnType<typeof useSortable>["attributes"];
type SortableHandleListeners = ReturnType<typeof useSortable>["listeners"];
type SortableHandleRef = ReturnType<typeof useSortable>["setActivatorNodeRef"];

const arraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

const orderItemsByIds = <T extends { id: string }>(items: T[], orderedIds: string[] | null) => {
  if (!orderedIds || orderedIds.length === 0) return items;
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const ordered = orderedIds
    .map((id) => itemMap.get(id))
    .filter((item): item is T => Boolean(item));

  if (ordered.length === items.length) return ordered;

  const seen = new Set(ordered.map((item) => item.id));
  return [...ordered, ...items.filter((item) => !seen.has(item.id))];
};

const moveByStep = <T extends { id: string }>(items: T[], id: string, step: -1 | 1) => {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return items;
  const targetIndex = index + step;
  if (targetIndex < 0 || targetIndex >= items.length) return items;
  return arrayMove(items, index, targetIndex);
};

const applyProfileOrderToAll = (
  allCategories: CategoryItem[],
  profileId: string,
  orderedInProfile: CategoryItem[]
) => {
  let cursor = 0;
  return allCategories.map((category) => {
    if (category.profileId !== profileId) return category;
    const replacement = orderedInProfile[cursor] ?? category;
    cursor += 1;
    return replacement;
  });
};

function useDesktopDragEnabled() {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 640px) and (pointer: fine)");
    const sync = () => setEnabled(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return enabled;
}

function DesktopHandle({
  label,
  interactive = false,
  hidden = false,
  faded = false,
  attributes,
  listeners,
  setActivatorNodeRef,
}: {
  label: string;
  interactive?: boolean;
  hidden?: boolean;
  faded?: boolean;
  attributes?: SortableHandleAttributes;
  listeners?: SortableHandleListeners;
  setActivatorNodeRef?: SortableHandleRef;
}) {
  if (hidden) return null;

  return (
    <div className={cn(HANDLE_SLOT_CLASS, faded && "invisible")}>
      {interactive ? (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={HANDLE_BUTTON_CLASS}
          aria-label={label}
          title={label}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : (
        <span className={HANDLE_GHOST_CLASS} aria-hidden="true">
          <GripVertical className="h-4 w-4" />
        </span>
      )}
    </div>
  );
}

function ProfileRowVisual({
  profile,
  categoryCount,
  isSelected,
  onEdit,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
  showStepControls,
  interactiveHandle,
  handleAttributes,
  handleListeners,
  setHandleRef,
  isPlaceholder = false,
  isOverlay = false,
  style,
  rowRef,
}: {
  profile: CalendarProfile;
  categoryCount: number;
  isSelected: boolean;
  onEdit?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
  showStepControls?: boolean;
  interactiveHandle?: boolean;
  handleAttributes?: SortableHandleAttributes;
  handleListeners?: SortableHandleListeners;
  setHandleRef?: SortableHandleRef;
  isPlaceholder?: boolean;
  isOverlay?: boolean;
  style?: React.CSSProperties;
  rowRef?: (node: HTMLElement | null) => void;
}) {
  const BodyComp = isOverlay || isPlaceholder ? "div" : "button";
  const bodyProps =
    BodyComp === "button"
      ? {
          type: "button" as const,
          onClick: onEdit,
          "aria-label": `Editar perfil ${profile.name}`,
        }
      : {};

  return (
    <div
      ref={rowRef}
      style={style}
      className={cn(
        ROW_CONTAINER_BASE_CLASS,
        isOverlay && OVERLAY_ROW_CLASS,
        isPlaceholder && "bg-muted/14",
        !isOverlay && !isPlaceholder && "hover:bg-muted/10"
      )}
    >
      {isPlaceholder ? <div className={PLACEHOLDER_PANEL_CLASS} /> : null}

      <DesktopHandle
        label={`Reordenar perfil ${profile.name}`}
        interactive={Boolean(interactiveHandle)}
        hidden={!interactiveHandle && !isOverlay && !isPlaceholder}
        faded={isPlaceholder}
        attributes={handleAttributes}
        listeners={handleListeners}
        setActivatorNodeRef={setHandleRef}
      />

      <BodyComp
        {...bodyProps}
        className={cn(
          BodyComp === "button" ? ROW_BODY_BUTTON_CLASS : ROW_BODY_STATIC_CLASS,
          isPlaceholder && "invisible"
        )}
      >
        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] bg-muted/24 ring-1 ring-border/55">
          <ProfileIcon icon={profile.icon} size={18} />
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{profile.name}</p>
            {isSelected ? (
              <span className="rounded-full bg-muted/55 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                ativo
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {categoryCount} {categoryCount === 1 ? "categoria" : "categorias"}
          </p>
        </div>
      </BodyComp>

      {showStepControls ? (
        <div className={cn(MOBILE_REORDER_GROUP_CLASS, isPlaceholder && "invisible")}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 rounded-full text-muted-foreground/70 hover:bg-muted/45 hover:text-foreground"
            onClick={onMoveUp}
            disabled={disableMoveUp}
            aria-label={`Mover perfil ${profile.name} para cima`}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 rounded-full text-muted-foreground/70 hover:bg-muted/45 hover:text-foreground"
            onClick={onMoveDown}
            disabled={disableMoveDown}
            aria-label={`Mover perfil ${profile.name} para baixo`}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function CategoryRowVisual({
  category,
  onEdit,
  onMoveUp,
  onMoveDown,
  disableMoveUp,
  disableMoveDown,
  showStepControls,
  interactiveHandle,
  handleAttributes,
  handleListeners,
  setHandleRef,
  isPlaceholder = false,
  isOverlay = false,
  style,
  rowRef,
}: {
  category: CategoryItem;
  onEdit?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  disableMoveUp?: boolean;
  disableMoveDown?: boolean;
  showStepControls?: boolean;
  interactiveHandle?: boolean;
  handleAttributes?: SortableHandleAttributes;
  handleListeners?: SortableHandleListeners;
  setHandleRef?: SortableHandleRef;
  isPlaceholder?: boolean;
  isOverlay?: boolean;
  style?: React.CSSProperties;
  rowRef?: (node: HTMLElement | null) => void;
}) {
  const BodyComp = isOverlay || isPlaceholder ? "div" : "button";
  const bodyProps =
    BodyComp === "button"
      ? {
          type: "button" as const,
          onClick: onEdit,
          "aria-label": `Editar categoria ${category.name}`,
        }
      : {};

  return (
    <div
      ref={rowRef}
      style={style}
      className={cn(
        ROW_CONTAINER_BASE_CLASS,
        isOverlay && OVERLAY_ROW_CLASS,
        isPlaceholder && "bg-muted/14",
        !isOverlay && !isPlaceholder && "hover:bg-muted/10"
      )}
    >
      {isPlaceholder ? <div className={PLACEHOLDER_PANEL_CLASS} /> : null}

      <DesktopHandle
        label={`Reordenar categoria ${category.name}`}
        interactive={Boolean(interactiveHandle)}
        hidden={!interactiveHandle && !isOverlay && !isPlaceholder}
        faded={isPlaceholder}
        attributes={handleAttributes}
        listeners={handleListeners}
        setActivatorNodeRef={setHandleRef}
      />

      <BodyComp
        {...bodyProps}
        className={cn(
          BodyComp === "button" ? ROW_BODY_BUTTON_CLASS : ROW_BODY_STATIC_CLASS,
          isPlaceholder && "invisible"
        )}
      >
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/8"
          style={{ backgroundColor: category.color }}
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{category.name}</p>
        </div>
      </BodyComp>

      {showStepControls ? (
        <div className={cn(MOBILE_REORDER_GROUP_CLASS, isPlaceholder && "invisible")}>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 rounded-full text-muted-foreground/70 hover:bg-muted/45 hover:text-foreground"
            onClick={onMoveUp}
            disabled={disableMoveUp}
            aria-label={`Mover categoria ${category.name} para cima`}
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="h-8 w-8 rounded-full text-muted-foreground/70 hover:bg-muted/45 hover:text-foreground"
            onClick={onMoveDown}
            disabled={disableMoveDown}
            aria-label={`Mover categoria ${category.name} para baixo`}
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SortableProfileRow({
  profile,
  categoryCount,
  isSelected,
  index,
  total,
  dragEnabled,
  onEdit,
  onMoveUp,
  onMoveDown,
}: {
  profile: CalendarProfile;
  categoryCount: number;
  isSelected: boolean;
  index: number;
  total: number;
  dragEnabled: boolean;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
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

  const style = dragEnabled
    ? !isDragging
      ? {
        transform: CSS.Transform.toString(transform),
        transition,
      }
      : undefined
    : undefined;

  return (
    <ProfileRowVisual
      profile={profile}
      categoryCount={categoryCount}
      isSelected={isSelected}
      onEdit={onEdit}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      disableMoveUp={index === 0}
      disableMoveDown={index === total - 1}
      showStepControls={!dragEnabled}
      interactiveHandle={dragEnabled}
      handleAttributes={attributes}
      handleListeners={listeners}
      setHandleRef={setActivatorNodeRef}
      isPlaceholder={dragEnabled && isDragging}
      style={style}
      rowRef={setNodeRef}
    />
  );
}

function SortableCategoryRow({
  category,
  index,
  total,
  dragEnabled,
  onEdit,
  onMoveUp,
  onMoveDown,
}: {
  category: CategoryItem;
  index: number;
  total: number;
  dragEnabled: boolean;
  onEdit: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
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
    id: category.id,
    disabled: !dragEnabled,
  });

  const style = dragEnabled
    ? !isDragging
      ? {
        transform: CSS.Transform.toString(transform),
        transition,
      }
      : undefined
    : undefined;

  return (
    <CategoryRowVisual
      category={category}
      onEdit={onEdit}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      disableMoveUp={index === 0}
      disableMoveDown={index === total - 1}
      showStepControls={!dragEnabled}
      interactiveHandle={dragEnabled}
      handleAttributes={attributes}
      handleListeners={listeners}
      setHandleRef={setActivatorNodeRef}
      isPlaceholder={dragEnabled && isDragging}
      style={style}
      rowRef={setNodeRef}
    />
  );
}

export function OrganizeWorkspaceDialog({
  open,
  onOpenChange,
}: OrganizeWorkspaceDialogProps) {
  const profiles = useStore((s) => s.profiles);
  const categories = useStore((s) => s.categories);
  const selectedProfileIds = useStore((s) => s.selectedProfileIds);
  const setProfilesOrder = useStore((s) => s.setProfilesOrder);
  const setCategoriesOrder = useStore((s) => s.setCategoriesOrder);

  const [activeTab, setActiveTab] = React.useState<"profiles" | "categories">("profiles");
  const [categoryProfileId, setCategoryProfileId] = React.useState("");
  const [activeProfileDrag, setActiveProfileDrag] = React.useState<DragState | null>(null);
  const [activeCategoryDrag, setActiveCategoryDrag] = React.useState<DragState | null>(null);
  const [draftProfileOrderIds, setDraftProfileOrderIds] = React.useState<string[] | null>(null);
  const [draftCategoryOrderIds, setDraftCategoryOrderIds] = React.useState<string[] | null>(null);
  const draftProfileOrderIdsRef = React.useRef<string[] | null>(null);
  const draftCategoryOrderIdsRef = React.useRef<string[] | null>(null);
  const [profileManagerOpen, setProfileManagerOpen] = React.useState(false);
  const [profileManagerIntent, setProfileManagerIntent] = React.useState<ProfileManagerIntent | null>(
    null
  );
  const [categoryCreateOpen, setCategoryCreateOpen] = React.useState(false);
  const [categoryEditOpen, setCategoryEditOpen] = React.useState(false);
  const [editingCategoryId, setEditingCategoryId] = React.useState<string | null>(null);

  const isDesktopDragEnabled = useDesktopDragEnabled();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const resetProfileDragState = React.useCallback(() => {
    setActiveProfileDrag(null);
    draftProfileOrderIdsRef.current = null;
    setDraftProfileOrderIds(null);
  }, []);

  const resetCategoryDragState = React.useCallback(() => {
    setActiveCategoryDrag(null);
    draftCategoryOrderIdsRef.current = null;
    setDraftCategoryOrderIds(null);
  }, []);

  const resetAllDragState = React.useCallback(() => {
    resetProfileDragState();
    resetCategoryDragState();
  }, [resetCategoryDragState, resetProfileDragState]);

  React.useEffect(() => {
    if (!open) return;
    const preferredProfileId =
      selectedProfileIds.find((id) => profiles.some((profile) => profile.id === id)) ??
      profiles[0]?.id ??
      "";

    setCategoryProfileId((current) => {
      if (current && profiles.some((profile) => profile.id === current)) return current;
      return preferredProfileId;
    });
  }, [open, profiles, selectedProfileIds]);

  React.useEffect(() => {
    if (!open) {
      resetAllDragState();
    }
  }, [open, resetAllDragState]);

  React.useEffect(() => {
    resetAllDragState();
  }, [activeTab, resetAllDragState]);

  const categoriesForProfile = React.useMemo(
    () => categories.filter((category) => category.profileId === categoryProfileId),
    [categories, categoryProfileId]
  );

  React.useEffect(() => {
    resetCategoryDragState();
  }, [categoryProfileId, resetCategoryDragState]);

  const orderedProfiles = React.useMemo(
    () => orderItemsByIds(profiles, draftProfileOrderIds),
    [profiles, draftProfileOrderIds]
  );
  const orderedCategoriesForProfile = React.useMemo(
    () => orderItemsByIds(categoriesForProfile, draftCategoryOrderIds),
    [categoriesForProfile, draftCategoryOrderIds]
  );

  const activeProfile = React.useMemo(
    () => orderedProfiles.find((profile) => profile.id === activeProfileDrag?.id) ?? null,
    [orderedProfiles, activeProfileDrag]
  );
  const activeProfileCategoryCount = React.useMemo(
    () =>
      activeProfile
        ? categories.filter((category) => category.profileId === activeProfile.id).length
        : 0,
    [activeProfile, categories]
  );
  const activeCategory = React.useMemo(
    () =>
      orderedCategoriesForProfile.find((category) => category.id === activeCategoryDrag?.id) ??
      null,
    [orderedCategoriesForProfile, activeCategoryDrag]
  );

  const openCreateProfile = () => {
    setProfileManagerIntent({ mode: "create" });
    setProfileManagerOpen(true);
  };

  const openEditProfile = (profileId: string) => {
    setProfileManagerIntent({ mode: "edit", profileId });
    setProfileManagerOpen(true);
  };

  const openEditCategory = (categoryId: string) => {
    setEditingCategoryId(categoryId);
    setCategoryEditOpen(true);
  };

  const moveProfileStep = React.useCallback(
    (profileId: string, step: -1 | 1) => {
      const next = moveByStep(profiles, profileId, step);
      if (next === profiles) return;
      setProfilesOrder(next.map((profile) => profile.id));
    },
    [profiles, setProfilesOrder]
  );

  const moveCategoryStep = React.useCallback(
    (categoryId: string, step: -1 | 1) => {
      if (!categoryProfileId) return;
      const nextProfileCategories = moveByStep(categoriesForProfile, categoryId, step);
      if (nextProfileCategories === categoriesForProfile) return;
      const fullOrder = applyProfileOrderToAll(categories, categoryProfileId, nextProfileCategories);
      setCategoriesOrder(fullOrder.map((category) => category.id));
    },
    [categories, categoriesForProfile, categoryProfileId, setCategoriesOrder]
  );

  const handleProfilesDragStart = React.useCallback((event: DragStartEvent) => {
    const nextIds = orderedProfiles.map((profile) => profile.id);
    setActiveProfileDrag({
      id: String(event.active.id),
      width: event.active.rect.current.initial?.width ?? null,
    });
    draftProfileOrderIdsRef.current = nextIds;
    setDraftProfileOrderIds(nextIds);
  }, [orderedProfiles]);

  const handleProfilesDragOver = React.useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setDraftProfileOrderIds((current) => {
        const base = current ?? orderedProfiles.map((profile) => profile.id);
        const oldIndex = base.indexOf(String(active.id));
        const newIndex = base.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return base;
        const next = arrayMove(base, oldIndex, newIndex);
        draftProfileOrderIdsRef.current = next;
        return next;
      });
    },
    [orderedProfiles]
  );

  const handleProfilesDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const currentIds = profiles.map((profile) => profile.id);
      let nextIds = draftProfileOrderIdsRef.current;

      if (!nextIds && over && active.id !== over.id) {
        const oldIndex = currentIds.indexOf(String(active.id));
        const newIndex = currentIds.indexOf(String(over.id));
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          nextIds = arrayMove(currentIds, oldIndex, newIndex);
        }
      }

      if (over && nextIds && !arraysEqual(nextIds, currentIds)) {
        setProfilesOrder(nextIds);
      }

      resetProfileDragState();
    },
    [profiles, resetProfileDragState, setProfilesOrder]
  );

  const handleCategoriesDragStart = React.useCallback((event: DragStartEvent) => {
    const nextIds = orderedCategoriesForProfile.map((category) => category.id);
    setActiveCategoryDrag({
      id: String(event.active.id),
      width: event.active.rect.current.initial?.width ?? null,
    });
    draftCategoryOrderIdsRef.current = nextIds;
    setDraftCategoryOrderIds(nextIds);
  }, [orderedCategoriesForProfile]);

  const handleCategoriesDragOver = React.useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setDraftCategoryOrderIds((current) => {
        const base =
          current ?? orderedCategoriesForProfile.map((category) => category.id);
        const oldIndex = base.indexOf(String(active.id));
        const newIndex = base.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return base;
        const next = arrayMove(base, oldIndex, newIndex);
        draftCategoryOrderIdsRef.current = next;
        return next;
      });
    },
    [orderedCategoriesForProfile]
  );

  const handleCategoriesDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!categoryProfileId) {
        resetCategoryDragState();
        return;
      }

      const currentIds = categoriesForProfile.map((category) => category.id);
      let nextIds = draftCategoryOrderIdsRef.current;

      if (!nextIds && over && active.id !== over.id) {
        const oldIndex = currentIds.indexOf(String(active.id));
        const newIndex = currentIds.indexOf(String(over.id));
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          nextIds = arrayMove(currentIds, oldIndex, newIndex);
        }
      }

      if (over && nextIds && !arraysEqual(nextIds, currentIds)) {
        const nextProfileCategories = orderItemsByIds(categoriesForProfile, nextIds);
        const fullOrder = applyProfileOrderToAll(
          categories,
          categoryProfileId,
          nextProfileCategories
        );
        setCategoriesOrder(fullOrder.map((category) => category.id));
      }

      resetCategoryDragState();
    },
    [
      categories,
      categoriesForProfile,
      categoryProfileId,
      resetCategoryDragState,
      setCategoriesOrder,
    ]
  );

  const handleDragCancel = React.useCallback(() => {
    resetAllDragState();
  }, [resetAllDragState]);

  const overlayPortalTarget =
    typeof document !== "undefined" ? document.body : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="top-auto bottom-2 max-h-[calc(100dvh-0.5rem)] w-[calc(100%-1rem)] max-w-[calc(100%-1rem)] translate-y-0 overflow-hidden rounded-[1.85rem] border border-border/80 bg-background px-0 pb-0 pt-0 shadow-[0_28px_70px_-34px_rgba(15,23,42,0.28)] sm:top-1/2 sm:bottom-auto sm:w-full sm:max-w-[780px] sm:-translate-y-1/2 sm:px-0 sm:pb-0">
          <div className="sticky top-0 z-10 border-b border-border/60 bg-background px-5 pb-4 pt-5 backdrop-blur sm:px-6">
            <DialogHeader>
              <DialogTitle>Organizar workspace</DialogTitle>
            </DialogHeader>

            <div className="mt-4 inline-flex rounded-full border border-border/70 bg-muted/35 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("profiles")}
                aria-pressed={activeTab === "profiles"}
                className={`${TAB_BASE_CLASS} ${
                  activeTab === "profiles"
                    ? "bg-background text-foreground ring-1 ring-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Perfis
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("categories")}
                aria-pressed={activeTab === "categories"}
                className={`${TAB_BASE_CLASS} ${
                  activeTab === "categories"
                    ? "bg-background text-foreground ring-1 ring-border/70 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Categorias
              </button>
            </div>
          </div>

          <div className="max-h-[calc(100dvh-11rem)] overflow-y-auto px-5 pb-5 pt-4 sm:max-h-[33rem] sm:px-6 sm:pb-6">
            {activeTab === "profiles" ? (
              <section className={SECTION_CLASS}>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full border-border/65 bg-background px-3.5 shadow-none hover:bg-muted/28"
                    onClick={openCreateProfile}
                  >
                    <Plus className="h-4 w-4" />
                    Novo perfil
                  </Button>
                </div>

                <DndContext
                  sensors={isDesktopDragEnabled ? sensors : []}
                  collisionDetection={pointerAwareCollisionDetection}
                  measuring={DIALOG_DRAG_MEASURING}
                  onDragStart={handleProfilesDragStart}
                  onDragOver={handleProfilesDragOver}
                  onDragEnd={handleProfilesDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  <SortableContext
                    items={orderedProfiles.map((profile) => profile.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className={LIST_CLASS}>
                      {orderedProfiles.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          Nenhum perfil ainda.
                        </div>
                      ) : (
                        orderedProfiles.map((profile, index) => {
                          const categoryCount = categories.filter(
                            (category) => category.profileId === profile.id
                          ).length;

                          return (
                            <SortableProfileRow
                              key={profile.id}
                              profile={profile}
                              categoryCount={categoryCount}
                              isSelected={selectedProfileIds.includes(profile.id)}
                              index={index}
                              total={orderedProfiles.length}
                              dragEnabled={isDesktopDragEnabled}
                              onEdit={() => openEditProfile(profile.id)}
                              onMoveUp={() => moveProfileStep(profile.id, -1)}
                              onMoveDown={() => moveProfileStep(profile.id, 1)}
                            />
                          );
                        })
                      )}
                    </div>
                  </SortableContext>

                  {overlayPortalTarget
                    ? createPortal(
                        <DragOverlay
                          dropAnimation={DROP_ANIMATION}
                          modifiers={isDesktopDragEnabled ? [followCursorModifier] : undefined}
                          zIndex={80}
                        >
                          {activeProfile ? (
                            <ProfileRowVisual
                              profile={activeProfile}
                              categoryCount={activeProfileCategoryCount}
                              isSelected={selectedProfileIds.includes(activeProfile.id)}
                              isOverlay
                              style={{
                                width: activeProfileDrag?.width ?? undefined,
                              }}
                            />
                          ) : null}
                        </DragOverlay>,
                        overlayPortalTarget
                      )
                    : null}
                </DndContext>
              </section>
            ) : (
              <section className={SECTION_CLASS}>
                <div className="flex flex-col gap-2 sm:min-w-[260px] sm:flex-row sm:items-center sm:justify-end">
                  <Select value={categoryProfileId} onValueChange={setCategoryProfileId}>
                    <SelectTrigger className="h-9 rounded-full border-border/65 bg-background/80 px-3 shadow-none sm:min-w-[220px]">
                      <span className="truncate">
                        {profiles.find((profile) => profile.id === categoryProfileId)?.name ??
                          "Perfil"}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {profiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          <span className="inline-flex items-center gap-2">
                            <ProfileIcon icon={profile.icon} size={12} />
                            {profile.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-full border-border/65 bg-background px-3.5 shadow-none hover:bg-muted/28"
                    disabled={!categoryProfileId}
                    onClick={() => setCategoryCreateOpen(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Nova categoria
                  </Button>
                </div>

                <DndContext
                  sensors={isDesktopDragEnabled ? sensors : []}
                  collisionDetection={pointerAwareCollisionDetection}
                  measuring={DIALOG_DRAG_MEASURING}
                  onDragStart={handleCategoriesDragStart}
                  onDragOver={handleCategoriesDragOver}
                  onDragEnd={handleCategoriesDragEnd}
                  onDragCancel={handleDragCancel}
                >
                  <SortableContext
                    items={orderedCategoriesForProfile.map((category) => category.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className={LIST_CLASS}>
                      {!categoryProfileId ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          Crie um perfil primeiro.
                        </div>
                      ) : orderedCategoriesForProfile.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                          Nenhuma categoria nesse perfil.
                        </div>
                      ) : (
                        orderedCategoriesForProfile.map((category, index) => (
                          <SortableCategoryRow
                            key={category.id}
                            category={category}
                            index={index}
                            total={orderedCategoriesForProfile.length}
                            dragEnabled={isDesktopDragEnabled}
                            onEdit={() => openEditCategory(category.id)}
                            onMoveUp={() => moveCategoryStep(category.id, -1)}
                            onMoveDown={() => moveCategoryStep(category.id, 1)}
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>

                  {overlayPortalTarget
                    ? createPortal(
                        <DragOverlay
                          dropAnimation={DROP_ANIMATION}
                          modifiers={isDesktopDragEnabled ? [followCursorModifier] : undefined}
                          zIndex={80}
                        >
                          {activeCategory ? (
                            <CategoryRowVisual
                              category={activeCategory}
                              isOverlay
                              style={{
                                width: activeCategoryDrag?.width ?? undefined,
                              }}
                            />
                          ) : null}
                        </DragOverlay>,
                        overlayPortalTarget
                      )
                    : null}
                </DndContext>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ProfileManager
        open={profileManagerOpen}
        onOpenChange={(nextOpen) => {
          setProfileManagerOpen(nextOpen);
          if (!nextOpen) {
            setProfileManagerIntent(null);
          }
        }}
        intent={profileManagerIntent ?? undefined}
      />

      <CategoryManager
        mode="create"
        open={categoryCreateOpen}
        onOpenChange={setCategoryCreateOpen}
        profileId={categoryProfileId || undefined}
      />

      <CategoryManager
        mode="edit"
        open={categoryEditOpen}
        onOpenChange={(nextOpen) => {
          setCategoryEditOpen(nextOpen);
          if (!nextOpen) {
            setEditingCategoryId(null);
          }
        }}
        categoryId={editingCategoryId ?? undefined}
      />
    </>
  );
}
