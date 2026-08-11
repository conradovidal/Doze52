import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const PUBLIC_URL = "https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/2026?documento=Tabela%20Detalhada";
const FETCH_URL = "https://www.cbf.com.br/api/cbf/jogos/tabela-detalhada/campeonato/1260611";
const verifiedAt = process.argv.find((argument) => argument.startsWith("--verified-at="))?.split("=")[1];

if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt ?? "")) {
  throw new Error("Use --verified-at=AAAA-MM-DD.");
}

const payload = JSON.parse(execFileSync("curl", [
  "--fail", "--location", "--compressed", "--silent", "--show-error",
  "--user-agent", "Doze52-Calendar-Updater/1.0 (+https://doze52.com)", FETCH_URL,
], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 }));

const teamId = (url) => String(url ?? "").match(/\/clubes\/(\d+)\/escudo/i)?.[1] ?? "";
const isoDate = (value) => {
  const match = String(value ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
};

const rawGames = Object.values(payload).flatMap((phase) => Array.isArray(phase?.jogos) ? phase.jogos : []);
if (rawGames.length !== 380) throw new Error(`Esperadas 380 partidas; recebidas ${rawGames.length}.`);

const events = rawGames.flatMap((game) => {
  const date = isoDate(game.data);
  const time = String(game.hora ?? "").trim();
  const homeTeamId = teamId(game.mandante?.url_escudo);
  const awayTeamId = teamId(game.visitante?.url_escudo);
  if (!date || date === "1900-01-01" || !/^\d{2}:\d{2}$/.test(time) || !game.ref_jogo || !homeTeamId || !awayTeamId) return [];
  return [{
    externalId: String(game.ref_jogo), round: Number(game.rodada), date, time,
    homeTeam: String(game.mandante.nome).trim(), homeTeamId,
    homeGoals: game.mandante.gols === null || game.mandante.gols === "" ? null : String(game.mandante.gols),
    awayTeam: String(game.visitante.nome).trim(), awayTeamId,
    awayGoals: game.visitante.gols === null || game.visitante.gols === "" ? null : String(game.visitante.gols),
    venue: String(game.estadio ?? "").trim(), city: String(game.cidade ?? "").trim(), state: String(game.uf ?? "").trim(),
  }];
}).sort((left, right) => `${left.date}T${left.time}:${left.externalId}`.localeCompare(`${right.date}T${right.time}:${right.externalId}`));

const teams = new Set(events.flatMap((event) => [event.homeTeamId, event.awayTeamId]));
if (events.length !== 235 || teams.size !== 20) throw new Error(`Seed inesperado: ${events.length} partidas e ${teams.size} clubes.`);

const output = { source: { label: "Tabela detalhada oficial da CBF", url: PUBLIC_URL, fetchUrl: FETCH_URL, lastVerified: verifiedAt }, events };
writeFileSync(resolve("lib/calendar-packs/brasileirao-2026-seed.json"), `${JSON.stringify(output, null, 2)}\n`);
console.log(`Seed gerado: ${events.length} partidas, ${teams.size} clubes.`);
