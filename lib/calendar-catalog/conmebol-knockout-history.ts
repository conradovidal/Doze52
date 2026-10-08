import { conmebolEvent } from "./parsers";
import type { CalendarCatalogSource, OfficialCalendarEvent } from "./types";

// Quartas de final de 2026, já disputadas. A CONMEBOL publicou cada fase em
// matérias com formatos diferentes (e as quartas da Libertadores só trazem as
// idas), sem uma página estável para raspar. Como jogo encerrado não muda de
// data nem de sede, ele vive aqui, conferido nas páginas oficiais, em vez de
// depender de um parser frágil — e as semifinais em diante seguem raspadas.
// Horários são os locais da sede, como a CONMEBOL os divulga.
const QUARTERFINALS_PHASE = "Quartas de final";

type Row = readonly [
  date: string, time: string, home: string, away: string, venue: string, city: string,
];

const QUARTERFINALS: Record<string, readonly Row[]> = {
  "conmebol-libertadores-2026": [
    ["2026-09-08", "19:00", "Fluminense", "Platense", "Estádio Maracanã", "Rio de Janeiro"],
    ["2026-09-09", "19:00", "Palmeiras", "L.D.U. Quito", "Estádio Nubank Parque", "São Paulo"],
    ["2026-09-09", "21:30", "Estudiantes", "Corinthians", "Estádio UNO Jorge Luis Hirschi", "La Plata"],
    ["2026-09-10", "19:30", "Independiente del Valle", "Flamengo", "Estádio Olímpico Atahualpa", "Quito"],
    ["2026-09-15", "19:00", "Platense", "Fluminense", "Estádio Ciudad de Vicente López", "Vicente López"],
    ["2026-09-16", "19:00", "L.D.U. Quito", "Palmeiras", "Estádio Rodrigo Paz Delgado", "Quito"],
    ["2026-09-16", "21:30", "Corinthians", "Estudiantes", "Neo Química Arena", "São Paulo"],
    ["2026-09-17", "21:30", "Flamengo", "Independiente del Valle", "Estádio Maracanã", "Rio de Janeiro"],
  ],
  "conmebol-sudamericana-2026": [
    ["2026-09-08", "17:00", "Santa Fe", "Vasco da Gama", "Estádio Nemesio Camacho El Campín", "Bogotá"],
    ["2026-09-08", "21:30", "Boca Juniors", "São Paulo", "Estádio La Bombonera", "Buenos Aires"],
    ["2026-09-09", "19:00", "Santos", "Atlético Mineiro", "Estádio Urbano Caldeira (Vila Belmiro)", "Santos"],
    ["2026-09-10", "19:30", "Cienciano", "Montevideo City Torque", "Estádio Inca Garcilaso de la Vega", "Cusco"],
    ["2026-09-15", "19:00", "Vasco da Gama", "Santa Fe", "Estádio São Januário", "Rio de Janeiro"],
    ["2026-09-15", "21:30", "São Paulo", "Boca Juniors", "Estádio Morumbis", "São Paulo"],
    ["2026-09-16", "19:00", "Atlético Mineiro", "Santos", "Arena MRV", "Belo Horizonte"],
    ["2026-09-17", "21:30", "Montevideo City Torque", "Cienciano", "Estádio Centenario", "Montevidéu"],
  ],
};

const slug = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export const conmebolHistoricalEvents = (
  source: Pick<CalendarCatalogSource, "id" | "competition" | "season">
): OfficialCalendarEvent[] =>
  (QUARTERFINALS[source.id] ?? []).map(([date, time, homeTeam, awayTeam, venue, city]) =>
    conmebolEvent({
      source: source as CalendarCatalogSource,
      externalId: `${slug(QUARTERFINALS_PHASE)}-${date}-${slug(homeTeam)}-${slug(awayTeam)}`,
      date, time, city, venue, phase: QUARTERFINALS_PHASE, homeTeam, awayTeam,
    })
  );
