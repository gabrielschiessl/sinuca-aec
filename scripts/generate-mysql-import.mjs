import fs from "node:fs";
import path from "node:path";

const [, , inputArgument, outputArgument] = process.argv;
if (!inputArgument) {
  console.error("Uso: node scripts/generate-mysql-import.mjs snapshot.json [import.sql]");
  process.exit(1);
}

const inputPath = path.resolve(inputArgument);
const outputPath = path.resolve(outputArgument || "database/import_generated.sql");
const snapshot = JSON.parse(fs.readFileSync(inputPath, "utf8"));
if (snapshot.formato !== "aec-sinuca-mysql-snapshot" || snapshot.versao !== 1) {
  throw new Error("O arquivo informado não é um snapshot compatível.");
}

const tables = snapshot.tabelas || {};
const seasonsSource = tables.temporadas || [];
const playersSource = tables.jogadores || [];
const publishedParticipants = tables.participantes || [];
const publishedMatches = tables.rodadas || [];
const draftParticipants = tables.temporadas_participantes || [];
const draftMatches = tables.temporadas_rodadas || [];
const lines = [
  "SET NAMES utf8mb4;",
  "SET time_zone = '+00:00';",
  "START TRANSACTION;",
  "",
];

const sql = (value) => {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
};
const integer = (value, fallback = null) => {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
};
const division = (value) => String(value || "").trim().toUpperCase();
const score = (value) => {
  const text = String(value ?? "").trim();
  return ["0", "1", "2"].includes(text) ? Number(text) : null;
};
const date = (value) => {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : null;
};
const time = (value) => {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  return match ? `${match[1].padStart(2, "0")}:${match[2]}:00` : null;
};
const key = (...values) => values.join("|");

const currentSeason = integer(snapshot.temporada_atual);
for (const setting of tables.configuracao || []) {
  if (!setting.chave) continue;
  lines.push(
    `INSERT INTO settings (setting_key, setting_value) VALUES (${sql(setting.chave)}, ${sql(setting.valor ?? "")});`,
  );
}
if (currentSeason && !(tables.configuracao || []).some((item) => item.chave === "temporada_atual")) {
  lines.push(
    `INSERT INTO settings (setting_key, setting_value) VALUES ('temporada_atual', '${currentSeason}');`,
  );
}
lines.push("");

for (const player of playersSource) {
  const id = integer(player.id);
  if (!id) continue;
  const name = String(player.nome || "").trim();
  const displayName = String(player.exibicao || name).trim();
  const nickname = String(player.apelido || displayName).trim();
  const active = String(player.ativo || "").trim().toUpperCase() === "S" ? 1 : 0;
  lines.push(
    `INSERT INTO players (id, name, display_name, nickname, active) VALUES (${id}, ${sql(name)}, ${sql(displayName)}, ${sql(nickname)}, ${active});`,
  );
}
lines.push("");

const seasons = seasonsSource
  .map((item) => ({
    year: integer(item.temporada),
    version: integer(item.versao, 1),
    status: String(item.status || "").trim().toUpperCase(),
    origin: ["ATUAL", "LEGADA"].includes(String(item.tipo || "").trim().toUpperCase())
      ? "LEGADA" : "CRIADA",
  }))
  .filter((item) => item.year)
  .sort((a, b) => a.year - b.year);
const seasonIds = new Map();
seasons.forEach((season, index) => {
  const id = index + 1;
  seasonIds.set(season.year, id);
  lines.push(
    `INSERT INTO seasons (id, year, version, status, origin) VALUES (${id}, ${season.year}, ${season.version}, ${sql(season.status)}, ${sql(season.origin)});`,
  );
});
lines.push("");

const selectedParticipants = [];
const selectedMatches = [];
for (const season of seasons) {
  const participantSource = season.status === "PREPARACAO" ? draftParticipants : publishedParticipants;
  const matchSource = season.status === "PREPARACAO" ? draftMatches : publishedMatches;
  selectedParticipants.push(...participantSource.filter((item) =>
    integer(item.temporada) === season.year &&
    (season.status !== "PREPARACAO" || integer(item.versao, 1) === season.version)
  ));
  selectedMatches.push(...matchSource.filter((item) =>
    integer(item.temporada) === season.year &&
    (season.status !== "PREPARACAO" || integer(item.versao, 1) === season.version)
  ));
}

