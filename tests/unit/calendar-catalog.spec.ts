import { expect, test } from "@playwright/test";
import { deterministicCalendarUuid } from "../../lib/calendar-catalog/ids";
import { diffCatalogs, incrementChangedPackVersions, materialHash } from "../../lib/calendar-catalog/material";
import { parseOfficialSource } from "../../lib/calendar-catalog/parsers";
import { validateOfficialCandidate } from "../../lib/calendar-catalog/validation";
import { applyOfficialSourceToCatalog } from "../../lib/calendar-catalog/catalog-builder";
import {
  fetchGeFootballFeed,
  missingOfficialMatchIssues,
  parseGeBootstrap,
  parseGeMatches,
  reconcileGeFootballFeed,
} from "../../lib/calendar-catalog/ge-feed";
import {
  CBF_CA_SHA256,
  CBF_SECTIGO_OV_R36_CA,
  cbfRequestOptions,
  validateCbfIntermediateCertificate,
} from "../../lib/calendar-catalog/cbf-transport";
import type { CalendarCatalogSource, OfficialCalendarEvent } from "../../lib/calendar-catalog/types";
import type { CalendarPack } from "../../lib/calendar-packs/types";
import clubs from "../../lib/calendar-packs/brazilian-clubs-2026.json";

const source = (parser_key: string): CalendarCatalogSource => ({
  id: `source-${parser_key}`, authority: "Autoridade", competition: "Competição",
  season: 2026, official_url: "https://oficial.example/calendario", parser_key,
  feed_provider: null, feed_url: null,
  rollout_status: "shadow", freshness_hours: 28, last_checked_at: null,
  last_successful_at: null, last_error: null,
});

test("parser CBF aceita a tabela oficial e descarta placeholders", () => {
  const body = JSON.stringify({ fase: { jogos: [
    { ref_jogo: "831894", rodada: "1", data: " 28/01/2026", hora: "19:00", estadio: "ARENA MRV", cidade: "Belo Horizonte", uf: "MG", mandante: { nome: "Atlético Mineiro", url_escudo: "https://conteudo.cbf.com.br/clubes/62194/escudo.jpg", gols: "2" }, visitante: { nome: "Palmeiras", url_escudo: "https://conteudo.cbf.com.br/clubes/20002/escudo.jpg", gols: "2" } },
    { ref_jogo: "999999", rodada: "38", data: " 01/01/1900", hora: null, mandante: { nome: "A", url_escudo: "https://conteudo.cbf.com.br/clubes/1/escudo.jpg" }, visitante: { nome: "B", url_escudo: "https://conteudo.cbf.com.br/clubes/2/escudo.jpg" } },
  ] } });
  const parsed = parseOfficialSource(body, "application/json", source("cbf"));
  expect(parsed).toHaveLength(1);
  expect(parsed[0]).toMatchObject({ externalId: "831894", date: "2026-01-28", time: "19:00", homeTeamId: "62194", awayTeamId: "20002", result: "2 x 2" });
});

test("transporte CBF limita host e valida a CA intermediária versionada", () => {
  expect(validateCbfIntermediateCertificate().fingerprint256).toBe(CBF_CA_SHA256);
  const options = cbfRequestOptions(new URL("https://www.cbf.com.br/api/cbf/calendario"));
  expect(options.servername).toBe("www.cbf.com.br");
  expect(options.ca).toEqual(expect.arrayContaining([CBF_SECTIGO_OV_R36_CA]));
  expect(() => cbfRequestOptions(new URL("https://cbf.example/api"))).toThrow(/cbf_tls_chain_error/);
  expect(() => validateCbfIntermediateCertificate("certificado inválido")).toThrow(/cbf_tls_chain_error/);
  expect(() => validateCbfIntermediateCertificate(CBF_SECTIGO_OV_R36_CA, "00:00"))
    .toThrow(/fingerprint.*divergente/);
});

test("parser GE descobre tabela e fases no bootstrap público", () => {
  const bootstrap = parseGeBootstrap(`<script>const contentResource = {
    const fase = {"slug":"fase-de-grupos"};
    const classificacao = {"fase":{"slug":"fase-de-grupos"},"fases_navegacao":[{"nome":"Fase de grupos","slug":"fase-de-grupos"},{"nome":"Oitavas","slug":"oitavas"}]};
    };</script><script>const x = 1; tUUID: "table-2026"</script>`);
  expect(bootstrap.tableId).toBe("table-2026");
  expect(bootstrap.phases).toEqual([
    { name: "Fase de grupos", slug: "fase-de-grupos" },
    { name: "Oitavas", slug: "oitavas" },
  ]);
});

