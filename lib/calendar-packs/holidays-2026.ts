import type { CalendarPack, CalendarPackEvent } from "./types";

const VERIFIED_AT = "2026-07-13";
const BRAZIL_TIME_ZONE = "America/Sao_Paulo";
const FIRST_SUPPORTED_YEAR = 2025;
const LAST_SUPPORTED_MOVABLE_HOLIDAY_YEAR = 2100;
const HOLIDAY_CATEGORY_KEY = "holidays";
const HOLIDAY_CATEGORY_ID = "2026fe00-0000-4000-8000-000000000002";
const LEGACY_STATE_CATEGORY_IDS = [
  "2026fe10-0000-4000-8000-000000000002",
  "2026fe20-0000-4000-8000-000000000002",
];

type HolidaySource = {
  label: string;
  url: string;
  lastVerified: string;
};

const NATIONAL_SOURCE: HolidaySource = {
  label: "Calendário oficial da Administração Pública Federal",
  url: "https://www.gov.br/gestao/pt-br/acesso-a-informacao/institucional/atos-normativos/2025/2025-portarias",
  lastVerified: VERIFIED_AT,
};

const STATE_SOURCE_BASE = "https://feriadosapi.com/feriados";

const stateSource = (slug: string, label: string): HolidaySource => ({
  label: `Feriados estaduais de ${label}, auditados contra a legislação estadual`,
  url: `${STATE_SOURCE_BASE}/${slug}`,
  lastVerified: VERIFIED_AT,
});

const SAO_PAULO_SOURCE: HolidaySource = {
  label: "Lei estadual nº 9.497/1997",
  url: "https://www.al.sp.gov.br/repositorio/legislacao/lei/1997/compilacao-lei-9497-05.03.1997.html",
  lastVerified: VERIFIED_AT,
};

const RIO_GRANDE_DO_SUL_SOURCE: HolidaySource = {
  label: "Portal do Estado do Rio Grande do Sul",
  url: "https://estado.rs.gov.br/confira-o-funcionamento-de-servicos-estaduais-no-feriado-de-20-de-setembro",
  lastVerified: VERIFIED_AT,
};

type HolidayEventInput = {
  id: string;
  legacyIds?: string[];
  title: string;
  date: string;
  scope: string;
  location: string;
  source: HolidaySource;
  notes?: string[];
  recurrenceType?: CalendarPackEvent["recurrenceType"];
  recurrenceUntil?: string;
};

