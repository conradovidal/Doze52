import type { OfficialCalendarEvent, CandidateValidationIssue } from "./types";

const participants = (event: OfficialCalendarEvent) =>
  `${event.homeTeamId ?? event.homeTeam}|${event.awayTeamId ?? event.awayTeam}`;

export const validateOfficialCandidate = ({
  previous,
  candidate,
}: {
  previous: readonly OfficialCalendarEvent[];
  candidate: readonly OfficialCalendarEvent[];
}): CandidateValidationIssue[] => {
  const issues: CandidateValidationIssue[] = [];
  if (candidate.length === 0) {
    return [{ code: "empty_source", message: "A fonte oficial retornou zero eventos." }];
  }

  const candidateIds = new Set<string>();
  for (const event of candidate) {
    if (!event.externalId || !event.date || !event.homeTeam || !event.awayTeam) {
      issues.push({
        code: "invalid_shape",
        message: "Evento oficial sem ID, data ou participantes.",
        eventId: event.externalId,
      });
    }
    if (candidateIds.has(event.externalId)) {
      issues.push({
        code: "external_id_reused",
        message: "A fonte reutilizou um ID dentro da mesma carga.",
        eventId: event.externalId,
      });
    }
    candidateIds.add(event.externalId);
  }

  const previousById = new Map(previous.map((event) => [event.externalId, event]));
  const removedCount = previous.filter((event) => !candidateIds.has(event.externalId)).length;
  if (
    previous.length > 0 &&
    removedCount > 2 &&
    removedCount / previous.length > 0.05
  ) {
    issues.push({
      code: "excessive_removal",
      message: `A fonte removeu ${removedCount} eventos (${Math.round(
        (removedCount / previous.length) * 100
      )}%).`,
    });
  }

  for (const event of candidate) {
    const oldEvent = previousById.get(event.externalId);
    if (
      oldEvent &&
      !oldEvent.placeholder &&
      participants(oldEvent) !== participants(event)
    ) {
      issues.push({
        code: "external_id_reused",
        message: "O ID oficial passou a apontar para outra partida.",
        eventId: event.externalId,
      });
      issues.push({
        code: "participants_changed",
        message: "Participantes alterados em evento que não era placeholder.",
        eventId: event.externalId,
      });
    }
  }
  return issues;
};