test("parser GE aceita encerrado e pênaltis, mas ignora placar em andamento", () => {
  const geSource = { ...source("cbf"), feed_provider: "GE", feed_url: "https://ge.example/tabela" };
  const matches = parseGeMatches({ jogos: [
    { id: 101, data_realizacao: "2026-08-11T21:30", hora_realizacao: "21:30", jogo_ja_comecou: true, placar_oficial_mandante: 2, placar_oficial_visitante: 2, placar_penaltis_mandante: 5, placar_penaltis_visitante: 4, equipes: { mandante: { id: 1, nome_popular: "Palmeiras" }, visitante: { id: 2, nome_popular: "Tolima" } }, sede: { nome_popular: "Allianz Parque" }, transmissao: { broadcast: { id: "ENCERRADA" } } },
    { id: 102, data_realizacao: "2026-08-12T19:00", hora_realizacao: "19:00", jogo_ja_comecou: true, placar_oficial_mandante: 1, placar_oficial_visitante: 0, equipes: { mandante: { id: 3, nome_popular: "Flamengo" }, visitante: { id: 4, nome_popular: "Estudiantes" } }, sede: { nome_popular: "Maracanã" }, transmissao: { broadcast: { id: "AO_VIVO" } } },
  ] }, geSource, "Oitavas");
  expect(matches[0]).toMatchObject({ providerExternalId: "101", status: "finished", result: "2 x 2", penaltyResult: "5 x 4", homeTeam: "Palmeiras" });
  expect(matches[1]).toMatchObject({ providerExternalId: "102", status: "in_progress", result: undefined });
});

test("feed GE navega grupos, rodadas e mata-mata com concorrência limitada", async () => {
  const geSource = { ...source("cbf"), feed_provider: "GE", feed_url: "https://ge.example/tabela" };
  const game = (id: number) => ({ id, data_realizacao: "2026-08-11T21:30", hora_realizacao: "21:30", jogo_ja_comecou: false, equipes: { mandante: { nome_popular: "Palmeiras" }, visitante: { nome_popular: `Time ${id}` } }, sede: { nome_popular: "Estádio" } });
  const responses = new Map<string, unknown>([
    ["https://ge.example/tabela", `<script>const classificacao = {"fase":{"slug":"grupos"},"fases_navegacao":[{"nome":"Grupos","slug":"grupos"},{"nome":"Oitavas","slug":"oitavas"}]}; const resource = { tUUID: "table-1" };</script>`],
    ["https://api.globoesporte.globo.com/tabela/table-1/fase/grupos/classificacao/", { lista_tipo_unica: false, grupos: [{ grupo_id: 10, rodada: { ultima: 2 } }] }],
    ["https://api.globoesporte.globo.com/tabela/table-1/fase/grupos/rodada/1/grupo/10/jogos/", [game(1)]],
    ["https://api.globoesporte.globo.com/tabela/table-1/fase/grupos/rodada/2/grupo/10/jogos/", [game(2)]],
    ["https://api.globoesporte.globo.com/tabela/table-1/fase/oitavas/classificacao/", { secao: [{ jogos: [game(3)] }] }],
  ]);
  const fetchMock = (async (input: string | URL | Request) => {
    const url = String(input);
    const value = responses.get(url);
    if (value === undefined) return new Response("not found", { status: 404 });
    return typeof value === "string"
      ? new Response(value, { status: 200, headers: { "content-type": "text/html" } })
      : Response.json(value);
  }) as typeof fetch;
  const matches = await fetchGeFootballFeed(geSource, fetchMock);
  expect(matches.map((match) => match.providerExternalId)).toEqual(["1", "2", "3"]);
  expect(matches.find((match) => match.providerExternalId === "2")?.phase).toBe("Grupos — Rodada 2");
});

