import type { CalendarPack, CalendarPackEvent } from "./types";

const VERIFIED_AT = "2026-08-03";
const SOURCE = {
  label: "Tabela detalhada oficial da CBF",
  url: "https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/2026?documento=Tabela%20Detalhada",
  lastVerified: VERIFIED_AT,
};
const CATEGORY = {
  id: "2026ba00-0000-4000-8000-000000000002",
  key: "favorite-team-2026",
  name: "Jogos do Grêmio",
  color: "#2563EB",
  legacyNames: ["Brasileirão 2026"],
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
  ["832074", 19, "2026-07-17", "20:00", "Mirassol", "20385", "2", "Grêmio", "20013", "1", "José Maria de Campos Maia - Mirassol - SP"],
  ["832076", 19, "2026-07-22", "21:30", "Internacional", "20011", "1", "Cruzeiro", "59849", "2", "Beira-Rio - Porto Alegre - RS"],
  ["832086", 20, "2026-07-26", "18:30", "Grêmio", "20013", "1", "Fluminense", "20014", "1", "Arena do Grêmio - Porto Alegre - RS"],
  ["832087", 20, "2026-07-25", "18:30", "Athletico Paranaense", "20052", "2", "Internacional", "20011", "0", "Arena da Baixada - Curitiba - PR"],
  ["832096", 21, "2026-07-29", "19:30", "Internacional", "20011", "1", "Flamengo", "20016", "1", "Beira-Rio - Porto Alegre - RS"],
  ["832103", 22, "2026-08-09", "16:00", "Palmeiras", "20002", null, "Internacional", "20011", null, "Nubank Parque - São Paulo - SP"],
  ["832106", 22, "2026-08-08", "16:00", "Grêmio", "20013", null, "São Paulo", "20005", null, "Arena do Grêmio - Porto Alegre - RS"],
  ["832115", 23, "2026-08-15", "16:30", "Atlético Mineiro", "62194", null, "Grêmio", "20013", null, "Arena MRV - Belo Horizonte - MG"],
  ["832116", 23, "2026-08-17", "20:00", "Internacional", "20011", null, "Remo", "20022", null, "Beira-Rio - Porto Alegre - RS"],
  ["832124", 24, "2026-08-23", "16:00", "Red Bull Bragantino", "20007", null, "Grêmio", "20013", null, "Cícero de Souza Marques - Bragança Paulista - SP"],
  ["832126", 24, "2026-08-22", "18:30", "Internacional", "20011", null, "Atlético Mineiro", "62194", null, "Beira-Rio - Porto Alegre - RS"],
];

type TeamMatchEvent = {
  event: CalendarPackEvent;
  teamIds: string[];
};

type AdditionalMatch = {
  id: string;
  competition: string;
  phase: string;
  date: string;
  time: string;
  home: string;
  away: string;
  homeGoals?: string;
  awayGoals?: string;
  venue: string;
  city: string;
  teamIds: string[];
  notes?: string[];
  source: { label: string; url: string; lastVerified: string };
};

const officialSource = (label: string, url: string) => ({
  label,
  url,
  lastVerified: VERIFIED_AT,
});

const GREMIO_GAUCHAO_SOURCE = officialSource(
  "Agenda oficial do Grêmio — Gauchão 2026",
  "https://gremio.net/futebol/competicoes/profissional/716"
);
const INTER_GAUCHAO_SOURCE = officialSource(
  "Agenda oficial do Internacional — Gauchão 2026",
  "https://www.internacional.com.br/jogos/masculino/gauchao-2026"
);
const GREMIO_SUL_AMERICANA_SOURCE = officialSource(
  "Agenda oficial do Grêmio — CONMEBOL Sul-Americana 2026",
  "https://gremio.net/futebol/competicoes/profissional/764"
);
const GREMIO_COPA_DO_BRASIL_SOURCE = officialSource(
  "Agenda oficial do Grêmio — Copa do Brasil 2026",
  "https://gremio.net/futebol/competicoes/profissional/765"
);
const INTER_COPA_DO_BRASIL_SOURCE = officialSource(
  "Agenda oficial do Internacional e tabela detalhada da CBF",
  "https://internacional.com.br/noticias/masculino/cbf-divulga-datas-dos-proximos-oito-compromissos-do-colorado"
);
const RECOPA_GAUCHA_SOURCE = officialSource(
  "Tabela oficial da Federação Gaúcha de Futebol",
  "https://www.fgf.com.br/competicoes/profissional/27"
);

