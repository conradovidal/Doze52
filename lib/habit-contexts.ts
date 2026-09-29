import { PROFILE_ICON_OPTIONS } from "./profile-icons";
import type { Habit, HabitContext, HabitContextIconId } from "./types";

// O contexto "Hábitos" existe para todo mundo desde o primeiro acesso, mas só
// vira registro (e sincroniza) quando a pessoa o edita ou cria um segundo
// contexto. Até lá é virtual: hábitos sem contextId moram nele. O id é fixo
// (e um UUID válido para o servidor) para que aparelhos diferentes falem do
// mesmo contexto padrão.
export const DEFAULT_HABIT_CONTEXT_ID = "00000000-0000-4000-8000-000000000001";
export const DEFAULT_HABIT_CONTEXT_NAME = "Hábitos";
export const DEFAULT_HABIT_CONTEXT_ICON: HabitContextIconId = "circle-check";
export const HABIT_CONTEXT_NAME_MAX_LENGTH = 28;

const DEFAULT_CONTEXT_CREATED_AT = "1970-01-01T00:00:00.000Z";

export const HABIT_CONTEXT_ICON_OPTIONS: ReadonlyArray<{
  id: HabitContextIconId;
  label: string;
}> = [{ id: "circle-check", label: "Hábitos" }, ...PROFILE_ICON_OPTIONS];

export const createDefaultHabitContext = (
  timestamp = DEFAULT_CONTEXT_CREATED_AT
): HabitContext => ({
  id: DEFAULT_HABIT_CONTEXT_ID,
  name: DEFAULT_HABIT_CONTEXT_NAME,
  icon: DEFAULT_HABIT_CONTEXT_ICON,
  position: 0,
  createdAt: timestamp,
  updatedAt: timestamp,
});

/** Contextos em ordem; sem nenhum registrado, só o "Hábitos" padrão. */
export const getHabitContexts = (contexts: HabitContext[]): HabitContext[] =>
  contexts.length
    ? contexts.toSorted(
        (left, right) =>
          left.position - right.position ||
          left.createdAt.localeCompare(right.createdAt) ||
          left.id.localeCompare(right.id)
      )
    : [createDefaultHabitContext()];

/**
 * Onde o hábito aparece. Hábito antigo (sem contextId) fica no padrão; se o
 * contexto dele sumiu (excluído em outro aparelho), cai no primeiro — nunca
 * fica órfão fora da tela.
 */
export const resolveHabitContextId = (
  habit: Pick<Habit, "contextId">,
  orderedContexts: HabitContext[]
) => {
  const id = habit.contextId ?? DEFAULT_HABIT_CONTEXT_ID;
  return orderedContexts.some((context) => context.id === id)
    ? id
    : (orderedContexts[0]?.id ?? DEFAULT_HABIT_CONTEXT_ID);
};

export const resolveSelectedHabitContextId = (
  selectedContextId: string | null,
  orderedContexts: HabitContext[]
) =>
  orderedContexts.some((context) => context.id === selectedContextId)
    ? (selectedContextId as string)
    : (orderedContexts[0]?.id ?? DEFAULT_HABIT_CONTEXT_ID);

export const filterHabitsByContext = <T extends Pick<Habit, "contextId">>(
  habits: T[],
  contextId: string,
  orderedContexts: HabitContext[]
) =>
  habits.filter(
    (habit) => resolveHabitContextId(habit, orderedContexts) === contextId
  );