test("reconciliação preserva dados oficiais, acrescenta resultado final e isola divergência", () => {
  const geSource = { ...source("conmebol"), id: "conmebol-libertadores-2026", feed_provider: "GE", feed_url: "https://ge.example/tabela" };
  const official = event({ externalId: "official-1", homeTeam: "Palmeiras", awayTeam: "Tolima", venue: "Local oficial" });
  const officialWithoutGe = event({ externalId: "official-2", date: "2026-08-18", homeTeam: "Flamengo", awayTeam: "Estudiantes" });
  const [feed] = parseGeMatches({ jogos: [{ id: 501, data_realizacao: "2026-08-11T21:30", hora_realizacao: "21:30", jogo_ja_comecou: true, placar_oficial_mandante: 2, placar_oficial_visitante: 0, equipes: { mandante: { nome_popular: "Palmeiras" }, visitante: { nome_popular: "Tolima" } }, sede: { nome_popular: "Outro local" }, transmissao: { broadcast: { id: "ENCERRADA" } } }] }, geSource, "Oitavas");
  const reconciled = reconcileGeFootballFeed({ source: geSource, officialEvents: [official, officialWithoutGe], feedEvents: [feed] });
  expect(reconciled.reconciledEvents[0]).toMatchObject({ result: "2 x 0", resultProvider: "GE", venue: "Local oficial" });
  expect(reconciled.reconciledEvents[1]).toEqual(officialWithoutGe);
  expect(reconciled.providerMappings).toHaveLength(1);

  const conflict = reconcileGeFootballFeed({ source: geSource, officialEvents: [{ ...official, result: "1 x 0" }], feedEvents: [feed] });
  expect(conflict.issues.map((issue) => issue.code)).toContain("result_conflict");
  expect(conflict.reconciledEvents[0].result).toBe("1 x 0");

  const mappedConflict = reconcileGeFootballFeed({
    source: geSource,
    officialEvents: [official],
    feedEvents: [{ ...feed, homeTeam: "Flamengo" }],
    officialMappings: new Map([[official.externalId, "canonical-1"]]),
    geMappings: new Map([[feed.providerExternalId, "canonical-1"]]),
  });
  expect(mappedConflict.issues.map((issue) => issue.code)).toContain("participants_changed");
});

test("fixtures oficiais CONMEBOL cobrem Bahia e Botafogo sem unmatched", () => {
  const geSource = { ...source("conmebol"), id: "conmebol-libertadores-2026", feed_provider: "GE", feed_url: "https://ge.example/tabela" };
  const fixtures = [
    ["5", "Bahia", "O'Higgins", "25", "Fev", "19:00", "2nd Round", "Casa de Apostas Arena Fonte Nova", "2 - 1"],
    ["13", "O'Higgins", "Bahia", "18", "Fev", "19:00", "2nd Round", "Estadio Codelco El Teniente", "1 - 0"],
    ["3", "Botafogo", "Nacional Potosí", "25", "Fev", "21:30", "2nd Round", "Estádio Olímpico Nilton Santos", "2 - 0"],
    ["11", "Nacional Potosí", "Botafogo", "18", "Fev", "21:30", "2nd Round", "Estadio Víctor Agustín Ugarte de Potosí", "1 - 0"],
    ["714", "Barcelona", "Botafogo", "3", "Mar", "21:30", "3rd Round", "Estadio Monumental Banco Pichincha", "1 - 1"],
    ["711", "Botafogo", "Barcelona", "10", "Mar", "21:30", "3rd Round", "Estádio Olímpico Nilton Santos", "0 - 1"],
  ] as const;
  const officialEvents = fixtures.flatMap(([id, home, away, day, month, time, stage, venue, result]) => {
    const settings = { metadata: { targeting: {
      fixture_id: id,
      fixture_title: `${home} vs ${away} (Qua, ${day} ${month} 2026 - ${time})`,
      fixture_home_team_title: home,
      fixture_away_team_title: away,
      fixture_stage_title: stage,
      relations: { cc_venue_vocab: [{ label: venue }] },
    } } };
    const html = `<script type="application/json" data-drupal-selector="drupal-settings-json">${JSON.stringify(settings)}</script>
      <li class="m-match-fixture-details__list-item--full-time-score"><span class="m-match-fixture-details__list-item-value">${result}</span></li>`;
    return parseOfficialSource(html, "text/html", geSource, {
      sourceUrl: `https://gol.conmebol.com/libertadores/pt-br/fixture/view/${id}`,
    });
  });
  expect(officialEvents.map((item) => item.externalId)).toEqual([
    "fixture-5", "fixture-13", "fixture-3", "fixture-11", "fixture-714", "fixture-711",
  ]);
  expect(officialEvents[0]).toMatchObject({
    date: "2026-02-25", time: "19:00", homeTeam: "Bahia", awayTeam: "O'Higgins",
    phase: "Segunda fase", city: "Salvador", result: "2 x 1",
  });
  expect(officialEvents[3]).toMatchObject({ city: "Potosí", timezone: "America/La_Paz" });

  const feedEvents = officialEvents.map((item, index) => ({
    ...item,
    provider: "GE",
    providerExternalId: String(700 + index),
    externalId: `ge:${700 + index}`,
    status: "finished" as const,
  }));
  const reconciliation = reconcileGeFootballFeed({ source: geSource, officialEvents, feedEvents });
  expect(reconciliation.unmatchedFeedEvents).toEqual([]);
  expect(reconciliation.providerMappings).toHaveLength(6);

  const withoutOfficial = reconcileGeFootballFeed({ source: geSource, officialEvents: [], feedEvents: [feedEvents[0]] });
  expect(missingOfficialMatchIssues(withoutOfficial.unmatchedFeedEvents)).toEqual([
    expect.objectContaining({ code: "missing_official_match", eventId: "700" }),
  ]);
});