const HOLIDAY_EXPLANATIONS: Record<string, string> = {
  "Confraternização Universal": "O primeiro dia do ano foi dedicado à fraternidade e à paz entre os povos. No Brasil, a data abre oficialmente o calendário de feriados nacionais.",
  Tiradentes: "A data homenageia Joaquim José da Silva Xavier, o Tiradentes, executado em 1792 por sua participação na Inconfidência Mineira.",
  "Dia Mundial do Trabalho": "O 1º de maio lembra as mobilizações históricas por jornadas e condições de trabalho mais justas, que deram origem ao Dia do Trabalho em diversos países.",
  "Independência do Brasil": "Recorda a declaração de independência de Portugal, proclamada por Dom Pedro em 7 de setembro de 1822.",
  "Nossa Senhora Aparecida": "Celebra a padroeira do Brasil, ligada à imagem encontrada por pescadores no rio Paraíba do Sul em 1717.",
  Finados: "É um dia de memória e homenagem às pessoas falecidas, tradição cristã celebrada em 2 de novembro desde a Idade Média.",
  "Proclamação da República": "Marca a mudança do Brasil de monarquia para república, ocorrida em 15 de novembro de 1889.",
  "Dia Nacional de Zumbi e da Consciência Negra": "A data lembra Zumbi dos Palmares e valoriza a história, a resistência e as contribuições da população negra para o Brasil.",
  Natal: "Celebra o nascimento de Jesus Cristo e se tornou também uma data de encontro, solidariedade e renovação de vínculos.",
  "Paixão de Cristo": "A sexta-feira anterior à Páscoa recorda a crucificação e a morte de Jesus Cristo na tradição cristã.",
  "Dia do Católico": "A data reconhece a presença histórica do catolicismo na formação cultural e religiosa do Acre.",
  "Dia do Evangélico": "A celebração reconhece a contribuição das comunidades evangélicas para a vida religiosa e social local.",
  "Dia Internacional da Mulher": "O 8 de março simboliza a luta histórica das mulheres por direitos, igualdade e participação plena na sociedade.",
  "Aniversário do Estado do Acre": "Recorda a elevação do Acre à condição de estado, formalizada em 15 de junho de 1962.",
  "Início da Revolução Acreana": "Lembra o movimento iniciado em 1902 que levou à incorporação definitiva do território acreano ao Brasil.",
  "Dia da Amazônia": "A data chama atenção para a importância ambiental, cultural e social da Amazônia e para a necessidade de preservá-la.",
  "Tratado de Petrópolis": "Recorda o acordo de 1903 pelo qual o Acre foi incorporado ao Brasil após negociação com a Bolívia.",
  "São João": "Celebra o nascimento de São João Batista e é uma das datas centrais das festas juninas no Nordeste brasileiro.",
  "São Pedro": "Homenageia São Pedro, considerado o primeiro papa pela tradição católica e também padroeiro dos pescadores.",
  "Emancipação Política de Alagoas": "Recorda a separação de Alagoas da capitania de Pernambuco e sua elevação a capitania autônoma em 1817.",
  "São José — Padroeiro do Amapá": "Homenageia São José, padroeiro do Amapá e figura ligada à história da antiga Fortaleza de São José de Macapá.",
  "Dia de Cabralzinho": "Lembra Francisco Xavier da Veiga Cabral, o Cabralzinho, associado à defesa do território do Amapá no século XIX.",
  "Criação do ex-Território Federal do Amapá": "Recorda a criação do Território Federal do Amapá em 1943, etapa decisiva antes de sua transformação em estado.",
  "Elevação do Amazonas à Categoria de Província": "Marca a autonomia administrativa conquistada em 1850, quando a antiga comarca passou a ser a Província do Amazonas.",
  "Independência da Bahia": "Celebra a vitória de 2 de julho de 1823, que consolidou a expulsão das tropas portuguesas e a independência brasileira na Bahia.",
  "Data Magna do Ceará": "Recorda a abolição da escravidão no Ceará em 25 de março de 1884, quatro anos antes da Lei Áurea.",
  "Corpus Christi": "A celebração católica honra a Eucaristia e ocorre sessenta dias após a Páscoa, tradicionalmente com procissões e tapetes nas ruas.",
  "Nossa Senhora da Penha": "Homenageia a padroeira do Espírito Santo, cuja devoção está ligada ao Convento da Penha desde o século XVI.",
  "Fundação da Cidade de Goiás": "Recorda a origem da antiga Vila Boa, fundada no ciclo do ouro e primeira capital do estado de Goiás.",
  "Adesão do Maranhão à Independência do Brasil": "Marca a adesão oficial do Maranhão à independência em 1823, após resistência das forças ligadas a Portugal.",
  "Criação do Estado de Mato Grosso do Sul": "Lembra a divisão de Mato Grosso e a criação de Mato Grosso do Sul pela lei de 1977.",
  "Adesão do Pará à Independência do Brasil": "Recorda a adesão do Pará à independência em 1823, encerrando a ligação política formal da província com Portugal.",
  "Emancipação Política da Paraíba": "Celebra a criação da Capitania da Paraíba em 1585 e sua autonomia política na administração colonial.",
  "Data Magna de Pernambuco": "Recorda a Revolução Pernambucana de 1817, movimento republicano que contestou o domínio da Coroa portuguesa.",
  "Dia do Piauí": "Lembra a adesão do Piauí à independência do Brasil, proclamada em Parnaíba em 19 de outubro de 1822.",
  "São Jorge": "Homenageia São Jorge, santo de forte devoção popular no Rio de Janeiro e símbolo de coragem e proteção.",
  "Terça-feira de Carnaval": "É o ponto culminante do Carnaval, tradição que antecede a Quaresma e ganhou no Brasil expressões culturais próprias.",
  "Mártires de Cunhaú e Uruaçu": "Homenageia os fiéis mortos nos massacres de Cunhaú e Uruaçu, ocorridos no Rio Grande do Norte em 1645.",
  "Revolução Farroupilha": "A data lembra o início da Revolução Farroupilha em 1835 e celebra a identidade e as tradições do Rio Grande do Sul.",
  "Aniversário de Rondônia": "Recorda a criação do estado de Rondônia em 1982, após décadas como território federal.",
  "Aniversário de Roraima": "Celebra a criação do estado de Roraima pela Constituição Federal de 1988.",
  "Data Magna de Santa Catarina": "Homenageia Santa Catarina de Alexandria, figura que deu nome ao estado e integra sua tradição histórica.",
  "9 de Julho — Data Magna de São Paulo": "Recorda a Revolução Constitucionalista de 1932, movimento paulista que reivindicava uma nova Constituição para o país.",
  "Emancipação Política de Sergipe": "Celebra a autonomia de Sergipe em relação à Bahia, determinada em 1820.",
  "Senhor do Bonfim": "A data celebra uma das devoções religiosas mais tradicionais do Tocantins, marcada por romarias e encontros comunitários.",
  "Nossa Senhora da Natividade — Padroeira do Tocantins": "Homenageia a padroeira do Tocantins, cuja devoção acompanha a história religiosa da antiga região norte de Goiás.",
  "Criação do Estado do Tocantins": "Recorda a criação do Tocantins pela Constituição de 1988, concretizando um antigo movimento de autonomia regional.",
};

