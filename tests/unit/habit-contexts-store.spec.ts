import { expect, test } from "@playwright/test";

import { DEFAULT_HABIT_CONTEXT_ID, getHabitContexts } from "../../lib/habit-contexts";
import { useHabitsStore } from "../../lib/habits-store";

const reset = () =>
  useHabitsStore.setState({
    habits: [],
    checkIns: {},
    contexts: [],
    selectedContextId: null,
    selectedHabitId: null,
    visibleHabitIds: [],
  });

test.beforeEach(reset);

test("o padrão vira registro só quando ganha um vizinho", () => {
  const store = useHabitsStore.getState();
  const lerId = store.createHabit({ name: "Ler", color: "#2563eb" });
  expect(useHabitsStore.getState().contexts).toEqual([]);
  expect(useHabitsStore.getState().habits[0].contextId).toBe(DEFAULT_HABIT_CONTEXT_ID);

  const saudeId = store.createContext({ name: "Saúde", icon: "heart" });
  const state = useHabitsStore.getState();
  expect(getHabitContexts(state.contexts).map((context) => context.name)).toEqual([
    "Hábitos",
    "Saúde",
  ]);
  expect(state.selectedContextId).toBe(saudeId);

  // Novo hábito nasce no contexto selecionado; o antigo continua onde estava.
  const treinoId = store.createHabit({ name: "Treinar", color: "#16a34a" });
  const habits = useHabitsStore.getState().habits;
  expect(habits.find((habit) => habit.id === treinoId)?.contextId).toBe(saudeId);
  expect(habits.find((habit) => habit.id === lerId)?.contextId).toBe(DEFAULT_HABIT_CONTEXT_ID);
});

test("renomear o padrão o grava sem perder os hábitos dele", () => {
  const store = useHabitsStore.getState();
  store.createHabit({ name: "Ler", color: "#2563eb" });
  store.updateContext(DEFAULT_HABIT_CONTEXT_ID, { name: "Rotina", icon: "circle-check" });
  const state = useHabitsStore.getState();
  expect(state.contexts.map((context) => [context.id, context.name])).toEqual([
    [DEFAULT_HABIT_CONTEXT_ID, "Rotina"],
  ]);
});

test("mover hábito entre contextos pelo editor", () => {
  const store = useHabitsStore.getState();
  const lerId = store.createHabit({ name: "Ler", color: "#2563eb" });
  const saudeId = store.createContext({ name: "Saúde", icon: "heart" });
  store.updateHabit(lerId, { name: "Ler", color: "#2563eb", contextId: saudeId });
  expect(useHabitsStore.getState().habits[0].contextId).toBe(saudeId);
});

test("excluir contexto move ou apaga os hábitos, e o desfazer devolve tudo", () => {
  const store = useHabitsStore.getState();
  const saudeId = store.createContext({ name: "Saúde", icon: "heart" });
  const treinoId = store.createHabit({ name: "Treinar", color: "#16a34a" });
  store.toggleHabitCheckIn(treinoId, "2026-09-28");
  const before = useHabitsStore.getState();
  const context = before.contexts.find((entry) => entry.id === saudeId)!;
  const habits = before.habits.filter((habit) => habit.id === treinoId);
  const checkIns = Object.values(before.checkIns);

  store.deleteContext(saudeId, DEFAULT_HABIT_CONTEXT_ID);
  let state = useHabitsStore.getState();
  expect(state.contexts.map((entry) => entry.id)).toEqual([DEFAULT_HABIT_CONTEXT_ID]);
  expect(state.habits[0].contextId).toBe(DEFAULT_HABIT_CONTEXT_ID);
  expect(Object.keys(state.checkIns)).toHaveLength(1);
  expect(state.selectedContextId).toBe(DEFAULT_HABIT_CONTEXT_ID);

  store.restoreContext(context, habits, checkIns);
  state = useHabitsStore.getState();
  expect(state.contexts.map((entry) => entry.id)).toContain(saudeId);
  expect(state.habits[0].contextId).toBe(saudeId);

  store.deleteContext(saudeId, null);
  state = useHabitsStore.getState();
  expect(state.habits).toEqual([]);
  expect(state.checkIns).toEqual({});
});

test("não exclui o último contexto", () => {
  const store = useHabitsStore.getState();
  store.createHabit({ name: "Ler", color: "#2563eb" });
  store.deleteContext(DEFAULT_HABIT_CONTEXT_ID, null);
  expect(useHabitsStore.getState().habits).toHaveLength(1);
});
