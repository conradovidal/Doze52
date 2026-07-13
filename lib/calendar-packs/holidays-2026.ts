import type { CalendarPack, CalendarPackEvent } from "./types";

const VERIFIED_AT = "2026-07-13";
const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
const NATIONAL_SOURCE = {
  label: "Portaria MGI nº 11.460/2025",
  url: "https://legis.sigepe.gov.br/legis/detalhar/24765",
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
});

const nationalHolidays = [
  ["01", "Confraternização Universal", "2026-01-01"],
  ["02", "Paixão de Cristo", "2026-04-03"],
  ["03", "Tiradentes", "2026-04-21"],
  ["04", "Dia Mundial do Trabalho", "2026-05-01"],
  ["05", "Independência do Brasil", "2026-09-07"],
  ["06", "Nossa Senhora Aparecida", "2026-10-12"],
  ["07", "Finados", "2026-11-02"],
  ["08", "Proclamação da República", "2026-11-15"],
  ["09", "Dia Nacional de Zumbi e da Consciência Negra", "2026-11-20"],
  ["10", "Natal", "2026-12-25"],
] as const;

export const holidaysBrazil2026Pack: CalendarPack = {
  id: "holidays-brazil-2026",
  name: "Feriados nacionais 2026",
  eyebrow: "Brasil",
  description: "Os 10 feriados nacionais oficiais de 2026, sem pontos facultativos.",
  year: 2026,
  datasetStatus: "complete",
  updateNote: "Calendário nacional de 2026 verificado pela Portaria MGI nº 11.460/2025.",
  source: NATIONAL_SOURCE,
  profile: {
    id: "2026fe00-0000-4000-8000-000000000001",
    name: "Feriados 2026",
    icon: "calendar-days",
  },
  categories: [
    {
      id: "2026fe00-0000-4000-8000-000000000002",
      key: "national-holidays",
      name: "Feriados nacionais 2026",
      color: "#2563EB",
    },
  ],
  events: nationalHolidays.map(([suffix, title, date]) =>
    createHolidayEvent({
      id: `2026fe00-0000-4000-8000-0000000001${suffix}`,
      title,
      date,
      categoryKey: "national-holidays",
      scope: "Feriado nacional",
      location: "Brasil",
      source: NATIONAL_SOURCE,
    })
  ),
};

export const holidaysSaoPaulo2026Pack: CalendarPack = {
  id: "holidays-sao-paulo-2026",
  name: "Feriados de São Paulo 2026",
  eyebrow: "São Paulo",
  description: "Feriado estadual de 9 de julho; os nacionais ficam em calendário separado.",
  year: 2026,
  datasetStatus: "complete",
  updateNote: "V1 estadual de São Paulo com a data magna de 9 de julho.",
  source: SAO_PAULO_SOURCE,
  profile: {
    id: "2026fe10-0000-4000-8000-000000000001",
    name: "Feriados de São Paulo 2026",
    icon: "calendar-days",
  },
  categories: [
    {
      id: "2026fe10-0000-4000-8000-000000000002",
      key: "sao-paulo-holidays",
      name: "Feriados de São Paulo 2026",
      color: "#D97706",
    },
  ],
  events: [
    createHolidayEvent({
      id: "2026fe10-0000-4000-8000-000000000101",
      title: "9 de Julho — Data Magna de São Paulo",
      date: "2026-07-09",
      categoryKey: "sao-paulo-holidays",
      scope: "Feriado estadual",
      location: "São Paulo",
      source: SAO_PAULO_SOURCE,
      notes: ["Data da Revolução Constitucionalista de 1932."],
    }),
  ],
};

export const holidaysRioGrandeDoSul2026Pack: CalendarPack = {
  id: "holidays-rio-grande-do-sul-2026",
  name: "Feriados do RS 2026",
  eyebrow: "Rio Grande do Sul",
  description: "Feriado estadual de 20 de setembro; os nacionais ficam em calendário separado.",
  year: 2026,
  datasetStatus: "complete",
  updateNote: "V1 estadual do Rio Grande do Sul com a data magna de 20 de setembro.",
  source: RIO_GRANDE_DO_SUL_SOURCE,
  profile: {
    id: "2026fe20-0000-4000-8000-000000000001",
    name: "Feriados do Rio Grande do Sul 2026",
    icon: "calendar-days",
  },
  categories: [
    {
      id: "2026fe20-0000-4000-8000-000000000002",
      key: "rio-grande-do-sul-holidays",
      name: "Feriados do RS 2026",
      color: "#7C3AED",
    },
  ],
  events: [
    createHolidayEvent({
      id: "2026fe20-0000-4000-8000-000000000101",
      title: "20 de Setembro — Revolução Farroupilha",
      date: "2026-09-20",
      categoryKey: "rio-grande-do-sul-holidays",
      scope: "Feriado estadual",
      location: "Rio Grande do Sul",
      source: RIO_GRANDE_DO_SUL_SOURCE,
      notes: ["Data Magna do Estado do Rio Grande do Sul."],
    }),
  ],
};

export const holidays2026Packs = [
  holidaysBrazil2026Pack,
  holidaysSaoPaulo2026Pack,
  holidaysRioGrandeDoSul2026Pack,
] as const;
