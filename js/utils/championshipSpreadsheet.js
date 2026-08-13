import { withBasePath } from "../config.js";

let excelLibraryPromise;

export async function exportChampionshipSpreadsheet(data, options) {
  const ExcelJS = await loadExcelLibrary();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Sistema AEC Sinuca";
  workbook.created = new Date();
  const context = {
    workbook,
    data,
    manual: options.version === "manual",
    logos: await loadLogos(workbook),
  };
  const selected = new Set(options.sheets);
  if (selected.has("jogadores")) addPlayersSheet(context);
  if (selected.has("inscricao")) addRegistrationSheet(context);
  if (!context.manual && selected.has("classificacao")) addClassificationSheet(context);
  if (selected.has("vitorias")) addStatisticGridSheet(context, "Vitórias", "vitorias");
  if (selected.has("resultados")) addResultsSheet(context);
  if (selected.has("partidas")) addStatisticGridSheet(context, "Partidas vencidas", "partidas_vencidas");
  if (selected.has("rodadas")) addRoundSheets(context);
  if (selected.has("individuais")) addIndividualSheets(context);
  if (!workbook.worksheets.length) throw new Error("Selecione ao menos uma folha para gerar a planilha.");
  const buffer = await workbook.xlsx.writeBuffer();
  const suffix = context.manual ? "manual" : "atualizada";
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `AEC-Sinuca-${data.temporada}-Serie-${data.divisao}-${suffix}.xlsx`,
  );
}

function loadExcelLibrary() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (excelLibraryPromise) return excelLibraryPromise;
  excelLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js";
    script.onload = () => resolve(window.ExcelJS);
    script.onerror = () => reject(new Error("Não foi possível carregar o gerador de planilhas."));
    document.head.appendChild(script);
  });
  return excelLibraryPromise;
}

async function loadLogos(workbook) {
  const [aec, snooker] = await Promise.all([
    fetchAsBase64(withBasePath("/assets/images/logo_grena.png")),
    fetchAsBase64(withBasePath("/assets/images/esporte_grena.png")),
  ]);
  return {
    aec: workbook.addImage({ base64: aec, extension: "png" }),
    snooker: workbook.addImage({ base64: snooker, extension: "png" }),
  };
}

async function fetchAsBase64(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Não foi possível carregar as logos da planilha.");
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

const COLORS = { wine: "6B2946", light: "F3E8ED", green: "92D050", red: "FF5959", gray: "D9D9D9", orange: "F4B183" };
const border = { style: "thin", color: { argb: "777777" } };

function baseSheet(context, name, orientation = "landscape") {
  const sheet = context.workbook.addWorksheet(name, {
    pageSetup: { paperSize: 9, orientation, fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0, footer: 0 } },
    views: [{ showGridLines: false }],
  });
  sheet.pageSetup.horizontalCentered = true;
  return sheet;
}

function addHeader(context, sheet, title, endColumn) {
  const end = columnLetter(endColumn);
  sheet.mergeCells(`A1:${end}2`);
  const cell = sheet.getCell("A1");
  cell.value = title;
  cell.font = { bold: true, size: 16, color: { argb: COLORS.wine } };
  cell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.addImage(context.logos.aec, { tl: { col: 0, row: 0 }, ext: { width: 90, height: 39 } });
  sheet.addImage(context.logos.snooker, { tl: { col: Math.max(1, endColumn - 2), row: 0 }, ext: { width: 100, height: 35 } });
  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 30;
}

function eachCell(sheet, startRow, startCol, endRow, endCol, callback) {
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) callback(sheet.getCell(row, col));
  }
}