const divisionKeys = new Set();
for (const participant of selectedParticipants) {
  const year = integer(participant.temporada);
  const div = division(participant.divisao);
  if (seasonIds.has(year) && ["A", "B"].includes(div)) divisionKeys.add(key(year, div));
}
for (const match of selectedMatches) {
  const year = integer(match.temporada);
  const div = division(match.divisao);
  if (seasonIds.has(year) && ["A", "B"].includes(div)) divisionKeys.add(key(year, div));
}
for (const value of [...divisionKeys].sort()) {
  const [yearText, div] = value.split("|");
  lines.push(`INSERT INTO season_divisions (season_id, division) VALUES (${seasonIds.get(Number(yearText))}, ${sql(div)});`);
}
lines.push("");

const participantIds = new Map();
selectedParticipants
  .sort((a, b) => integer(a.temporada) - integer(b.temporada) || division(a.divisao).localeCompare(division(b.divisao)) || integer(a.numero) - integer(b.numero))
  .forEach((participant, index) => {
    const id = index + 1;
    const year = integer(participant.temporada);
    const div = division(participant.divisao);
    const number = integer(participant.numero);
    const playerId = integer(participant.jogador_id);
    const priority = integer(participant.desempate);
    if (!seasonIds.has(year) || !["A", "B"].includes(div) || !number || !playerId) return;
    participantIds.set(key(year, div, number), id);
    lines.push(
      `INSERT INTO participants (id, season_id, division, number, player_id, tiebreak_priority) VALUES (${id}, ${seasonIds.get(year)}, ${sql(div)}, ${number}, ${playerId}, ${priority || "NULL"});`,
    );
  });
lines.push("");

const roundGroups = new Map();
for (const match of selectedMatches) {
  const year = integer(match.temporada);
  const div = division(match.divisao);
  const roundNumber = integer(match.rodada);
  if (!seasonIds.has(year) || !["A", "B"].includes(div) || !roundNumber) continue;
  const roundKey = key(year, div, roundNumber);
  if (!roundGroups.has(roundKey)) roundGroups.set(roundKey, []);
  roundGroups.get(roundKey).push(match);
}

const roundIds = new Map();
let roundId = 1;
let matchId = 1;
for (const [roundKey, matches] of [...roundGroups].sort(([a], [b]) => a.localeCompare(b, "pt-BR", { numeric: true }))) {
  const [yearText, div, roundText] = roundKey.split("|");
  const year = Number(yearText);
  const roundNumber = Number(roundText);
  const numbers = selectedParticipants
    .filter((item) => integer(item.temporada) === year && division(item.divisao) === div)
    .map((item) => integer(item.numero))
    .filter(Boolean);
  const used = new Set(matches.flatMap((item) => [integer(item.numero1), integer(item.numero2)]));
  const informedBye = integer(matches.find((item) => integer(item.folga))?.folga);
  const byeNumber = informedBye || (numbers.length % 2 === 1 ? numbers.find((number) => !used.has(number)) : null);
  const byeId = byeNumber ? participantIds.get(key(year, div, byeNumber)) : null;
  const roundDate = date(matches[0]?.data);
  const roundTime = time(matches[0]?.hora);
  roundIds.set(roundKey, roundId);
  lines.push(
    `INSERT INTO rounds (id, season_id, division, number, type, scheduled_date, scheduled_time, bye_participant_id) VALUES (${roundId}, ${seasonIds.get(year)}, ${sql(div)}, ${roundNumber}, 'REGULAR', ${sql(roundDate)}, ${sql(roundTime)}, ${byeId || "NULL"});`,
  );
  matches.forEach((match, index) => {
    const number1 = integer(match.numero1);
    const number2 = integer(match.numero2);
    const participant1 = participantIds.get(key(year, div, number1));
    const participant2 = participantIds.get(key(year, div, number2));
    if (!participant1 || !participant2) {
      throw new Error(`Partida sem participante correspondente: ${year} Série ${div}, rodada ${roundNumber}, ${number1} x ${number2}.`);
    }
    const status = String(match.status || "A").trim().toUpperCase();
    lines.push(
      `INSERT INTO matches (id, round_id, match_order, participant1_id, participant2_id, scheduled_date, scheduled_time, status, score1, score2, notes) VALUES (${matchId++}, ${roundId}, ${index + 1}, ${participant1}, ${participant2}, ${sql(date(match.data))}, ${sql(time(match.hora))}, ${sql(status)}, ${score(match.placar1) ?? "NULL"}, ${score(match.placar2) ?? "NULL"}, ${sql(String(match.observacao || "").trim())});`,
    );
  });
  roundId++;
}

lines.push("", "COMMIT;", "");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
console.log(`SQL criado em ${outputPath}`);
console.log(`${playersSource.length} jogadores, ${seasons.length} temporadas, ${participantIds.size} participantes, ${matchId - 1} partidas.`);