const event = (overrides: Partial<OfficialCalendarEvent> = {}): OfficialCalendarEvent => ({
  externalId: "42", competition: "Competição", season: 2026, date: "2026-08-11",
  time: "21:30", timezone: "America/Sao_Paulo", city: "São Paulo", venue: "Estádio",
  phase: "Rodada 1", homeTeam: "Time A", awayTeam: "Time B", ...overrides,
});

const pack = (version = 1, lastVerified = "2026-08-10", title = "Time A x Time B"): CalendarPack => ({
  id: "pack", version, name: "Pack", description: "Pack", icon: "calendar", year: 2026,
  datasetStatus: "complete", updateNote: "", source: { label: "Fonte", url: "https://oficial.example", lastVerified },
  profile: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", name: "Perfil", icon: "calendar-days" },
  categories: [{ id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", key: "games", name: "Jogos", color: "#000000" }],
  events: [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", title, date: "2026-08-11", time: "21:30", timezone: "America/Sao_Paulo", city: "São Paulo", venue: "Estádio", phase: "Rodada 1", homeTeam: "Time A", awayTeam: "Time B", suggestedCategoryKey: "games", source: "Fonte", sourceUrl: "https://oficial.example", lastVerified, isBrazilMatch: false }],
});

test("hash e versão ignoram lastVerified, mas reconhecem mudança material", () => {
  expect(materialHash(pack(1, "2026-08-10"))).toBe(materialHash(pack(1, "2026-08-11")));
  expect(incrementChangedPackVersions([pack(4)], [pack(1, "2026-08-11")])[0].version).toBe(4);
  expect(incrementChangedPackVersions([pack(4)], [pack(1, "2026-08-11", "Time A 1 x 0 Time B")])[0].version).toBe(5);
  expect(diffCatalogs([pack()], [pack(1, "2026-08-11")]).changed).toEqual([]);
});

test("IDs determinísticos são estáveis e isolados por autoridade", () => {
  const first = deterministicCalendarUuid("CBF", "Brasileirão", 2026, "42");
  expect(first).toBe(deterministicCalendarUuid("CBF", "Brasileirão", 2026, "42"));
  expect(first).not.toBe(deterministicCalendarUuid("FIFA", "Brasileirão", 2026, "42"));
  expect(first).toMatch(/^[0-9a-f-]{36}$/);
});

test("quarentena bloqueia vazio, remoção excessiva e troca de participantes", () => {
  expect(validateOfficialCandidate({ previous: [], candidate: [] })[0].code).toBe("empty_source");
  const previous = Array.from({ length: 60 }, (_, index) => event({ externalId: String(index) }));
  const reduced = previous.slice(0, 56);
  expect(validateOfficialCandidate({ previous, candidate: reduced }).map((issue) => issue.code)).toContain("excessive_removal");
  expect(validateOfficialCandidate({ previous: [event()], candidate: [event({ awayTeam: "Time C" })] }).map((issue) => issue.code)).toContain("participants_changed");
  expect(validateOfficialCandidate({ previous: [event({ placeholder: true })], candidate: [event({ awayTeam: "Time C" })] })).toEqual([]);
});

test("parser normaliza contrato CONMEBOL/FIFA", () => {
  for (const parser of ["conmebol", "fifa"]) {
    const events = parseOfficialSource(JSON.stringify({ matches: [{ id: 42, date: "2026-08-11", time: "21:30", homeTeam: { id: 1, name: "Time A" }, awayTeam: { id: 2, name: "Time B" }, homeScore: 2, awayScore: 1, venue: { name: "Estádio", city: "São Paulo" }, round: "Oitavas" }] }), "application/json", source(parser));
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ externalId: "42", result: "2 x 1", homeTeam: "Time A", awayTeam: "Time B" });
  }
});

test("parser CONMEBOL reconhece fase de grupos, mata-mata e aliases", () => {
  const conmebol = { ...source("conmebol"), id: "conmebol-sudamericana-2026", competition: "CONMEBOL Sul-Americana" };
  const group = parseOfficialSource(
    '<h2><strong>FECHA 1</strong></h2><p><strong><u>Miércoles, 08 de abril</u></strong></p><p><strong>21:30h - Montevideo City Torque (URU) vs Gremio (BRA)</strong> - Grupo F - Estadio Centenario, Montevideo</p>',
    "text/html", conmebol
  );
  expect(group[0]).toMatchObject({ date: "2026-04-08", time: "21:30", awayTeam: "Grêmio", awayTeamId: "20013", phase: "Fase de grupos — Rodada 1" });

  const knockout = parseOfficialSource(
    '<h1>CALENDÁRIO DOS PLAYOFFS</h1><h2><strong>Sporting Cristal x RB Bragantino</strong></h2><p>Ida: quarta-feira, 22/7, às 19h30, no Estádio Nacional do Peru, Lima</p><p>Volta: quarta-feira, 29/7, às 21h30, no Estádio Municipal Cícero de Souza Marques, Bragança Paulista</p>',
    "text/html", conmebol
  );
  expect(knockout).toHaveLength(2);
  expect(knockout[1]).toMatchObject({ homeTeam: "Red Bull Bragantino", homeTeamId: "20007", phase: "Playoff das oitavas" });
});

test("atualizar uma fonte preserva as outras competições do clube", () => {
  const brasileirao = { ...source("cbf"), id: "cbf-brasileirao-2026", competition: "Campeonato Brasileiro Serie A" };
  const copa = { ...source("cbf"), id: "cbf-copa-do-brasil-2026", competition: "Copa do Brasil" };
  const conmebol = { ...source("conmebol"), id: "conmebol-libertadores-2026", competition: "CONMEBOL Libertadores" };
  let packs = applyOfficialSourceToCatalog([], brasileirao, [event({ externalId: "1", homeTeam: "Palmeiras", awayTeam: "Corinthians" })]);
  packs = applyOfficialSourceToCatalog(packs, copa, [event({ externalId: "2", competition: copa.competition, homeTeam: "Palmeiras", awayTeam: "Remo" })]);
  packs = applyOfficialSourceToCatalog(packs, conmebol, [event({ externalId: "3", competition: conmebol.competition, homeTeam: "Palmeiras", awayTeam: "Junior" })]);
  packs = applyOfficialSourceToCatalog(packs, copa, [event({ externalId: "2", competition: copa.competition, homeTeam: "Palmeiras", awayTeam: "Remo", result: "2 x 0" })]);
  const palmeiras = packs.find((candidate) => candidate.variantGroup?.optionLabel === "Palmeiras")!;
  expect(new Set(palmeiras.events.map((item) => item.competition))).toEqual(new Set([
    brasileirao.competition, copa.competition, conmebol.competition,
  ]));
  expect(palmeiras.events.find((item) => item.competition === copa.competition)?.result).toBe("2 x 0");
});

test("parser normaliza contratos de F1 e feriados governamentais", () => {
  const f1 = parseOfficialSource(JSON.stringify({ races: [{ round: 1, startDate: "2026-03-08T15:00:00", raceName: "GP da Austrália", circuit: "Albert Park" }] }), "application/json", source("formula1"));
  expect(f1[0]).toMatchObject({ externalId: "1", homeTeam: "GP da Austrália", awayTeam: "Fórmula 1" });
  const holidays = parseOfficialSource(JSON.stringify({ holidays: [{ date: "2026-09-07", name: "Independência do Brasil" }] }), "application/json", source("government_holidays"));
  expect(holidays[0]).toMatchObject({ homeTeam: "Independência do Brasil", awayTeam: "Feriado" });
});

test("parser reconhece os cards HTML do calendário oficial da F1", () => {
  const html = `<a class="group" href="/en/racing/2026/australia"><span>ROUND 1</span><span>06 - 08 Mar</span><p>Australia</p><span>FORMULA 1 QATAR AIRWAYS AUSTRALIAN GRAND PRIX 2026</span></a>`;
  expect(parseOfficialSource(html, "text/html", source("formula1"))[0]).toMatchObject({
    externalId: "1", date: "2026-03-08", homeTeam: "Australia",
  });
});

test("uma carga oficial do Brasileirão produz as 20 opções de clubes sem deploy", () => {
  const teams = clubs.map((club) => club.name);
  const matches = Array.from({ length: 10 }, (_, index) => event({
    externalId: String(100 + index), homeTeam: teams[index * 2], awayTeam: teams[index * 2 + 1],
  }));
  const result = applyOfficialSourceToCatalog([], { ...source("cbf"), id: "cbf-brasileirao-2026" }, matches);
  expect(result).toHaveLength(20);
  expect(new Set(result.map((candidate) => candidate.variantGroup?.optionLabel)).size).toBe(20);
});