const getHolidayExplanation = (title: string) => {
  const explanation = HOLIDAY_EXPLANATIONS[title];
  if (!explanation) throw new Error(`Missing holiday explanation: ${title}`);
  return explanation;
};

const createHolidayEvent = ({
  id,
  legacyIds,
  title,
  date,
  scope,
  location,
  source,
  recurrenceType,
  recurrenceUntil,
}: HolidayEventInput): CalendarPackEvent => ({
  id,
  legacyIds,
  title,
  date,
  time: "00:00",
  timezone: BRAZIL_TIME_ZONE,
  city: location,
  venue: scope,
  phase: scope,
  homeTeam: location,
  awayTeam: "Feriado",
  suggestedCategoryKey: HOLIDAY_CATEGORY_KEY,
  source: source.label,
  sourceUrl: source.url,
  lastVerified: source.lastVerified,
  notes: [getHolidayExplanation(title)],
  isBrazilMatch: false,
  recurrenceType,
  recurrenceUntil,
});

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

const getDateFromEaster = (year: number, offsetInDays: number) => {
  const date = getEasterSunday(year);
  date.setUTCDate(date.getUTCDate() + offsetInDays);
  return formatDate(date);
};

const supportedYears = Array.from(
  { length: LAST_SUPPORTED_MOVABLE_HOLIDAY_YEAR - FIRST_SUPPORTED_YEAR + 1 },
  (_, index) => FIRST_SUPPORTED_YEAR + index
);

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

const nationalHolidayEvents = [
  ...fixedNationalHolidays.map(([suffix, title, monthAndDay]) =>
    createHolidayEvent({
      id: `2026fe00-0000-4000-8000-0000000001${suffix}`,
      title,
      date: `${FIRST_SUPPORTED_YEAR}-${monthAndDay}`,
      scope: "Feriado nacional",
      location: "Brasil",
      source: NATIONAL_SOURCE,
      recurrenceType: "yearly",
    })
  ),
  ...supportedYears.map((year) =>
    createHolidayEvent({
      id:
        year === 2026
          ? "2026fe00-0000-4000-8000-000000000102"
          : `2026fe00-0000-4000-8000-${year}00000102`,
      title: "Paixão de Cristo",
      date: getDateFromEaster(year, -2),
      scope: "Feriado nacional",
      location: "Brasil",
      source: NATIONAL_SOURCE,
      notes: ["Data móvel calculada a partir do domingo de Páscoa."],
    })
  ),
].sort((a, b) => a.date.localeCompare(b.date));

type FixedStateHoliday = {
  title: string;
  monthAndDay: string;
  notes?: string[];
  existingId?: string;
};

type MovableStateHoliday = {
  title: string;
  easterOffset: number;
  notes?: string[];
};

type StateDefinition = {
  uf: string;
  label: string;
  slug: string;
  source?: HolidaySource;
  fixed?: FixedStateHoliday[];
  movable?: MovableStateHoliday[];
};

