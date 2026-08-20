import type {
  Announcements,
  DropAnimation,
  ScreenReaderInstructions,
} from "@dnd-kit/core";

const getItemLabel = (item: { id: string | number; data: { current?: Record<string, unknown> } }) => {
  const label = item.data.current?.sortableLabel;
  return typeof label === "string" ? label : String(item.id);
};

export const PREMIUM_SORTABLE_TRANSITION = {
  duration: 180,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
};

export const PREMIUM_DROP_ANIMATION: DropAnimation = {
  duration: 180,
  easing: "cubic-bezier(0.22, 1, 0.36, 1)",
  sideEffects: null,
};

export const SORTABLE_SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "Para mover, pressione Espaço. Use as setas para escolher a posição. Pressione Espaço novamente para soltar ou Escape para cancelar.",
};

export const SORTABLE_ANNOUNCEMENTS: Announcements = {
  onDragStart({ active }) {
    return `${getItemLabel(active)} selecionado para mover.`;
  },
  onDragOver({ active, over }) {
    return over
      ? `${getItemLabel(active)} está sobre ${getItemLabel(over)}.`
      : `${getItemLabel(active)} saiu da área de ordenação.`;
  },
  onDragEnd({ active, over }) {
    return over
      ? `${getItemLabel(active)} foi movido para a posição de ${getItemLabel(over)}.`
      : `Movimento de ${getItemLabel(active)} cancelado.`;
  },
  onDragCancel({ active }) {
    return `Movimento de ${getItemLabel(active)} cancelado. A ordem anterior foi restaurada.`;
  },
};

export const SORTABLE_ACCESSIBILITY = {
  announcements: SORTABLE_ANNOUNCEMENTS,
  screenReaderInstructions: SORTABLE_SCREEN_READER_INSTRUCTIONS,
};
