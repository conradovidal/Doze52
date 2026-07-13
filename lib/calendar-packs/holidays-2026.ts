import type { CalendarPack, CalendarPackEvent } from "./types";

const VERIFIED_AT = "2026-07-13";
const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
const FIRST_SUPPORTED_YEAR = 2025;
const LAST_SUPPORTED_MOVABLE_HOLIDAY_YEAR = 2100;

const NATIONAL_SOURCE = {
  label: "Calendário oficial da Administração Pública Federal",
  url: "https://www.gov.br/gestao/pt-br/acesso-a-informacao/institucional/atos-normativos/2025/2025-portarias",
  lastVerified: VERIFIED_AT,
};
const SAO_PAULO_SOURCE = {
  label: "Lei estadual nº 9.497/1997",
  url: "https://www.al.sp.gov.br/repositorio/legislacao/lei/1997/compilacao-lei-9497-05.03.1997.html",
  lastVerified: VERIFIED_AT,
};
const RIO_GRANDE_DO_SUL_SOURCE = {
  label: "Portal do Estado do Rio Grande do Sul",
  url: "https://estado.rs.gov.br/confira-o-funcionamento-de-servicos-estaduais-no-feriado-de-20-de-setembro",
  lastVerified: VERIFIED_AT,
};

type HolidayEventInput = {
  id: string;
  title: string;
  date: string;
  categoryKey: string;
  scope: string;
  location: string;
  source: typeof NATIONAL_SOURCE;
  notes?: string[];
  recurrenceType?: CalendarPackEvent["recurrenceType"];
  recurrenceUntil?: string;
};

const createHolidayEvent = ({
  id,
  title,
  date,
  categoryKey,
  scope,
  location,
  source,
  notes = [],
  recurrenceType,
  recurrenceUntil,
}: HolidayEventInput): CalendarPackEvent => ({
  id,
  title,
  date,
  time: "00:00",
  timezone: BRAZIL_TIME_ZONE,
  city: location,
  venue: scope,
  phase: scope,
  homeTeam: location,
  awayTeam: "Feriado",
  suggestedCategoryKey: categoryKey,
  source: source.label,
  sourceUrl: source.url,
  lastVerified: source.lastVerified,
  notes,
  isBrazilMatch: false,
  recurrenceType,
  recurrenceUntil,
});

const fixedNationalHolidays = [
  ["01", "Confraternização Universal", "01-01"],
  ["03", "Tiradentes", "04-21"],
  ["04", "Dia Mundial do Trabalho", "05-01"],
  ["05", "Independência do Brasil", "09-07"],
  ["06", "Nossa Senhora Aparecida", "10-12"],
  ["07", "Finados", "11-02"],
  ["08", "Proclamação da República", "11-15"],
  ["09", "Dia Nacional de Zumbi e da Consciência Negra", "11-20"],
  ["10", "Natal", "12-25"],
] as const;

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

const getEasterSunday = (year: number) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return new Date(Date.UTC(year, month - 1, day));
};

const getGoodFridayDate = (year: number) => {
  const easterSunday = getEasterSunday(year);
  easterSunday.setUTCDate(easterSunday.getUTCDate() - 2);
  return formatDate(easterSunday);
};

const createGoodFridayEvents = () =>
  Array.from(
    { length: LAST_SUPPORTED_MOVABLE_HOLIDAY_YEAR - FIRST_SUPPORTED_YEAR + 1 },
    (_, index) => FIRST_SUPPORTED_YEAR + index
  ).map((year) =>
    createHolidayEvent({
      id:
        year === 2026
          ? "2026fe00-0000-4000-8000-000000000102"
          : `2026fe00-0000-4000-8000-${year}00000102`,
      title: "Paixão de Cristo",
      date: getGoodFridayDate(year),
      categoryKey: "national-holidays",
      scope: "Feriado nacional",
      location: "Brasil",
      source: NATIONAL_SOURCE,
      notes: ["Data móvel calculada a partir do domingo de Páscoa."],
    })
  );

const nationalHolidayEvents = [
  ...fixedNationalHolidays.map(([suffix, title, monthAndDay]) =>
    createHolidayEvent({
      id: `2026fe00-0000-4000-8000-0000000001${suffix}`,
      title,
      date: `${FIRST_SUPPORTED_YEAR}-${monthAndDay}`,
      categoryKey: "national-holidays",
      scope: "Feriado nacional",
      location: "Brasil",
      source: NATIONAL_SOURCE,
      recurrenceType: "yearly",
    })
  ),
  ...createGoodFridayEvents(),
].sort((a, b) => a.date.localeCompare(b.date));

