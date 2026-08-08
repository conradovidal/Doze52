import { expect, test } from "@playwright/test";

import { useStore } from "../../lib/store";
import type { CalendarEvent, CategoryItem } from "../../lib/types";

const profile = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Pessoal",
  color: "#64748B",
  icon: "user" as const,
  position: 0,
};

const sourceCategory: CategoryItem = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  profileId: profile.id,
  name: "Origem",
  color: "#2563EB",
  visible: true,
};

const destinationCategory: CategoryItem = {
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  profileId: profile.id,
  name: "Destino",
  color: "#DC2626",
  visible: true,
};

const sourceEvent: CalendarEvent = {
  id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  title: "Evento da origem",
  categoryId: sourceCategory.id,
  color: sourceCategory.color,
  startDate: "2026-08-08",
  endDate: "2026-08-08",
  createdAt: "2026-08-08T12:00:00.000Z",
  dayOrder: 0,
};

const resetStore = (categories: CategoryItem[]) => {
  useStore.setState({
    profiles: [profile],
    selectedProfileIds: [profile.id],
    categories,
    events: [sourceEvent],
  });
};

test("move os eventos para a categoria escolhida antes de excluir", () => {
  resetStore([sourceCategory, destinationCategory]);

  const deleted = useStore.getState().deleteCategory({
    categoryId: sourceCategory.id,
    strategy: { type: "move", targetCategoryId: destinationCategory.id },
  });

  expect(deleted).toBe(true);
  expect(useStore.getState().categories).toEqual([destinationCategory]);
  expect(useStore.getState().events[0]).toMatchObject({
    categoryId: destinationCategory.id,
    color: destinationCategory.color,
  });
});

test("exclui os eventos junto com a categoria quando solicitado", () => {
  resetStore([sourceCategory, destinationCategory]);

  const deleted = useStore.getState().deleteCategory({
    categoryId: sourceCategory.id,
    strategy: { type: "delete-events" },
  });

  expect(deleted).toBe(true);
  expect(useStore.getState().categories).toEqual([destinationCategory]);
  expect(useStore.getState().events).toHaveLength(0);
});

test("exclui uma categoria vazia sem alterar os demais eventos", () => {
  resetStore([sourceCategory, destinationCategory]);
  useStore.setState({ events: [] });

  const deleted = useStore.getState().deleteCategory({
    categoryId: sourceCategory.id,
    strategy: { type: "delete-events" },
  });

  expect(deleted).toBe(true);
  expect(useStore.getState().categories).toEqual([destinationCategory]);
  expect(useStore.getState().events).toHaveLength(0);
});

test("protege a última categoria comum mesmo quando existe calendário gerenciado", () => {
  const managedCategory: CategoryItem = {
    ...destinationCategory,
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    calendarPackGroupId: "formula-1-2026",
    calendarPackVariantId: "formula-1-2026",
    calendarPackCategoryKey: "formula-1",
    calendarPackVersion: 3,
  };
  resetStore([sourceCategory, managedCategory]);

  const deleted = useStore.getState().deleteCategory({
    categoryId: sourceCategory.id,
    strategy: { type: "delete-events" },
  });

  expect(deleted).toBe(false);
  expect(useStore.getState().categories).toHaveLength(2);
  expect(useStore.getState().events).toHaveLength(1);
});

test("recusa mover eventos para um calendário gerenciado", () => {
  const managedCategory: CategoryItem = {
    ...destinationCategory,
    id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    calendarPackGroupId: "formula-1-2026",
  };
  resetStore([sourceCategory, destinationCategory, managedCategory]);

  const deleted = useStore.getState().deleteCategory({
    categoryId: sourceCategory.id,
    strategy: { type: "move", targetCategoryId: managedCategory.id },
  });

  expect(deleted).toBe(false);
  expect(useStore.getState().events[0].categoryId).toBe(sourceCategory.id);
});
