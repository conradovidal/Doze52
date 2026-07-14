import type { CalendarPack, CalendarPackEvent } from "./types";

const VERIFIED_AT = "2026-07-13";
const SOURCE = {
  label: "Tabela detalhada oficial da CBF",
  url: "https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/2026?documento=Tabela%20Detalhada",
  lastVerified: VERIFIED_AT,
};
const CATEGORY = {
  id: "brasileirao-2026-category",
  key: "brasileirao-2026",
  name: "Brasileirão 2026",
  color: "#15803D",
};
const GREMIO_ID = "20013";
const INTERNACIONAL_ID = "20011";

type MatchTuple = readonly [
  id: string,
  round: number,
  date: string,
  time: string,
  home: string,
  homeId: string,
  homeGoals: string | null,
  away: string,
  awayId: string,
  awayGoals: string | null,
  location: string,
];

const matches: MatchTuple[] = [
  ["831889", 1, "2026-01-28", "19:30", "Fluminense", "20014", "2", "Grêmio", "20013", "1", "Maracanã - Rio de Janeiro - RJ"],
  ["831895", 1, "2026-01-28", "19:00", "Internacional", "20011", "0", "Athletico Paranaense", "20052", "1", "Beira-Rio - Porto Alegre - RS"],
  ["831899", 2, "2026-02-04", "19:00", "Flamengo", "20016", "1", "Internacional", "20011", "1", "Maracanã - Rio de Janeiro - RJ"],
  ["831905", 2, "2026-02-04", "21:30", "Grêmio", "20013", "5", "Botafogo", "60175", "3", "Arena do Grêmio - Porto Alegre - RS"],
  ["831911", 3, "2026-02-11", "21:30", "São Paulo", "20005", "2", "Grêmio", "20013", "0", "Morumbi - São Paulo - SP"],
  ["831915", 3, "2026-02-12", "21:30", "Internacional", "20011", "1", "Palmeiras", "20002", "3", "Beira-Rio - Porto Alegre - RS"],
  ["831925", 4, "2026-02-25", "21:30", "Grêmio", "20013", "2", "Atlético Mineiro", "62194", "1", "Arena do Grêmio - Porto Alegre - RS"],
  ["831928", 4, "2026-02-25", "19:00", "Remo", "20022", "1", "Internacional", "20011", "1", "Mangueirão - Belém - PA"],
  ["831934", 5, "2026-03-11", "19:00", "Atlético Mineiro", "62194", "1", "Internacional", "20011", "0", "Arena MRV - Belo Horizonte - MG"],
  ["831935", 5, "2026-03-12", "21:30", "Grêmio", "20013", "1", "Red Bull Bragantino", "20007", "1", "Arena do Grêmio - Porto Alegre - RS"],
  ["831945", 6, "2026-03-15", "16:00", "Internacional", "20011", "0", "Bahia", "61377", "1", "Beira-Rio - Porto Alegre - RS"],
  ["831948", 6, "2026-03-16", "20:00", "Chapecoense", "20086", "1", "Grêmio", "20013", "1", "Arena Condá - Chapecó - SC"],
  ["831951", 7, "2026-03-18", "21:30", "Santos", "20008", "1", "Internacional", "20011", "2", "Vila Belmiro - Santos - SP"],
  ["831955", 7, "2026-03-19", "19:00", "Grêmio", "20013", "2", "Vitória", "20018", "0", "Arena do Grêmio - Porto Alegre - RS"],
  ["831960", 8, "2026-03-22", "16:00", "Vasco da Gama", "60646", "2", "Grêmio", "20013", "1", "São Januário - Rio de Janeiro - RJ"],
  ["831965", 8, "2026-03-22", "18:30", "Internacional", "20011", "2", "Chapecoense", "20086", "0", "Beira-Rio - Porto Alegre - RS"],
  ["831973", 9, "2026-04-02", "21:30", "Palmeiras", "20002", "2", "Grêmio", "20013", "1", "Arena Barueri - Barueri - SP"],
  ["831976", 9, "2026-04-01", "19:30", "Internacional", "20011", "1", "São Paulo", "20005", "1", "Beira-Rio - Porto Alegre - RS"],
  ["831983", 10, "2026-04-05", "19:30", "Corinthians", "20001", "0", "Internacional", "20011", "1", "Neo Química Arena - São Paulo - SP"],
  ["831986", 10, "2026-04-05", "20:30", "Grêmio", "20013", "0", "Remo", "20022", "0", "Arena do Grêmio - Porto Alegre - RS"],
  ["831996", 11, "2026-04-11", "20:30", "Internacional", "20011", "0", "Grêmio", "20013", "0", "Beira-Rio - Porto Alegre - RS"],
  ["832005", 12, "2026-04-18", "20:30", "Cruzeiro", "59849", "2", "Grêmio", "20013", "0", "Mineirão - Belo Horizonte - MG"],
  ["832006", 12, "2026-04-19", "11:00", "Internacional", "20011", "1", "Mirassol", "20385", "2", "Beira-Rio - Porto Alegre - RS"],
  ["832011", 13, "2026-04-25", "18:30", "Botafogo", "60175", "2", "Internacional", "20011", "2", "Mané Garrincha - Brasília - DF"],
  ["832016", 13, "2026-04-26", "16:00", "Grêmio", "20013", "1", "Coritiba", "61590", "0", "Arena do Grêmio - Porto Alegre - RS"],
  ["832026", 14, "2026-05-03", "18:30", "Internacional", "20011", "2", "Fluminense", "20014", "0", "Beira-Rio - Porto Alegre - RS"],
  ["832027", 14, "2026-05-02", "20:30", "Athletico Paranaense", "20052", "0", "Grêmio", "20013", "0", "Arena da Baixada - Curitiba - PR"],
  ["832036", 15, "2026-05-10", "19:30", "Grêmio", "20013", "0", "Flamengo", "20016", "1", "Arena do Grêmio - Porto Alegre - RS"],
  ["832037", 15, "2026-05-09", "16:00", "Coritiba", "61590", "2", "Internacional", "20011", "2", "Couto Pereira - Curitiba - PR"],
  ["832046", 16, "2026-05-16", "18:30", "Internacional", "20011", "4", "Vasco da Gama", "60646", "1", "Beira-Rio - Porto Alegre - RS"],
  ["832048", 16, "2026-05-17", "16:00", "Bahia", "61377", "1", "Grêmio", "20013", "1", "Arena Fonte Nova - Salvador - BA"],
  ["832056", 17, "2026-05-23", "19:00", "Grêmio", "20013", "3", "Santos", "20008", "2", "Arena do Grêmio - Porto Alegre - RS"],
  ["832058", 17, "2026-05-23", "17:00", "Vitória", "20018", "2", "Internacional", "20011", "0", "Manoel Barradas - Salvador - BA"],
  ["832064", 18, "2026-05-31", "11:00", "Red Bull Bragantino", "20007", "3", "Internacional", "20011", "1", "Cícero de Souza Marques - Bragança Paulista - SP"],
  ["832066", 18, "2026-05-30", "17:30", "Grêmio", "20013", "1", "Corinthians", "20001", "3", "Arena do Grêmio - Porto Alegre - RS"],
  ["832074", 19, "2026-07-17", "20:00", "Mirassol", "20385", null, "Grêmio", "20013", null, "José Maria de Campos Maia - Mirassol - SP"],
  ["832076", 19, "2026-07-22", "21:30", "Internacional", "20011", null, "Cruzeiro", "59849", null, "Beira-Rio - Porto Alegre - RS"],
  ["832086", 20, "2026-07-26", "18:30", "Grêmio", "20013", null, "Fluminense", "20014", null, "Arena do Grêmio - Porto Alegre - RS"],
  ["832087", 20, "2026-07-25", "18:30", "Athletico Paranaense", "20052", null, "Internacional", "20011", null, "Arena da Baixada - Curitiba - PR"],
  ["832096", 21, "2026-07-29", "19:30", "Internacional", "20011", null, "Flamengo", "20016", null, "Beira-Rio - Porto Alegre - RS"],
  ["832103", 22, "2026-08-09", "16:00", "Palmeiras", "20002", null, "Internacional", "20011", null, "Nubank Parque - São Paulo - SP"],
  ["832106", 22, "2026-08-08", "16:00", "Grêmio", "20013", null, "São Paulo", "20005", null, "Arena do Grêmio - Porto Alegre - RS"],
  ["832115", 23, "2026-08-15", "16:30", "Atlético Mineiro", "62194", null, "Grêmio", "20013", null, "Arena MRV - Belo Horizonte - MG"],
  ["832116", 23, "2026-08-17", "20:00", "Internacional", "20011", null, "Remo", "20022", null, "Beira-Rio - Porto Alegre - RS"],
  ["832124", 24, "2026-08-23", "16:00", "Red Bull Bragantino", "20007", null, "Grêmio", "20013", null, "Cícero de Souza Marques - Bragança Paulista - SP"],
  ["832126", 24, "2026-08-22", "18:30", "Internacional", "20011", null, "Atlético Mineiro", "62194", null, "Beira-Rio - Porto Alegre - RS"],
];