const additionalMatches: AdditionalMatch[] = [
  { id: "2026ba01-0000-4000-8000-000000000001", competition: "Campeonato Gaúcho", phase: "1ª rodada", date: "2026-01-10", time: "21:00", home: "Avenida", away: "Grêmio", homeGoals: "0", awayGoals: "4", venue: "Estádio dos Eucaliptos", city: "Santa Cruz do Sul - RS", teamIds: [GREMIO_ID], source: GREMIO_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000002", competition: "Campeonato Gaúcho", phase: "1ª rodada", date: "2026-01-11", time: "18:00", home: "Internacional", away: "Novo Hamburgo", homeGoals: "2", awayGoals: "1", venue: "Beira-Rio", city: "Porto Alegre - RS", teamIds: [INTERNACIONAL_ID], source: INTER_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000003", competition: "Campeonato Gaúcho", phase: "2ª rodada", date: "2026-01-14", time: "21:30", home: "Grêmio", away: "São José", homeGoals: "0", awayGoals: "1", venue: "Arena do Grêmio", city: "Porto Alegre - RS", teamIds: [GREMIO_ID], source: GREMIO_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000004", competition: "Campeonato Gaúcho", phase: "2ª rodada", date: "2026-01-15", time: "19:00", home: "Monsoon", away: "Internacional", homeGoals: "0", awayGoals: "4", venue: "Estádio Francisco Novelletto", city: "Porto Alegre - RS", teamIds: [INTERNACIONAL_ID], source: INTER_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000005", competition: "Campeonato Gaúcho", phase: "3ª rodada", date: "2026-01-17", time: "19:00", home: "Grêmio", away: "São Luiz", homeGoals: "5", awayGoals: "0", venue: "Arena do Grêmio", city: "Porto Alegre - RS", teamIds: [GREMIO_ID], source: GREMIO_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000006", competition: "Campeonato Gaúcho", phase: "3ª rodada", date: "2026-01-18", time: "18:00", home: "Ypiranga", away: "Internacional", homeGoals: "2", awayGoals: "1", venue: "Colosso da Lagoa", city: "Erechim - RS", teamIds: [INTERNACIONAL_ID], source: INTER_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000007", competition: "Campeonato Gaúcho", phase: "4ª rodada", date: "2026-01-21", time: "19:00", home: "Internacional", away: "Inter-SM", homeGoals: "2", awayGoals: "0", venue: "Beira-Rio", city: "Porto Alegre - RS", teamIds: [INTERNACIONAL_ID], source: INTER_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000008", competition: "Campeonato Gaúcho", phase: "4ª rodada", date: "2026-01-21", time: "21:30", home: "Guarany de Bagé", away: "Grêmio", homeGoals: "0", awayGoals: "2", venue: "Estrela D'Alva", city: "Bagé - RS", teamIds: [GREMIO_ID], source: GREMIO_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000009", competition: "Campeonato Gaúcho", phase: "5ª rodada", date: "2026-01-25", time: "20:00", home: "Internacional", away: "Grêmio", homeGoals: "4", awayGoals: "2", venue: "Beira-Rio", city: "Porto Alegre - RS", teamIds: [GREMIO_ID, INTERNACIONAL_ID], source: INTER_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000010", competition: "Campeonato Gaúcho", phase: "6ª rodada", date: "2026-01-31", time: "16:30", home: "Grêmio", away: "Juventude", homeGoals: "1", awayGoals: "1", venue: "Arena do Grêmio", city: "Porto Alegre - RS", teamIds: [GREMIO_ID], source: GREMIO_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000011", competition: "Campeonato Gaúcho", phase: "6ª rodada", date: "2026-01-31", time: "16:30", home: "Caxias", away: "Internacional", homeGoals: "1", awayGoals: "0", venue: "Estádio Centenário", city: "Caxias do Sul - RS", teamIds: [INTERNACIONAL_ID], source: INTER_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000012", competition: "Campeonato Gaúcho", phase: "Quartas de final", date: "2026-02-07", time: "18:30", home: "Grêmio", away: "Novo Hamburgo", homeGoals: "1", awayGoals: "0", venue: "Arena do Grêmio", city: "Porto Alegre - RS", teamIds: [GREMIO_ID], source: GREMIO_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000013", competition: "Campeonato Gaúcho", phase: "Quartas de final", date: "2026-02-08", time: "18:00", home: "Internacional", away: "São Luiz", homeGoals: "3", awayGoals: "1", venue: "Beira-Rio", city: "Porto Alegre - RS", teamIds: [INTERNACIONAL_ID], source: INTER_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000014", competition: "Campeonato Gaúcho", phase: "Semifinal", date: "2026-02-15", time: "17:30", home: "Grêmio", away: "Juventude", homeGoals: "1", awayGoals: "1", venue: "Arena do Grêmio", city: "Porto Alegre - RS", teamIds: [GREMIO_ID], source: GREMIO_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000015", competition: "Campeonato Gaúcho", phase: "Semifinal", date: "2026-02-15", time: "20:30", home: "Ypiranga", away: "Internacional", homeGoals: "0", awayGoals: "3", venue: "Colosso da Lagoa", city: "Erechim - RS", teamIds: [INTERNACIONAL_ID], source: INTER_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000016", competition: "Campeonato Gaúcho", phase: "Semifinal", date: "2026-02-21", time: "18:30", home: "Internacional", away: "Ypiranga", homeGoals: "4", awayGoals: "0", venue: "Beira-Rio", city: "Porto Alegre - RS", teamIds: [INTERNACIONAL_ID], source: INTER_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000017", competition: "Campeonato Gaúcho", phase: "Semifinal", date: "2026-02-22", time: "18:00", home: "Juventude", away: "Grêmio", homeGoals: "1", awayGoals: "1", venue: "Alfredo Jaconi", city: "Caxias do Sul - RS", teamIds: [GREMIO_ID], notes: ["Grêmio venceu nos pênaltis por 4 x 1."], source: GREMIO_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000018", competition: "Campeonato Gaúcho", phase: "Final", date: "2026-03-01", time: "18:00", home: "Grêmio", away: "Internacional", homeGoals: "3", awayGoals: "0", venue: "Arena do Grêmio", city: "Porto Alegre - RS", teamIds: [GREMIO_ID, INTERNACIONAL_ID], source: GREMIO_GAUCHAO_SOURCE },
  { id: "2026ba01-0000-4000-8000-000000000019", competition: "Campeonato Gaúcho", phase: "Final", date: "2026-03-08", time: "18:00", home: "Internacional", away: "Grêmio", homeGoals: "1", awayGoals: "1", venue: "Beira-Rio", city: "Porto Alegre - RS", teamIds: [GREMIO_ID, INTERNACIONAL_ID], source: INTER_GAUCHAO_SOURCE },
  { id: "2026ba03-0000-4000-8000-000000000001", competition: "CONMEBOL Sul-Americana", phase: "Fase de grupos", date: "2026-04-08", time: "21:30", home: "Montevideo City Torque", away: "Grêmio", homeGoals: "1", awayGoals: "0", venue: "Estádio Centenário", city: "Montevidéu - Uruguai", teamIds: [GREMIO_ID], source: GREMIO_SUL_AMERICANA_SOURCE },
  { id: "2026ba03-0000-4000-8000-000000000002", competition: "CONMEBOL Sul-Americana", phase: "Fase de grupos", date: "2026-04-14", time: "19:00", home: "Grêmio", away: "Defensa y Justicia", homeGoals: "1", awayGoals: "0", venue: "Arena do Grêmio", city: "Porto Alegre - RS", teamIds: [GREMIO_ID], source: GREMIO_SUL_AMERICANA_SOURCE },
  { id: "2026ba03-0000-4000-8000-000000000003", competition: "CONMEBOL Sul-Americana", phase: "Fase de grupos", date: "2026-04-29", time: "21:30", home: "Palestino", away: "Grêmio", homeGoals: "0", awayGoals: "0", venue: "Municipal de La Cisterna", city: "Santiago - Chile", teamIds: [GREMIO_ID], source: GREMIO_SUL_AMERICANA_SOURCE },
  { id: "2026ba02-0000-4000-8000-000000000001", competition: "Copa do Brasil", phase: "5ª fase", date: "2026-04-21", time: "19:30", home: "Grêmio", away: "Confiança", homeGoals: "2", awayGoals: "0", venue: "Arena do Grêmio", city: "Porto Alegre - RS", teamIds: [GREMIO_ID], source: GREMIO_COPA_DO_BRASIL_SOURCE },
  { id: "2026ba02-0000-4000-8000-000000000002", competition: "Copa do Brasil", phase: "5ª fase", date: "2026-04-22", time: "20:30", home: "Athletic-MG", away: "Internacional", homeGoals: "1", awayGoals: "2", venue: "Orlando Scarpelli", city: "Florianópolis - SC", teamIds: [INTERNACIONAL_ID], source: INTER_COPA_DO_BRASIL_SOURCE },
  { id: "2026ba03-0000-4000-8000-000000000004", competition: "CONMEBOL Sul-Americana", phase: "Fase de grupos", date: "2026-05-05", time: "19:00", home: "Defensa y Justicia", away: "Grêmio", homeGoals: "0", awayGoals: "3", venue: "Pedro Bidegain", city: "Buenos Aires - Argentina", teamIds: [GREMIO_ID], source: GREMIO_SUL_AMERICANA_SOURCE },
  { id: "2026ba04-0000-4000-8000-000000000001", competition: "Recopa Gaúcha", phase: "Final", date: "2026-05-06", time: "20:00", home: "Brasil de Pelotas", away: "Internacional", homeGoals: "1", awayGoals: "2", venue: "Bento Freitas", city: "Pelotas - RS", teamIds: [INTERNACIONAL_ID], source: RECOPA_GAUCHA_SOURCE },
  { id: "2026ba02-0000-4000-8000-000000000003", competition: "Copa do Brasil", phase: "5ª fase", date: "2026-05-12", time: "19:30", home: "Internacional", away: "Athletic-MG", homeGoals: "3", awayGoals: "2", venue: "Beira-Rio", city: "Porto Alegre - RS", teamIds: [INTERNACIONAL_ID], source: INTER_COPA_DO_BRASIL_SOURCE },
  { id: "2026ba02-0000-4000-8000-000000000004", competition: "Copa do Brasil", phase: "5ª fase", date: "2026-05-14", time: "19:00", home: "Confiança", away: "Grêmio", homeGoals: "0", awayGoals: "3", venue: "Batistão", city: "Aracaju - SE", teamIds: [GREMIO_ID], source: GREMIO_COPA_DO_BRASIL_SOURCE },
  { id: "2026ba03-0000-4000-8000-000000000005", competition: "CONMEBOL Sul-Americana", phase: "Fase de grupos", date: "2026-05-20", time: "21:00", home: "Grêmio", away: "Palestino", homeGoals: "2", awayGoals: "0", venue: "Arena do Grêmio", city: "Porto Alegre - RS", teamIds: [GREMIO_ID], source: GREMIO_SUL_AMERICANA_SOURCE },
  { id: "2026ba03-0000-4000-8000-000000000006", competition: "CONMEBOL Sul-Americana", phase: "Fase de grupos", date: "2026-05-26", time: "19:00", home: "Grêmio", away: "Montevideo City Torque", homeGoals: "2", awayGoals: "2", venue: "Arena do Grêmio", city: "Porto Alegre - RS", teamIds: [GREMIO_ID], source: GREMIO_SUL_AMERICANA_SOURCE },
  { id: "2026ba03-0000-4000-8000-000000000007", competition: "CONMEBOL Sul-Americana", phase: "Playoff das oitavas", date: "2026-07-23", time: "19:00", home: "Bolívar", away: "Grêmio", venue: "Hernando Siles", city: "La Paz - Bolívia", teamIds: [GREMIO_ID], source: GREMIO_SUL_AMERICANA_SOURCE },
  { id: "2026ba03-0000-4000-8000-000000000008", competition: "CONMEBOL Sul-Americana", phase: "Playoff das oitavas", date: "2026-07-30", time: "19:00", home: "Grêmio", away: "Bolívar", venue: "Arena do Grêmio", city: "Porto Alegre - RS", teamIds: [GREMIO_ID], source: GREMIO_SUL_AMERICANA_SOURCE },
  { id: "2026ba02-0000-4000-8000-000000000005", competition: "Copa do Brasil", phase: "Oitavas de final", date: "2026-08-02", time: "18:00", home: "Mirassol", away: "Grêmio", venue: "José Maria de Campos Maia", city: "Mirassol - SP", teamIds: [GREMIO_ID], source: GREMIO_COPA_DO_BRASIL_SOURCE },
  { id: "2026ba02-0000-4000-8000-000000000006", competition: "Copa do Brasil", phase: "Oitavas de final", date: "2026-08-02", time: "19:30", home: "Internacional", away: "Corinthians", venue: "Beira-Rio", city: "Porto Alegre - RS", teamIds: [INTERNACIONAL_ID], source: INTER_COPA_DO_BRASIL_SOURCE },
  { id: "2026ba02-0000-4000-8000-000000000007", competition: "Copa do Brasil", phase: "Oitavas de final", date: "2026-08-05", time: "19:30", home: "Grêmio", away: "Mirassol", venue: "Arena do Grêmio", city: "Porto Alegre - RS", teamIds: [GREMIO_ID], source: GREMIO_COPA_DO_BRASIL_SOURCE },
  { id: "2026ba02-0000-4000-8000-000000000008", competition: "Copa do Brasil", phase: "Oitavas de final", date: "2026-08-06", time: "20:00", home: "Corinthians", away: "Internacional", venue: "Neo Química Arena", city: "São Paulo - SP", teamIds: [INTERNACIONAL_ID], source: INTER_COPA_DO_BRASIL_SOURCE },
];

const createEvent = (match: MatchTuple): TeamMatchEvent => {
  const [id, round, date, time, home, , homeGoals, away, , awayGoals, location] = match;
  const locationParts = location.split(" - ");
  const venue = locationParts.slice(0, -2).join(" - ");
  const city = locationParts.slice(-2).join(" - ");
  const hasResult = homeGoals !== null && awayGoals !== null;
  const title = hasResult
    ? `${home} ${homeGoals} x ${awayGoals} ${away}`
    : `${home} x ${away}`;

  return { event: {
    id: `2026ba00-0000-4000-8000-${id.padStart(12, "0")}`,
    legacyIds: [`brasileirao-2026-${id}`],
    title,
    date,
    time,
    timezone: "America/Sao_Paulo",
    city,
    venue,
    phase: `Rodada ${round}`,
    competition: "Campeonato Brasileiro",
    homeTeam: home,
    awayTeam: away,
    suggestedCategoryKey: CATEGORY.key,
    source: SOURCE.label,
    sourceUrl: SOURCE.url,
    lastVerified: SOURCE.lastVerified,
    result: hasResult ? `${homeGoals} x ${awayGoals}` : undefined,
    notes: [`Referência oficial da partida: ${id}.`],
    isBrazilMatch: false,
  }, teamIds: [match[5], match[8]] };
};

const createAdditionalEvent = (match: AdditionalMatch): TeamMatchEvent => {
  const hasResult = match.homeGoals !== undefined && match.awayGoals !== undefined;
  return {
    teamIds: match.teamIds,
    event: {
      id: match.id,
      title: hasResult
        ? `${match.home} ${match.homeGoals} x ${match.awayGoals} ${match.away}`
        : `${match.home} x ${match.away}`,
      date: match.date,
      time: match.time,
      timezone: "America/Sao_Paulo",
      city: match.city,
      venue: match.venue,
      phase: match.phase,
      competition: match.competition,
      homeTeam: match.home,
      awayTeam: match.away,
      suggestedCategoryKey: CATEGORY.key,
      source: match.source.label,
      sourceUrl: match.source.url,
      lastVerified: match.source.lastVerified,
      result: hasResult ? `${match.homeGoals} x ${match.awayGoals}` : undefined,
      notes: match.notes,
      isBrazilMatch: false,
    },
  };
};

const events = [...matches.map(createEvent), ...additionalMatches.map(createAdditionalEvent)]
  .sort((left, right) =>
    `${left.event.date}T${left.event.time}`.localeCompare(
      `${right.event.date}T${right.event.time}`
    )
  );

const createPack = (
  teamId: string,
  teamName: string,
  color: string
): CalendarPack => ({
  id: `brasileirao-2026-${teamName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`,
  version: 4,
  name: `Jogos do ${teamName}`,
  eyebrow: teamName,
  icon: "soccer-ball",
  description: "Jogos oficiais de 2026 em todas as competições.",
  variantGroup: {
    id: "brasileirao-2026-by-team",
    label: "Time",
    optionLabel: teamName,
    selectionMode: "replace",
  },
  year: 2026,
  datasetStatus: "seed",
  updateNote: "Partidas concluídas e próximos jogos com data e horário oficialmente detalhados.",
  source: SOURCE,
  profile: {
    id: "2026ba00-0000-4000-8000-000000000001",
    name: `Jogos do ${teamName}`,
    icon: "calendar-days",
  },
  categories: [{
    ...CATEGORY,
    name: `Jogos do ${teamName}`,
    color,
  }],
  legacyCategoryIds: ["brasileirao-2026-category"],
  events: events
    .filter((entry) => entry.teamIds.includes(teamId))
    .map((entry) => entry.event),
});

export const brasileirao2026Packs = [
  createPack(GREMIO_ID, "Grêmio", "#2563EB"),
] as const;
