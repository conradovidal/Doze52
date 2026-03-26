"use client";

import {
  closestCenter,
  MeasuringStrategy,
  pointerWithin,
  type CollisionDetection,
  type Modifier,
} from "@dnd-kit/core";

export const INLINE_SORTABLE_MEASURING = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

export const pointerAwareCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
};

export const arraysEqual = (left: string[], right: string[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);

export const orderItemsByIds = <T extends { id: string }>(
  items: T[],
  orderedIds: string[] | null
) => {
  if (!orderedIds || orderedIds.length === 0) return items;

  const itemMap = new Map(items.map((item) => [item.id, item]));
  const ordered = orderedIds
    .map((id) => itemMap.get(id))
    .filter((item): item is T => Boolean(item));

  if (ordered.length === items.length) return ordered;

  const seen = new Set(ordered.map((item) => item.id));
  return [...ordered, ...items.filter((item) => !seen.has(item.id))];
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
    }
  }

  return null;
}

export const preserveActivatorOffsetModifier: Modifier = ({
  activatorEvent,
  activeNodeRect,
  overlayNodeRect,
  transform,
}) => {
  const pointer = getEventCoordinates(activatorEvent);

  if (!pointer || !activeNodeRect || !overlayNodeRect) {
    return transform;
  }

  const relativePointerX =
    activeNodeRect.width > 0 ? (pointer.x - activeNodeRect.left) / activeNodeRect.width : 0;
  const relativePointerY =
    activeNodeRect.height > 0 ? (pointer.y - activeNodeRect.top) / activeNodeRect.height : 0;

  return {
    ...transform,
    x:
      transform.x +
      (activeNodeRect.width - overlayNodeRect.width) *
        Math.min(Math.max(relativePointerX, 0), 1),
    y:
      transform.y +
      (activeNodeRect.height - overlayNodeRect.height) *
        Math.min(Math.max(relativePointerY, 0), 1),
  };
};