export const holidaysBrazil2026Pack: CalendarPack = {
  id: "holidays-brazil-2026",
  name: "Feriados nacionais",
  eyebrow: "Brasil",
  icon: "calendar",
  description:
    "Feriados nacionais recorrentes, sem pontos facultativos. Datas móveis calculadas até 2100.",
  year: 2026,
  datasetStatus: "complete",
  updateNote: "Datas fixas recorrentes e Paixão de Cristo calculada de 2025 a 2100.",
  source: NATIONAL_SOURCE,
  profile: {
    id: "2026fe00-0000-4000-8000-000000000001",
    name: "Feriados nacionais",
    icon: "calendar-days",
  },
  categories: [
    {
      id: "2026fe00-0000-4000-8000-000000000002",
      key: "national-holidays",
      name: "Feriados nacionais",
      color: "#2563EB",
    },
  ],
  events: nationalHolidayEvents,
};

export const holidaysSaoPaulo2026Pack: CalendarPack = {
  id: "holidays-sao-paulo-2026",
  name: "Feriados estaduais",
  eyebrow: "São Paulo",
  icon: "tree",
  description: "Feriados exclusivos do estado selecionado; os nacionais ficam em calendário separado.",
  year: 2026,
  datasetStatus: "complete",
  updateNote: "V1 estadual de São Paulo com a data magna de 9 de julho.",
  source: SAO_PAULO_SOURCE,
  variantGroup: {
    id: "state-holidays",
    label: "Estado",
    optionLabel: "São Paulo",
  },
  profile: {
    id: "2026fe10-0000-4000-8000-000000000001",
    name: "Feriados de São Paulo",
    icon: "calendar-days",
  },
  categories: [
    {
      id: "2026fe10-0000-4000-8000-000000000002",
      key: "sao-paulo-holidays",
      name: "Feriados de São Paulo",
      color: "#D97706",
    },
  ],
  events: [
    createHolidayEvent({
      id: "2026fe10-0000-4000-8000-000000000101",
      title: "9 de Julho — Data Magna de São Paulo",
      date: `${FIRST_SUPPORTED_YEAR}-07-09`,
      categoryKey: "sao-paulo-holidays",
      scope: "Feriado estadual",
      location: "São Paulo",
      source: SAO_PAULO_SOURCE,
      notes: ["Data da Revolução Constitucionalista de 1932."],
      recurrenceType: "yearly",
    }),
  ],
};

export const holidaysRioGrandeDoSul2026Pack: CalendarPack = {
  id: "holidays-rio-grande-do-sul-2026",
  name: "Feriados estaduais",
  eyebrow: "Rio Grande do Sul",
  icon: "tree",
  description: "Feriados exclusivos do estado selecionado; os nacionais ficam em calendário separado.",
  year: 2026,
  datasetStatus: "complete",
  updateNote: "V1 estadual do Rio Grande do Sul com a data magna de 20 de setembro.",
  source: RIO_GRANDE_DO_SUL_SOURCE,
  variantGroup: {
    id: "state-holidays",
    label: "Estado",
    optionLabel: "Rio Grande do Sul",
  },
  profile: {
    id: "2026fe20-0000-4000-8000-000000000001",
    name: "Feriados do Rio Grande do Sul",
    icon: "calendar-days",
  },
  categories: [
    {
      id: "2026fe20-0000-4000-8000-000000000002",
      key: "rio-grande-do-sul-holidays",
      name: "Feriados do Rio Grande do Sul",
      color: "#7C3AED",
    },
  ],
  events: [
    createHolidayEvent({
      id: "2026fe20-0000-4000-8000-000000000101",
      title: "20 de Setembro — Revolução Farroupilha",
      date: `${FIRST_SUPPORTED_YEAR}-09-20`,
      categoryKey: "rio-grande-do-sul-holidays",
      scope: "Feriado estadual",
      location: "Rio Grande do Sul",
      source: RIO_GRANDE_DO_SUL_SOURCE,
      notes: ["Data Magna do Estado do Rio Grande do Sul."],
      recurrenceType: "yearly",
    }),
  ],
};

export const holidays2026Packs = [
  holidaysBrazil2026Pack,
  holidaysSaoPaulo2026Pack,
  holidaysRioGrandeDoSul2026Pack,
] as const;