function styleTable(sheet, startRow, startCol, endRow, endCol) {
  eachCell(sheet, startRow, startCol, endRow, endCol, (cell) => {
    cell.border = { top: border, left: border, right: border, bottom: border };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
}

function addPlayersSheet(context) {
  const { data } = context;
  const sheet = baseSheet(context, "Jogadores", "portrait");
  addHeader(context, sheet, `Jogadores Série ${data.divisao} - ${data.temporada}`, 4);
  sheet.addRow([]); sheet.addRow(["Nº", "Nome do jogador"]);
  data.participantes.forEach((player) => sheet.addRow([player.numero, player.exibicao]));
  sheet.mergeCells("B4:D4");
  for (let row = 5; row <= data.participantes.length + 4; row++) sheet.mergeCells(`B${row}:D${row}`);
  styleTable(sheet, 4, 1, data.participantes.length + 4, 4);
  sheet.getRow(4).font = { bold: true };
  sheet.columns = [{ width: 8 }, { width: 18 }, { width: 18 }, { width: 18 }];
  sheet.getColumn(1).alignment = { horizontal: "center" };
}

function addRegistrationSheet(context) {
  const { data } = context;
  const sheet = baseSheet(context, "Ficha de inscrição", "portrait");
  addHeader(context, sheet, `CAMPEONATO DE SINUCA SÉRIE ${data.divisao} - AEC ${data.temporada}\nFICHA DE INSCRIÇÃO${data.taxa_inscricao == null ? "" : `\nR$ ${Number(data.taxa_inscricao).toFixed(2).replace(".", ",")}`}`, 7);
  sheet.getRow(1).height = 42;
  sheet.addRow([]);
  sheet.addRow(["Nº", "NOME DOS JOGADORES", "", "COTA", "TELEFONE", "", "FORMA DE PAGAMENTO"]);
  sheet.mergeCells("B4:C4"); sheet.mergeCells("E4:F4");
  data.participantes.forEach((player, index) => {
    const row = index + 5;
    sheet.getCell(row, 1).value = player.numero;
    sheet.getCell(row, 2).value = player.exibicao;
    sheet.mergeCells(`B${row}:C${row}`); sheet.mergeCells(`E${row}:F${row}`);
    sheet.getRow(row).height = 24;
  });
  styleTable(sheet, 4, 1, data.participantes.length + 4, 7);
  sheet.getRow(4).font = { bold: true };
  [7, 19, 19, 11, 14, 10, 22].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
}

function addClassificationSheet(context) {
  const { data } = context;
  const players = data.estatisticas.classificacao;
  const rounds = data.estatisticas.total_rodadas;
  const sheet = baseSheet(context, "Classificação");
  const columns = 5 + rounds;
  addHeader(context, sheet, `Classificação Série ${data.divisao} - ${data.temporada}`, columns);
  const headers = ["Posição", "Nº", "Jogador", "Vitórias", "Partidas", ...Array.from({ length: rounds }, (_, index) => index + 1)];
  sheet.addRow(headers);
  players.forEach((player) => {
    const byRound = new Map(player.resultados.map((result) => [Number(result.rodada), result.resultado]));
    sheet.addRow([`${player.posicao}º`, player.numero, player.exibicao, player.vitorias, player.partidas_vencidas, ...Array.from({ length: rounds }, (_, index) => byRound.get(index + 1) || "")]);
  });
  const lastRow = players.length + 3;
  styleTable(sheet, 3, 1, lastRow, columns);
  sheet.getRow(3).font = { bold: true };
  sheet.getRow(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.light } };
  players.forEach((player, index) => {
    const row = index + 4;
    if (player.zona === "lider" || player.zona === "acesso") eachCell(sheet, row, 1, row, 3, (cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.green } }; });
    if (player.zona === "rebaixamento") eachCell(sheet, row, 1, row, 3, (cell) => { cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.red } }; });
    for (let col = 6; col <= columns; col++) colorResult(sheet.getCell(row, col));
  });
  setStatisticWidths(sheet, columns);
}

function addStatisticGridSheet(context, title, field) {
  const { data, manual } = context;
  const players = data.estatisticas.jogadores;
  const max = Math.max(1, ...players.map((player) => Number(player[field]) || 0));
  const slots = manual ? Math.max(1, data.estatisticas.total_rodadas) : max;
  const sheet = baseSheet(context, title);
  const columns = 2 + slots;
  addHeader(context, sheet, `${title} — Série ${data.divisao} - ${data.temporada}`, columns);
  sheet.addRow(["Nº", "Jogador", ...Array.from({ length: slots }, (_, index) => index + 1)]);
  players.forEach((player) => {
    const total = manual ? 0 : Number(player[field]) || 0;
    sheet.addRow([player.numero, player.exibicao, ...Array.from({ length: slots }, (_, index) => index < total ? "V" : "")]);
  });
  styleTable(sheet, 3, 1, players.length + 3, columns);
  sheet.getRow(3).font = { bold: true };
  if (!manual) eachCell(sheet, 4, 3, players.length + 3, columns, colorResult);
  setStatisticWidths(sheet, columns);
}