const stateDefinitions: StateDefinition[] = [
  {
    uf: "AC",
    label: "Acre",
    slug: "acre",
    fixed: [
      { title: "Dia do Católico", monthAndDay: "01-22" },
      { title: "Dia do Evangélico", monthAndDay: "01-23" },
      { title: "Dia Internacional da Mulher", monthAndDay: "03-08" },
      { title: "Aniversário do Estado do Acre", monthAndDay: "06-15" },
      { title: "Início da Revolução Acreana", monthAndDay: "08-06" },
      { title: "Dia da Amazônia", monthAndDay: "09-05" },
      { title: "Tratado de Petrópolis", monthAndDay: "11-17" },
    ],
  },
  {
    uf: "AL",
    label: "Alagoas",
    slug: "alagoas",
    fixed: [
      { title: "São João", monthAndDay: "06-24" },
      { title: "São Pedro", monthAndDay: "06-29" },
      { title: "Emancipação Política de Alagoas", monthAndDay: "09-16" },
      { title: "Dia do Evangélico", monthAndDay: "11-30" },
    ],
  },
  {
    uf: "AP",
    label: "Amapá",
    slug: "amapa",
    fixed: [
      { title: "São José — Padroeiro do Amapá", monthAndDay: "03-19" },
      { title: "Dia de Cabralzinho", monthAndDay: "05-15" },
      { title: "Criação do ex-Território Federal do Amapá", monthAndDay: "09-13" },
      { title: "Dia do Evangélico", monthAndDay: "11-30" },
    ],
  },
  {
    uf: "AM",
    label: "Amazonas",
    slug: "amazonas",
    fixed: [
      { title: "Elevação do Amazonas à Categoria de Província", monthAndDay: "09-05" },
    ],
  },
  {
    uf: "BA",
    label: "Bahia",
    slug: "bahia",
    fixed: [{ title: "Independência da Bahia", monthAndDay: "07-02" }],
  },
  {
    uf: "CE",
    label: "Ceará",
    slug: "ceara",
    fixed: [{ title: "Data Magna do Ceará", monthAndDay: "03-25" }],
  },
  {
    uf: "DF",
    label: "Distrito Federal",
    slug: "distrito-federal",
    fixed: [{ title: "Dia do Evangélico", monthAndDay: "11-30" }],
    movable: [{ title: "Corpus Christi", easterOffset: 60 }],
  },
  {
    uf: "ES",
    label: "Espírito Santo",
    slug: "espirito-santo",
    movable: [
      {
        title: "Nossa Senhora da Penha",
        easterOffset: 8,
        notes: ["Data móvel: segunda-feira após a Oitava da Páscoa."],
      },
    ],
  },
  {
    uf: "GO",
    label: "Goiás",
    slug: "goias",
    fixed: [{ title: "Fundação da Cidade de Goiás", monthAndDay: "07-26" }],
  },
  {
    uf: "MA",
    label: "Maranhão",
    slug: "maranhao",
    fixed: [
      { title: "Adesão do Maranhão à Independência do Brasil", monthAndDay: "07-28" },
    ],
  },
  { uf: "MT", label: "Mato Grosso", slug: "mato-grosso" },
  {
    uf: "MS",
    label: "Mato Grosso do Sul",
    slug: "mato-grosso-do-sul",
    fixed: [{ title: "Criação do Estado de Mato Grosso do Sul", monthAndDay: "10-11" }],
  },
  { uf: "MG", label: "Minas Gerais", slug: "minas-gerais" },
  {
    uf: "PA",
    label: "Pará",
    slug: "para",
    fixed: [{ title: "Adesão do Pará à Independência do Brasil", monthAndDay: "08-15" }],
  },
  {
    uf: "PB",
    label: "Paraíba",
    slug: "paraiba",
    fixed: [{ title: "Emancipação Política da Paraíba", monthAndDay: "08-05" }],
  },
  { uf: "PR", label: "Paraná", slug: "parana" },
  {
    uf: "PE",
    label: "Pernambuco",
    slug: "pernambuco",
    fixed: [{ title: "Data Magna de Pernambuco", monthAndDay: "03-06" }],
  },
  {
    uf: "PI",
    label: "Piauí",
    slug: "piaui",
    fixed: [{ title: "Dia do Piauí", monthAndDay: "10-19" }],
  },
  {
    uf: "RJ",
    label: "Rio de Janeiro",
    slug: "rio-de-janeiro",
    fixed: [{ title: "São Jorge", monthAndDay: "04-23" }],
    movable: [
      { title: "Terça-feira de Carnaval", easterOffset: -47 },
      { title: "Corpus Christi", easterOffset: 60 },
    ],
  },
  {
    uf: "RN",
    label: "Rio Grande do Norte",
    slug: "rio-grande-do-norte",
    fixed: [{ title: "Mártires de Cunhaú e Uruaçu", monthAndDay: "10-03" }],
  },
  {
    uf: "RS",
    label: "Rio Grande do Sul",
    slug: "rio-grande-do-sul",
    source: RIO_GRANDE_DO_SUL_SOURCE,
    fixed: [
      {
        title: "Revolução Farroupilha",
        monthAndDay: "09-20",
        existingId: "2026fe20-0000-4000-8000-000000000101",
        notes: ["Data Magna do Estado do Rio Grande do Sul."],
      },
    ],
  },
  {
    uf: "RO",
    label: "Rondônia",
    slug: "rondonia",
    fixed: [{ title: "Aniversário de Rondônia", monthAndDay: "01-04" }],
  },
  {
    uf: "RR",
    label: "Roraima",
    slug: "roraima",
    fixed: [{ title: "Aniversário de Roraima", monthAndDay: "10-05" }],
  },
  {
    uf: "SC",
    label: "Santa Catarina",
    slug: "santa-catarina",
    fixed: [{ title: "Data Magna de Santa Catarina", monthAndDay: "08-16" }],
  },
  {
    uf: "SP",
    label: "São Paulo",
    slug: "sao-paulo",
    source: SAO_PAULO_SOURCE,
    fixed: [
      {
        title: "9 de Julho — Data Magna de São Paulo",
        monthAndDay: "07-09",
        existingId: "2026fe10-0000-4000-8000-000000000101",
        notes: ["Data da Revolução Constitucionalista de 1932."],
      },
    ],
  },
  {
    uf: "SE",
    label: "Sergipe",
    slug: "sergipe",
    fixed: [{ title: "Emancipação Política de Sergipe", monthAndDay: "07-08" }],
  },
  {
    uf: "TO",
    label: "Tocantins",
    slug: "tocantins",
    fixed: [
      { title: "Senhor do Bonfim", monthAndDay: "08-15" },
      { title: "Nossa Senhora da Natividade — Padroeira do Tocantins", monthAndDay: "09-08" },
      { title: "Criação do Estado do Tocantins", monthAndDay: "10-05" },
    ],
  },
];