const createEvent = (match: MatchTuple): CalendarPackEvent => {
  const [id, round, date, time, home, , homeGoals, away, , awayGoals, location] = match;
  const locationParts = location.split(" - ");
  const venue = locationParts.slice(0, -2).join(" - ");
  const city = locationParts.slice(-2).join(" - ");
  const hasResult = homeGoals !== null && awayGoals !== null;
  const title = hasResult
    ? `${home} ${homeGoals} x ${awayGoals} ${away}`
    : `${home} x ${away}`;

  return {
    id: `brasileirao-2026-${id}`,
    title,
    date,
    time,
    timezone: "America/Sao_Paulo",
    city,
    venue,
    phase: `Rodada ${round}`,
    homeTeam: home,
    awayTeam: away,
    suggestedCategoryKey: CATEGORY.key,
    source: SOURCE.label,
    sourceUrl: SOURCE.url,
    lastVerified: SOURCE.lastVerified,
    result: hasResult ? `${homeGoals} x ${awayGoals}` : undefined,
    notes: [`Referência oficial da partida: ${id}.`],
    isBrazilMatch: false,
  };
};

const events = matches.map(createEvent);

const createPack = (teamId: string, teamName: string): CalendarPack => ({
  id: `brasileirao-2026-${teamName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`,
  name: "Jogos do Brasileirão",
  eyebrow: teamName,
  icon: "soccer-ball",
  description: "Partidas detalhadas pela CBF do time selecionado no Brasileirão 2026.",
  variantGroup: {
    id: "brasileirao-2026-by-team",
    label: "Time",
    optionLabel: teamName,
    selectionMode: "replace",
  },
  year: 2026,
  datasetStatus: "seed",
  updateNote: "Rodadas com data e horário detalhados pela CBF, atualmente até a 24ª rodada.",
  source: SOURCE,
  profile: {
    id: "brasileirao-2026-profile",
    name: "Brasileirão 2026",
    icon: "calendar-days",
  },
  categories: [CATEGORY],
  events: events.filter((event) => {
    const match = matches.find(([id]) => event.id === `brasileirao-2026-${id}`);
    return match?.[5] === teamId || match?.[8] === teamId;
  }),
});

export const brasileirao2026Packs = [
  createPack(GREMIO_ID, "Grêmio"),
  createPack(INTERNACIONAL_ID, "Internacional"),
] as const;