function addResultsSheet(context) {
  const { data, manual } = context;
  const players = data.estatisticas.jogadores;
  const rounds = data.estatisticas.total_rodadas;
  const sheet = baseSheet(context, "Resultados");
  const columns = 2 + rounds;
  addHeader(context, sheet, `Resultados Série ${data.divisao} - ${data.temporada}`, columns);
  sheet.addRow(["Nº", "Jogador", ...Array.from({ length: rounds }, (_, index) => index + 1)]);
  players.forEach((player) => {
    const byRound = new Map(player.resultados.map((result) => [Number(result.rodada), result.resultado]));
    sheet.addRow([player.numero, player.exibicao, ...Array.from({ length: rounds }, (_, index) => manual ? "" : byRound.get(index + 1) || "")]);
  });
  styleTable(sheet, 3, 1, players.length + 3, columns);
  sheet.getRow(3).font = { bold: true };
  if (!manual) eachCell(sheet, 4, 3, players.length + 3, columns, colorResult);
  setStatisticWidths(sheet, columns);
}

function addRoundSheets(context) {
  const chunks = chunk(context.data.rodadas, 4);
  chunks.forEach((rounds) => {
    const first = rounds[0].rodada;
    const last = rounds[rounds.length - 1].rodada;
    const sheet = baseSheet(context, first === last ? `Rodada ${first}` : `Rodadas ${first}-${last}`);
    addHeader(context, sheet, `Campeonato de Sinuca Série ${context.data.divisao} - ${context.data.temporada}\n${first === last ? ordinal(first) : `Rodadas ${first} a ${last}`}`, 15);
    rounds.forEach((round, index) => renderRoundBlock(context, sheet, round, index));
  });
}

function renderRoundBlock(context, sheet, round, index) {
  const startRow = 4 + Math.floor(index / 2) * 15;
  const startCol = index % 2 === 0 ? 1 : 9;
  const endCol = startCol + 6;
  sheet.mergeCells(startRow, startCol, startRow, endCol);
  const title = sheet.getCell(startRow, startCol);
  title.value = `${ordinal(round.rodada)} Rodada`;
  title.font = { bold: true };
  title.alignment = { horizontal: "center" };
  const maxMatches = Math.max(round.partidas.length, 1);
  for (let i = 0; i < maxMatches; i++) {
    const row = startRow + 1 + i;
    const match = round.partidas[i];
    if (match) {
      const [score1, score2] = context.manual ? ["", ""] : displayScores(match);
      sheet.getCell(row, startCol).value = i === 0 ? formatSchedule(round, match) : "";
      sheet.getCell(row, startCol + 1).value = match.numero1;
      sheet.getCell(row, startCol + 2).value = match.jogador1.exibicao;
      sheet.getCell(row, startCol + 3).value = score1;
      sheet.getCell(row, startCol + 4).value = "X";
      sheet.getCell(row, startCol + 5).value = score2;
      sheet.getCell(row, startCol + 6).value = `${match.jogador2.exibicao}  ${match.numero2}`;
    }
  }
  if (round.jogador_folga) {
    const row = startRow + 1 + maxMatches;
    sheet.getCell(row, startCol + 1).value = round.jogador_folga.numero;
    sheet.getCell(row, startCol + 2).value = round.jogador_folga.exibicao;
    sheet.mergeCells(row, startCol + 3, row, endCol);
    sheet.getCell(row, startCol + 3).value = "FOLGA";
  }
  const bottom = startRow + maxMatches + (round.jogador_folga ? 1 : 0);
  styleTable(sheet, startRow, startCol, bottom, endCol);
  sheet.getColumn(startCol).width = 13;
  sheet.getColumn(startCol + 1).width = 5;
  sheet.getColumn(startCol + 2).width = 16;
  sheet.getColumn(startCol + 3).width = 6;
  sheet.getColumn(startCol + 4).width = 4;
  sheet.getColumn(startCol + 5).width = 6;
  sheet.getColumn(startCol + 6).width = 19;
}

function addIndividualSheets(context) {
  chunk(context.data.participantes, 4).forEach((players, pageIndex) => {
    const sheet = baseSheet(context, `Fichas ${pageIndex * 4 + 1}-${pageIndex * 4 + players.length}`);
    sheet.mergeCells("A1:M1");
    sheet.getCell("A1").value = `HISTÓRICO DE RESULTADOS DOS JOGADORES — SÉRIE ${context.data.divisao} — ${context.data.temporada}`;
    sheet.getCell("A1").font = { bold: true, size: 13 };
    sheet.getCell("A1").alignment = { horizontal: "center" };
    players.forEach((player, index) => renderIndividualPlayer(context, sheet, player, index));
    sheet.getColumn(1).width = 5;
    for (let col = 2; col <= 13; col++) sheet.getColumn(col).width = col % 3 === 2 ? 11 : 9;
  });
}