const createStateHolidayEvents = (
  definition: StateDefinition,
  stateIndex: number
) => {
  const source = definition.source ?? stateSource(definition.slug, definition.label);
  const stateCode = String(stateIndex + 1).padStart(4, "0");
  const fixedEvents = (definition.fixed ?? []).map((holiday, index) => {
    const legacyId = `holidays-${definition.uf.toLowerCase()}-fixed-${index + 1}`;
    return createHolidayEvent({
      id:
        holiday.existingId ??
        `2026fe30-${stateCode}-4000-8000-${String(index + 1).padStart(12, "0")}`,
      legacyIds: holiday.existingId ? undefined : [legacyId],
      title: holiday.title,
      date: `${FIRST_SUPPORTED_YEAR}-${holiday.monthAndDay}`,
      scope: "Feriado estadual",
      location: definition.label,
      source,
      notes: holiday.notes,
      recurrenceType: "yearly",
    });
  });
  const movableEvents = (definition.movable ?? []).flatMap((holiday, index) =>
    supportedYears.map((year) => {
      const legacyId = `holidays-${definition.uf.toLowerCase()}-movable-${index + 1}-${year}`;
      return createHolidayEvent({
        id: `2026fe31-${stateCode}-4000-8000-${String(index + 1).padStart(2, "0")}${year}000000`,
        legacyIds: [legacyId],
        title: holiday.title,
        date: getDateFromEaster(year, holiday.easterOffset),
        scope: "Feriado estadual",
        location: definition.label,
        source,
        notes: [
          ...(holiday.notes ?? []),
          "Data móvel calculada a partir do domingo de Páscoa.",
        ],
      });
    })
  );

  return [...fixedEvents, ...movableEvents].sort((a, b) => a.date.localeCompare(b.date));
};

const HOLIDAY_CATEGORY = {
  id: HOLIDAY_CATEGORY_ID,
  key: HOLIDAY_CATEGORY_KEY,
  name: "Feriados",
  color: "#2563EB",
};

export const holidays2026Packs = stateDefinitions.map((definition, stateIndex): CalendarPack => {
  const source = definition.source ?? stateSource(definition.slug, definition.label);
  const stateEvents = createStateHolidayEvents(definition, stateIndex);

  return {
    id: `holidays-${definition.slug}`,
    name: "Feriados nacionais + estaduais",
    eyebrow: definition.label,
    icon: "calendar",
    description:
      "Feriados nacionais e os estaduais da UF selecionada, juntos em um único calendário.",
    variantGroup: {
      id: "holidays-by-state",
      label: "Estado",
      optionLabel: `${definition.label} (${definition.uf})`,
      selectionMode: "replace",
    },
    year: 2026,
    datasetStatus: "complete",
    updateNote:
      "Datas fixas recorrentes desde 2025 e datas móveis calculadas até 2100.",
    source,
    profile: {
      id: "2026fe00-0000-4000-8000-000000000001",
      name: "Feriados",
      icon: "calendar-days",
    },
    categories: [HOLIDAY_CATEGORY],
    legacyCategoryIds: LEGACY_STATE_CATEGORY_IDS,
    events: [...nationalHolidayEvents, ...stateEvents],
  };
});