function renderIndividualPlayer(context, sheet, player, index) {
  const startCol = 2 + index * 3;
  sheet.mergeCells(2, startCol, 2, startCol + 2);
  sheet.getCell(2, startCol).value = `${player.numero}º - ${player.exibicao}`;
  sheet.getCell(2, startCol).font = { bold: true };
  sheet.getCell(2, startCol).alignment = { horizontal: "center" };
  sheet.getCell(3, startCol).value = "VITÓRIA";
  sheet.getCell(3, startCol + 2).value = "DERROTA";
  const results = new Map((context.data.estatisticas.jogadores.find((item) => item.numero === player.numero)?.resultados || []).map((result) => [Number(result.rodada), result]));
  for (let round = 1; round <= 19; round++) {
    const top = 4 + (round - 1) * 3;
    sheet.mergeCells(top, startCol, top, startCol + 2);
    sheet.mergeCells(top + 1, startCol, top + 1, startCol + 2);
    sheet.mergeCells(top + 2, startCol, top + 2, startCol + 2);
    const result = context.manual ? null : results.get(round);
    if (result) {
      const match = findPlayerMatch(context.data.rodadas, round, player.numero);
      sheet.getCell(top, startCol).value = match?.data || "";
      sheet.getCell(top + 1, result.resultado === "V" ? startCol : startCol + 2).value = perspectiveScore(match, player.numero);
      sheet.getCell(top + 2, startCol).value = result.adversario.exibicao;
      sheet.getCell(top + 1, result.resultado === "V" ? startCol : startCol + 2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: result.resultado === "V" ? COLORS.green : COLORS.orange } };
    }
    sheet.getCell(top - 1, 1).value = round;
    styleTable(sheet, top, startCol, top + 2, startCol + 2);
  }
}

function findPlayerMatch(rounds, roundNumber, playerNumber) {
  return rounds.find((round) => Number(round.rodada) === roundNumber)?.partidas
    .find((match) => Number(match.numero1) === playerNumber || Number(match.numero2) === playerNumber);
}

function perspectiveScore(match, playerNumber) {
  if (!match) return "";
  const scores = displayScores(match);
  return Number(match.numero1) === playerNumber ? `${scores[0]} x ${scores[1]}` : `${scores[1]} x ${scores[0]}`;
}

function displayScores(match) {
  const note = String(match.observacao || "");
  if (/ambos abandonaram/i.test(note)) return ["W", "W"];
  if (/^W\.O\.:/i.test(note)) {
    const loser = note.replace(/^W\.O\.:\s*/i, "").trim().toLocaleLowerCase("pt-BR");
    if (String(match.jogador1.exibicao).toLocaleLowerCase("pt-BR") === loser) return ["0", "W"];
    return ["W", "0"];
  }
  return [match.placar1 === "-" ? "" : match.placar1, match.placar2 === "-" ? "" : match.placar2];
}

function formatSchedule(round, match) {
  const value = match.data || round.data || "";
  const text = String(value);
  const brazilian = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = brazilian
    ? new Date(Number(brazilian[3]), Number(brazilian[2]) - 1, Number(brazilian[1]))
    : iso
      ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
      : null;
  const displayDate = iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : text;
  const weekday = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("pt-BR", { weekday: "long" }).toUpperCase() : "";
  return [displayDate, match.hora || round.hora || "", weekday].filter(Boolean).join("\n");
}

function colorResult(cell) {
  if (cell.value === "V") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.green } };
  if (cell.value === "D") cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.red } };
}

function setStatisticWidths(sheet, columns) {
  sheet.getColumn(1).width = 10;
  sheet.getColumn(2).width = 20;
  for (let col = 3; col <= columns; col++) sheet.getColumn(col).width = 5;
}

function ordinal(number) {
  const names = ["Primeira", "Segunda", "Terceira", "Quarta", "Quinta", "Sexta", "Sétima", "Oitava", "Nona", "Décima", "Décima Primeira", "Décima Segunda", "Décima Terceira", "Décima Quarta", "Décima Quinta", "Décima Sexta", "Décima Sétima", "Décima Oitava", "Décima Nona"];
  return names[number - 1] || `${number}ª`;
}

function chunk(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));
}

function columnLetter(number) {
  let result = "";
  for (let current = number; current > 0; current = Math.floor((current - 1) / 26)) result = String.fromCharCode(65 + ((current - 1) % 26)) + result;
  return result;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
