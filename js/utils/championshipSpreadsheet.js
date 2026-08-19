import { withBasePath } from "../config.js";

let excelLibraryPromise;

export async function exportChampionshipSpreadsheet(data, options) {
  const { workbook, context } = await buildChampionshipWorkbook(data, options);
  const buffer = await workbook.xlsx.writeBuffer();
  const suffix = context.manual ? "manual" : "atualizada";
  downloadBlob(
    new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    `AEC-Sinuca-${data.temporada}-Serie-${data.divisao}-${suffix}.xlsx`,
  );
}

async function buildChampionshipWorkbook(data, options) {
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
  if (!context.manual && selected.has("classificacao-simples")) addSimpleClassificationSheet(context);
  if (!context.manual && selected.has("classificacao")) addClassificationSheet(context);
  if (selected.has("vitorias")) addVictoriesSheet(context);
  if (!context.manual && selected.has("resultados")) addResultsSheet(context);
  if (selected.has("partidas")) addWonMatchesSheet(context);
  if (!context.manual && String(data.divisao).toUpperCase() === "A" && selected.has("ranking")) addRankingSheet(context);
  if (selected.has("rodadas")) addRoundSheets(context);
  if (selected.has("individuais")) addIndividualSheets(context);
  if (!workbook.worksheets.length) throw new Error("Selecione ao menos uma folha para gerar a planilha.");
  return { workbook, context };
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
  const [aec, snooker, shield] = await Promise.all([
    fetchAsBase64(withBasePath("/assets/images/logo_grena.png")),
    fetchAsBase64(withBasePath("/assets/images/esporte_grena.png")),
    fetchAsBase64(withBasePath("/assets/images/escudo-sem-bg.png")),
  ]);
  return {
    aec: workbook.addImage({ base64: aec, extension: "png" }),
    snooker: workbook.addImage({ base64: snooker, extension: "png" }),
    shield: workbook.addImage({ base64: shield, extension: "png" }),
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

function eachCell(sheet, startRow, startCol, endRow, endCol, callback) {
  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) callback(sheet.getCell(row, col));
  }
}

function addPlayersSheet(context) {
  const { data } = context;
  const sheet = baseSheet(context, "Jogadores", "portrait");
  const players = [...data.participantes].sort((a, b) => Number(a.numero) - Number(b.numero));
  const lastRow = players.length + 4;
  const blackBorder = { style: "thin", color: { argb: "FF000000" } };
  const tableFont = { name: "Calibri", bold: true, size: 16, color: { argb: "FF000000" } };

  sheet.columns = [{ width: 8 }, { width: 18 }, { width: 18 }, { width: 18 }];
  sheet.getRow(1).height = 44.25;
  sheet.getRow(2).height = 30;
  sheet.getRow(3).height = 15;
  sheet.mergeCells("A2:D2");
  sheet.getCell("A2").value = `JOGADORES SÉRIE ${String(data.divisao).toUpperCase()} - ${data.temporada}`;
  sheet.getCell("A2").font = tableFont;
  sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

  sheet.addImage(context.logos.aec, { tl: { col: 0, row: 0 }, ext: { width: 127, height: 55 } });
  sheet.addImage(context.logos.shield, { tl: { col: 3.565, row: 0 }, ext: { width: 52, height: 55 } });

  sheet.getCell("A4").value = "Nº";
  sheet.getCell("B4").value = "JOGADOR";
  sheet.mergeCells("B4:D4");
  players.forEach((player, index) => {
    const row = index + 5;
    sheet.getCell(row, 1).value = Number(player.numero);
    sheet.getCell(row, 2).value = String(player.exibicao || "").toLocaleUpperCase("pt-BR");
    sheet.mergeCells(`B${row}:D${row}`);
  });

  for (let row = 4; row <= lastRow; row++) {
    sheet.getRow(row).height = 32.25;
    for (let col = 1; col <= 4; col++) {
      const cell = sheet.getCell(row, col);
      cell.font = tableFont;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };
    }
  }

  sheet.pageSetup.printArea = `A1:D${lastRow}`;
  sheet.pageSetup.orientation = "portrait";
  sheet.pageSetup.paperSize = 9;
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
  sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0, footer: 0 };
  sheet.pageSetup.horizontalCentered = true;
}

function addRegistrationSheet(context) {
  const { data } = context;
  const sheet = baseSheet(context, "Ficha de inscrição", "portrait");
  const players = [...data.participantes].sort((a, b) => Number(a.numero) - Number(b.numero));
  const lastRow = players.length + 5;
  const blackBorder = { style: "thin", color: { argb: "FF000000" } };
  const titleFont = { name: "Calibri", bold: true, size: 16, color: { argb: "FF000000" } };
  const tableFont = { name: "Calibri", bold: true, size: 12, color: { argb: "FF000000" } };
  const fee = data.taxa_inscricao == null
    ? ""
    : `\nR$ ${Number(data.taxa_inscricao).toFixed(2).replace(".", ",")}`;

  [7, 19, 19, 11, 14, 10, 22].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.getRow(1).height = 42;
  sheet.getRow(2).height = 42;
  sheet.getRow(3).height = 30;
  sheet.getRow(4).height = 15;
  sheet.mergeCells("A2:G3");
  sheet.getCell("A2").value = `CAMPEONATO DE SINUCA SÉRIE ${String(data.divisao).toUpperCase()} - AEC ${data.temporada}\nFICHA DE INSCRIÇÃO${fee}`;
  sheet.getCell("A2").font = titleFont;
  sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle", wrapText: true };

  sheet.addImage(context.logos.aec, { tl: { col: 0, row: 0 }, ext: { width: 127, height: 55 } });
  sheet.addImage(context.logos.shield, { tl: { col: 6.044, row: 0.16 }, ext: { width: 147, height: 147 } });

  sheet.getRow(5).values = ["Nº", "NOME DOS JOGADORES", "", "COTA", "TELEFONE", "", "FORMA DE PAGAMENTO"];
  sheet.mergeCells("B5:C5");
  sheet.mergeCells("E5:F5");
  players.forEach((player, index) => {
    const row = index + 6;
    sheet.getCell(row, 1).value = player.numero;
    sheet.getCell(row, 2).value = String(player.exibicao || "").toLocaleUpperCase("pt-BR");
    sheet.mergeCells(`B${row}:C${row}`);
    sheet.mergeCells(`E${row}:F${row}`);
  });

  for (let row = 5; row <= lastRow; row++) {
    sheet.getRow(row).height = 30;
    for (let col = 1; col <= 7; col++) {
      const cell = sheet.getCell(row, col);
      cell.font = tableFont;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };
    }
  }

  sheet.pageSetup.printArea = `A1:G${lastRow}`;
  sheet.pageSetup.orientation = "portrait";
  sheet.pageSetup.paperSize = 9;
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
  sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0, footer: 0 };
  sheet.pageSetup.horizontalCentered = true;
}

function addSimpleClassificationSheet(context) {
  const { data } = context;
  const sheet = baseSheet(context, "Classificação Simples", "portrait");
  const players = [...data.estatisticas.classificacao];
  const lastRow = players.length + 4;
  const division = String(data.divisao).trim().toUpperCase();
  const greenPlaces = division === "B" ? 4 : 3;
  const relegatedPlaces = division === "A" ? 4 : 0;
  const blackBorder = { style: "thin", color: { argb: "FF000000" } };
  const tableFont = { name: "Calibri", bold: true, size: 16, color: { argb: "FF000000" } };

  [14.14, 14.14, 27.14, 14.14, 14.14].forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  sheet.getRow(1).height = 44.25;
  sheet.getRow(2).height = 30;
  sheet.getRow(3).height = 15;
  sheet.mergeCells("A2:E2");
  sheet.getCell("A2").value = `CLASSIFICAÇÃO SÉRIE ${division} - ${data.temporada}`;
  sheet.getCell("A2").font = tableFont;
  sheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };

  sheet.addImage(context.logos.aec, { tl: { col: 0, row: 0 }, ext: { width: 127, height: 55 } });
  sheet.addImage(context.logos.shield, { tl: { col: 4.37, row: 0 }, ext: { width: 52, height: 55 } });

  sheet.getRow(4).values = ["POSIÇÃO", "Nº", "JOGADOR", "VITÓRIAS", "PARTIDAS"];
  players.forEach((player, index) => {
    const row = index + 5;
    sheet.getRow(row).values = [
      `${Number(player.posicao) || index + 1}º`,
      Number(player.numero),
      String(player.exibicao || "").toLocaleUpperCase("pt-BR"),
      Number(player.vitorias) || 0,
      Number(player.partidas_vencidas) || 0,
    ];
  });

  for (let row = 4; row <= lastRow; row++) {
    sheet.getRow(row).height = 32.25;
    let fill = null;
    if (row === 4) fill = "F3E8ED";
    else if (row - 4 <= greenPlaces) fill = "6AA84F";
    else if (relegatedPlaces && row - 4 > players.length - relegatedPlaces) fill = "CC0000";
    for (let col = 1; col <= 5; col++) {
      const cell = sheet.getCell(row, col);
      cell.font = tableFont;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };
      if (fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    }
  }

  sheet.pageSetup.printArea = `A1:E${lastRow}`;
  sheet.pageSetup.orientation = "portrait";
  sheet.pageSetup.paperSize = 9;
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
  sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0, footer: 0 };
  sheet.pageSetup.horizontalCentered = true;
}

function addClassificationSheet(context) {
  const { data } = context;
  const players = [...data.estatisticas.classificacao];
  const rounds = Math.max(1, Number(data.estatisticas.total_rodadas) || 0);
  const sheet = baseSheet(context, "Classificação");
  const columns = 5 + rounds;
  const lastDataRow = players.length + 3;
  const movementStartRow = lastDataRow + 2;
  const movementEndRow = movementStartRow + 3;
  const division = String(data.divisao).trim().toUpperCase();
  const greenPlaces = division === "B" ? 4 : 3;
  const relegatedPlaces = division === "A" ? 4 : 0;
  const blackBorder = { style: "thin", color: { argb: "FF000000" } };
  const titleFont = { name: "Calibri", bold: true, size: 16, color: { argb: "FF000000" } };
  const tableFont = { name: "Calibri", bold: true, size: 11, color: { argb: "FF000000" } };

  sheet.getColumn(1).width = 10;
  sheet.getColumn(2).width = 5;
  sheet.getColumn(3).width = 14.43;
  sheet.getColumn(4).width = 9.71;
  sheet.getColumn(5).width = 9.86;
  for (let col = 6; col <= columns; col++) sheet.getColumn(col).width = 5;

  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 30;
  sheet.mergeCells(1, 1, 2, columns);
  sheet.getCell(1, 1).value = `CLASSIFICAÇÃO SÉRIE ${division} - ${data.temporada}`;
  sheet.getCell(1, 1).font = titleFont;
  sheet.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };
  sheet.addImage(context.logos.aec, { tl: { col: 0, row: 0 }, ext: { width: 127, height: 55 } });
  sheet.addImage(context.logos.shield, { tl: { col: Math.max(1, columns - 2.5), row: 0 }, ext: { width: 75, height: 75 } });

  sheet.getRow(3).values = [
    "POSIÇÃO",
    "Nº",
    "JOGADOR",
    "VITÓRIAS",
    "PARTIDAS",
    ...Array.from({ length: rounds }, (_, index) => index + 1),
  ];
  players.forEach((player, index) => {
    const row = index + 4;
    sheet.getRow(row).values = [
      `${Number(player.posicao) || index + 1}º`,
      Number(player.numero),
      String(player.exibicao || "").toLocaleUpperCase("pt-BR"),
      Number(player.vitorias) || 0,
      Number(player.partidas_vencidas) || 0,
    ];
  });

  for (let row = 3; row <= lastDataRow; row++) {
    sheet.getRow(row).height = 19.5;
    for (let col = 1; col <= columns; col++) {
      const cell = sheet.getCell(row, col);
      cell.font = tableFont;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };
      if (row === 3) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F3E8ED" } };
      }
    }
  }

  players.forEach((player, index) => {
    const row = index + 4;
    if (index < greenPlaces) {
      eachCell(sheet, row, 1, row, 3, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "6AA84F" } };
      });
    } else if (relegatedPlaces && index >= players.length - relegatedPlaces) {
      eachCell(sheet, row, 1, row, 3, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "CC0000" } };
      });
    }
    const wins = Math.min(rounds, Number(player.vitorias) || 0);
    if (wins > 0) {
      eachCell(sheet, row, 6, row, 5 + wins, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "6AA84F" } };
      });
    }
  });

  const promoted = (data.movimentacoes?.subiram || (division === "B" ? players.slice(0, 4).map((player) => player.exibicao) : []));
  const relegated = (data.movimentacoes?.cairam || (division === "A" ? players.slice(-4).map((player) => player.exibicao) : []));
  const compactMovement = columns < 12;
  const half = Math.floor(columns / 2);
  const leftLabelStart = compactMovement ? 1 : 2;
  const leftLabelEnd = compactMovement ? 1 : 3;
  const leftNameStart = compactMovement ? 2 : 4;
  const leftNameEnd = compactMovement ? half : 5;
  const rightStart = compactMovement ? half + 1 : Math.floor(columns * 0.42);
  const rightLabelEnd = compactMovement ? rightStart : Math.min(columns, rightStart + 3);
  const rightNameStart = rightLabelEnd + 1;
  const rightNameEnd = compactMovement ? columns : Math.min(columns, rightNameStart + 2);
  for (let index = 0; index < 4; index++) {
    const row = movementStartRow + index;
    sheet.getRow(row).height = 15.75;
    if (leftLabelEnd >= leftLabelStart) sheet.mergeCells(row, leftLabelStart, row, leftLabelEnd);
    if (leftNameEnd >= leftNameStart) sheet.mergeCells(row, leftNameStart, row, leftNameEnd);
    if (rightLabelEnd >= rightStart) sheet.mergeCells(row, rightStart, row, rightLabelEnd);
    if (rightNameEnd >= rightNameStart) sheet.mergeCells(row, rightNameStart, row, rightNameEnd);
    eachCell(sheet, row, 1, row, columns, (cell) => {
      cell.font = tableFont;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: blackBorder, bottom: blackBorder };
    });
    sheet.getCell(row, 1).border = { top: blackBorder, bottom: blackBorder, left: blackBorder };
    sheet.getCell(row, columns).border = { top: blackBorder, bottom: blackBorder, right: blackBorder };
    if (index === 0) {
      sheet.getCell(row, leftLabelStart).value = "SUBIU PARA SÉRIE A:";
      sheet.getCell(row, rightStart).value = "CAIU PARA SÉRIE B:";
    }
    sheet.getCell(row, leftNameStart).value = String(promoted[index] || "").toLocaleUpperCase("pt-BR");
    if (rightNameStart <= columns) {
      sheet.getCell(row, rightNameStart).value = String(relegated[index] || "").toLocaleUpperCase("pt-BR");
    }
  }

  sheet.getRow(lastDataRow + 1).height = 15.75;
  sheet.pageSetup.printArea = `A1:${columnLetter(columns)}${movementEndRow}`;
  sheet.pageSetup.orientation = "landscape";
  sheet.pageSetup.paperSize = 9;
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
  sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0, footer: 0 };
  sheet.pageSetup.horizontalCentered = true;
}

function addVictoriesSheet(context) {
  const { data, manual } = context;
  const division = String(data.divisao).trim().toUpperCase();
  const players = [...data.estatisticas.jogadores]
    .sort((a, b) => Number(a.numero) - Number(b.numero));
  const classification = [...data.estatisticas.classificacao];
  const highlightedPlaces = division === "B" ? 4 : 3;
  const highlightedNumbers = new Set(
    classification
      .slice(0, highlightedPlaces)
      .map((player) => Number(player.numero)),
  );
  const rounds = Math.max(1, Number(data.estatisticas.total_rodadas) || 0);
  const columns = rounds + 2;
  const lastRow = players.length + 3;
  const sheet = baseSheet(context, "Vitórias");
  const blackBorder = { style: "thin", color: { argb: "FF000000" } };
  const titleFont = { name: "Calibri", bold: true, size: 16, color: { argb: "FF000000" } };
  const tableFont = { name: "Calibri", size: 11, color: { argb: "FF000000" } };

  sheet.getColumn(1).width = 10;
  sheet.getColumn(2).width = 20;
  for (let col = 3; col <= columns; col++) sheet.getColumn(col).width = 6.29;

  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 30;
  sheet.mergeCells(1, 1, 2, columns);
  sheet.getCell(1, 1).value = `VITÓRIAS SÉRIE ${division} - ${data.temporada}`;
  sheet.getCell(1, 1).font = titleFont;
  sheet.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };
  sheet.addImage(context.logos.aec, { tl: { col: 0, row: 0 }, ext: { width: 127, height: 55 } });
  sheet.addImage(context.logos.shield, {
    tl: { col: Math.max(1, columns - 1.682), row: 0 },
    ext: { width: 75, height: 75 },
  });

  sheet.getRow(3).values = [
    "Nº",
    "JOGADOR",
    ...Array.from({ length: rounds }, (_, index) => index + 1),
  ];
  players.forEach((player, index) => {
    const row = index + 4;
    sheet.getCell(row, 1).value = Number(player.numero);
    sheet.getCell(row, 2).value = String(player.exibicao || "").toLocaleUpperCase("pt-BR");
  });

  for (let row = 3; row <= lastRow; row++) {
    sheet.getRow(row).height = 21;
    for (let col = 1; col <= columns; col++) {
      const cell = sheet.getCell(row, col);
      cell.font = { ...tableFont, bold: row === 3 || col <= 2 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };
    }
  }

  if (!manual) {
    players.forEach((player, index) => {
      const wins = Math.min(rounds, Math.max(0, Number(player.vitorias) || 0));
      if (!wins) return;
      const fill = highlightedNumbers.has(Number(player.numero)) ? "38761D" : "F1C232";
      eachCell(sheet, index + 4, 3, index + 4, 2 + wins, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      });
    });
  }

  sheet.pageSetup.printArea = `A1:${columnLetter(columns)}${lastRow}`;
  sheet.pageSetup.orientation = "landscape";
  sheet.pageSetup.paperSize = 9;
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
  sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0, footer: 0 };
  sheet.pageSetup.horizontalCentered = true;
}

function addWonMatchesSheet(context) {
  const { data, manual } = context;
  const division = String(data.divisao).trim().toUpperCase();
  const players = [...data.estatisticas.jogadores]
    .sort((a, b) => Number(a.numero) - Number(b.numero));
  const rounds = Math.max(1, Number(data.estatisticas.total_rodadas) || 0);
  const slots = rounds * 2;
  const columns = 2 + slots;
  const lastRow = players.length + 3;
  const sheet = baseSheet(context, "Partidas vencidas");
  const blackBorder = { style: "thin", color: { argb: "FF000000" } };
  const titleFont = { name: "Calibri", bold: true, size: 16, color: { argb: "FF000000" } };
  const tableFont = { name: "Calibri", size: 11, color: { argb: "FF000000" } };

  sheet.getColumn(1).width = 10;
  sheet.getColumn(2).width = 20;
  for (let col = 3; col <= columns; col++) sheet.getColumn(col).width = 3.14;

  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 30;
  sheet.mergeCells(1, 1, 2, columns);
  sheet.getCell(1, 1).value = `PARTIDAS VENCIDAS SÉRIE ${division} - ${data.temporada}`;
  sheet.getCell(1, 1).font = titleFont;
  sheet.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };
  sheet.addImage(context.logos.aec, { tl: { col: 0, row: 0 }, ext: { width: 127, height: 55 } });
  sheet.addImage(context.logos.shield, {
    tl: { col: Math.max(1, columns - 3.364), row: 0 },
    ext: { width: 75, height: 75 },
  });

  sheet.getRow(3).values = [
    "Nº",
    "JOGADOR",
    ...Array.from({ length: slots }, (_, index) => index + 1),
  ];
  players.forEach((player, index) => {
    const row = index + 4;
    sheet.getCell(row, 1).value = Number(player.numero);
    sheet.getCell(row, 2).value = String(player.exibicao || "").toLocaleUpperCase("pt-BR");
  });

  for (let row = 3; row <= lastRow; row++) {
    sheet.getRow(row).height = 21;
    for (let col = 1; col <= columns; col++) {
      const cell = sheet.getCell(row, col);
      cell.font = { ...tableFont, bold: row === 3 || col <= 2 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };
    }
  }

  if (!manual) {
    players.forEach((player, index) => {
      const wonMatches = Math.min(slots, Math.max(0, Number(player.partidas_vencidas) || 0));
      if (!wonMatches) return;
      eachCell(sheet, index + 4, 3, index + 4, 2 + wonMatches, (cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "38761D" } };
      });
    });
  }

  sheet.pageSetup.printArea = `A1:${columnLetter(columns)}${lastRow}`;
  sheet.pageSetup.orientation = "landscape";
  sheet.pageSetup.paperSize = 9;
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
  sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0, footer: 0 };
  sheet.pageSetup.horizontalCentered = true;
}

function addRankingSheet(context) {
  const { data } = context;
  const year = Number(data.temporada);
  const participants = [...(data.participantes || [])];
  const classification = [...(data.estatisticas?.classificacao || [])];
  const previousRows = data.ranking_exportacao?.anterior?.detalhes
    || data.ranking_exportacao?.anterior?.ranking
    || [];
  const updatedRows = data.ranking_exportacao?.atualizado?.detalhes
    || data.ranking_exportacao?.atualizado?.ranking
    || [];
  if (!data.ranking_exportacao || String(data.divisao).toUpperCase() !== "A") {
    throw new Error("O Ranking está disponível somente na versão atualizada da Série A.");
  }

  const classificationByPlayer = new Map(classification.map((player, index) => [
    Number(player.jogador_id),
    { ...player, posicao: Number(player.posicao) || index + 1 },
  ]));
  const previousByPlayer = new Map(previousRows.map((player) => [Number(player.jogador_id), player]));
  const updatedByPlayer = new Map(updatedRows.map((player) => [Number(player.jogador_id), player]));
  const ordered = participants
    .map((participant) => ({
      ...participant,
      classificacao: classificationByPlayer.get(Number(participant.jogador_id)),
      rankingAnterior: previousByPlayer.get(Number(participant.jogador_id)),
      rankingAtualizado: updatedByPlayer.get(Number(participant.jogador_id)),
    }))
    .sort((playerA, playerB) => {
      const rankA = Number(playerA.rankingAnterior?.posicao) || Number.MAX_SAFE_INTEGER;
      const rankB = Number(playerB.rankingAnterior?.posicao) || Number.MAX_SAFE_INTEGER;
      return rankA - rankB || Number(playerA.numero) - Number(playerB.numero);
    });
  const years = Array.from({ length: 5 }, (_, index) => year - index);
  const sheet = baseSheet(context, "Ranking");
  const blackBorder = { style: "thin", color: { argb: "FF000000" } };
  const titleFont = { name: "Calibri", bold: true, size: 16, color: { argb: "FF000000" } };
  const tableFont = { name: "Calibri", size: 11, color: { argb: "FF000000" } };
  const headerFont = { ...tableFont, bold: true };
  const lastDataRow = ordered.length + 3;
  const legendStartRow = lastDataRow + 1;
  const noteRow = legendStartRow + 3;
  const groups = [
    [3, 5], [6, 8], [9, 11], [12, 13], [14, 16], [17, 19],
    [20, 22], [23, 25], [26, 28], [29, 31], [32, 34], [35, 37], [38, 40],
  ];

  sheet.getColumn(1).width = 12.14;
  sheet.getColumn(2).width = 18;
  for (let col = 3; col <= 40; col++) sheet.getColumn(col).width = 3.14;
  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 23.25;
  sheet.mergeCells("A1:AN2");
  sheet.getCell("A1").value = `DETALHAMENTO DAS PONTUAÇÕES DO RANKING ${year}`;
  sheet.getCell("A1").font = titleFont;
  sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };

  for (let row = 3; row <= lastDataRow; row++) {
    groups.forEach(([start, end]) => sheet.mergeCells(row, start, row, end));
    sheet.getRow(row).height = row === 3 ? 27 : 21;
    eachCell(sheet, row, 1, row, 40, (cell) => {
      cell.font = row === 3 ? headerFont : tableFont;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };
    });
  }

  const headers = [
    [1, `COLOCAÇÃO\n${year}`], [2, "JOGADOR"], [3, "J"], [6, "V"], [9, "D"],
    [12, "PV"], [14, "APR"], [17, "PP"], [20, `PG\n${years[0]}`],
    [23, `PG\n${years[1]}`], [26, `PG\n${years[2]}`], [29, `PG\n${years[3]}`],
    [32, `PG\n${years[4]}`], [35, "PT"], [38, "RANKING"],
  ];
  headers.forEach(([column, value]) => { sheet.getCell(3, column).value = value; });

  ordered.forEach((player, index) => {
    const row = index + 4;
    const current = player.classificacao || {};
    const directWo = Boolean(current.wo_direto ?? current.direct_wo);
    const results = Array.isArray(current.resultados) ? current.resultados : [];
    const games = directWo ? 0 : results.length;
    const wins = directWo ? 0 : Number(current.vitorias) || 0;
    const defeats = directWo
      ? Math.max(0, participants.length - 1)
      : results.filter((result) => result.resultado === "D").length;
    const wonMatches = directWo ? 0 : Number(current.partidas_vencidas) || 0;
    const updatedSeasons = new Map(
      (player.rankingAtualizado?.temporadas || []).map((season) => [Number(season.temporada), Number(season.pontos) || 0]),
    );
    const annualPoints = years.map((rankingYear) => updatedSeasons.get(rankingYear) || 0);
    const totalPoints = annualPoints.reduce((total, points) => total + points, 0);
    const values = [
      [1, `${Number(current.posicao) || "-"}º`],
      [2, String(player.exibicao || player.nome || "").toLocaleUpperCase("pt-BR")],
      [3, games], [6, wins], [9, defeats], [12, wonMatches],
      [14, directWo ? "W.O." : games ? `${Math.round((wins / games) * 100)}%` : "0%"],
      [17, Number(player.rankingAnterior?.pontos) || 0],
      [20, annualPoints[0]], [23, annualPoints[1]], [26, annualPoints[2]],
      [29, annualPoints[3]], [32, annualPoints[4]], [35, totalPoints],
      [38, player.rankingAtualizado?.posicao ? `${Number(player.rankingAtualizado.posicao)}º` : "-"],
    ];
    values.forEach(([column, value]) => { sheet.getCell(row, column).value = value; });
    eachCell(sheet, row, 20, row, 22, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1C232" } };
    });
    eachCell(sheet, row, 35, row, 37, (cell) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3D85C6" } };
    });
  });

  const legends = [
    ["J -  Jogos", "PV - Partidas Vencidas", "APR - Aproveitamento"],
    ["V - Vitórias", "PP - Pontos Possuídos", "PT - Pontuação Total"],
    ["D - Derrotas", "PG - Pontos Ganhos", ""],
  ];
  legends.forEach((values, index) => {
    const row = legendStartRow + index;
    sheet.getRow(row).height = 14.25;
    sheet.getCell(row, 1).value = values[0];
    sheet.mergeCells(row, 9, row, 16);
    sheet.getCell(row, 9).value = values[1];
    sheet.mergeCells(row, 32, row, 40);
    sheet.getCell(row, 32).value = values[2];
    eachCell(sheet, row, 1, row, 40, (cell) => {
      cell.font = tableFont;
      cell.alignment = { horizontal: "left", vertical: "middle" };
      cell.border = {};
    });
    if (index === 0) eachCell(sheet, row, 1, row, 40, (cell) => { cell.border = { ...cell.border, top: blackBorder }; });
    if (index === 2) eachCell(sheet, row, 1, row, 40, (cell) => { cell.border = { ...cell.border, bottom: blackBorder }; });
    sheet.getCell(row, 1).border = { ...sheet.getCell(row, 1).border, left: blackBorder };
    sheet.getCell(row, 40).border = { ...sheet.getCell(row, 40).border, right: blackBorder };
  });

  sheet.getRow(noteRow).height = 14.25;
  sheet.mergeCells(noteRow, 1, noteRow, 40);
  sheet.getCell(noteRow, 1).value = `Nota: ${Math.max(1, participants.length - 3)}º a ${participants.length}º Rebaixados`;
  sheet.getCell(noteRow, 1).font = headerFont;
  sheet.getCell(noteRow, 1).alignment = { horizontal: "center", vertical: "middle" };
  sheet.getCell(noteRow, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCCCCCC" } };
  eachCell(sheet, noteRow, 1, noteRow, 40, (cell) => {
    cell.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };
  });

  sheet.pageSetup.printArea = `A1:AN${noteRow}`;
  sheet.pageSetup.orientation = "landscape";
  sheet.pageSetup.paperSize = 9;
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
  sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0, footer: 0 };
  sheet.pageSetup.horizontalCentered = true;
}

function addResultsSheet(context) {
  const { data } = context;
  const division = String(data.divisao).trim().toUpperCase();
  const players = [...data.estatisticas.jogadores]
    .sort((a, b) => Number(a.numero) - Number(b.numero));
  const rounds = Math.max(1, Number(data.estatisticas.total_rodadas) || 0);
  const sheet = baseSheet(context, "Resultados");
  const columns = 2 + rounds;
  const lastRow = players.length + 3;
  const blackBorder = { style: "thin", color: { argb: "FF000000" } };
  const titleFont = { name: "Calibri", bold: true, size: 16, color: { argb: "FF000000" } };
  const tableFont = { name: "Calibri", size: 11, color: { argb: "FF000000" } };
  const scheduledRounds = new Map(players.map((player) => [Number(player.numero), new Set()]));

  (data.rodadas || []).forEach((round) => {
    (round.partidas || []).forEach((match) => {
      scheduledRounds.get(Number(match.numero1))?.add(Number(round.rodada));
      scheduledRounds.get(Number(match.numero2))?.add(Number(round.rodada));
    });
  });

  sheet.getColumn(1).width = 10;
  sheet.getColumn(2).width = 20;
  for (let col = 3; col <= columns; col++) sheet.getColumn(col).width = 6.29;

  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 30;
  sheet.mergeCells(1, 1, 2, columns);
  sheet.getCell(1, 1).value = `RESULTADOS SÉRIE ${division} - ${data.temporada}`;
  sheet.getCell(1, 1).font = titleFont;
  sheet.getCell(1, 1).alignment = { horizontal: "center", vertical: "middle" };
  sheet.addImage(context.logos.aec, { tl: { col: 0, row: 0 }, ext: { width: 127, height: 55 } });
  sheet.addImage(context.logos.shield, {
    tl: { col: Math.max(1, columns - 1.682), row: 0 },
    ext: { width: 75, height: 75 },
  });

  sheet.getRow(3).values = [
    "Nº",
    "JOGADOR",
    ...Array.from({ length: rounds }, (_, index) => index + 1),
  ];
  players.forEach((player, index) => {
    const row = index + 4;
    sheet.getCell(row, 1).value = Number(player.numero);
    sheet.getCell(row, 2).value = String(player.exibicao || "").toLocaleUpperCase("pt-BR");
  });

  for (let row = 3; row <= lastRow; row++) {
    sheet.getRow(row).height = 21;
    for (let col = 1; col <= columns; col++) {
      const cell = sheet.getCell(row, col);
      cell.font = { ...tableFont, bold: row === 3 || col <= 2 };
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };
    }
  }

  players.forEach((player, index) => {
    const row = index + 4;
    const resultsByRound = new Map(
      (player.resultados || []).map((result) => [Number(result.rodada), result.resultado]),
    );
    for (let round = 1; round <= rounds; round++) {
      const result = resultsByRound.get(round);
      const hasMatch = scheduledRounds.get(Number(player.numero))?.has(round);
      const fill = result === "V"
        ? "6AA84F"
        : result === "D"
          ? "CC0000"
          : hasMatch
            ? "D9D9D9"
            : null;
      if (fill) {
        sheet.getCell(row, round + 2).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: fill },
        };
      }
    }
  });

  sheet.pageSetup.printArea = `A1:${columnLetter(columns)}${lastRow}`;
  sheet.pageSetup.orientation = "landscape";
  sheet.pageSetup.paperSize = 9;
  sheet.pageSetup.fitToPage = true;
  sheet.pageSetup.fitToWidth = 1;
  sheet.pageSetup.fitToHeight = 0;
  sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0, footer: 0 };
  sheet.pageSetup.horizontalCentered = true;
}

function addRoundSheets(context) {
  const chunks = chunk(context.data.rodadas, 4);
  chunks.forEach((rounds) => {
    const first = Number(rounds[0].rodada);
    const last = Number(rounds[rounds.length - 1].rodada);
    const matchRows = Math.max(1, ...rounds.map((round) => (round.partidas || []).length));
    const bottomTitleRow = 7 + matchRows;
    const bottomFooterRow = 8 + (matchRows * 2);
    const sheet = baseSheet(context, first === last ? `Rodada ${first}` : `Rodadas ${first}-${last}`);
    const titleFont = { name: "Calibri", bold: true, size: 16, color: { argb: "FF000000" } };

    [8.29, 5, 16, 6, 4, 6, 16, 6, 8.71, 8.29, 5, 16, 6, 4, 6, 16, 6]
      .forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    sheet.getRow(1).height = 30;
    sheet.getRow(2).height = 30;
    sheet.getRow(3).height = 6;
    sheet.mergeCells("A1:Q2");
    sheet.getCell("A1").value = `CAMPEONATO DE SINUCA SÉRIE ${String(context.data.divisao).trim().toUpperCase()} - ${context.data.temporada}\n${first === last ? `RODADA ${first}` : `RODADAS ${first} A ${last}`}`;
    sheet.getCell("A1").font = titleFont;
    sheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    sheet.addImage(context.logos.aec, { tl: { col: 0, row: 0 }, ext: { width: 127, height: 55 } });
    sheet.addImage(context.logos.shield, { tl: { col: 15.684, row: 0 }, ext: { width: 75, height: 75 } });

    rounds.forEach((round, index) => {
      renderRoundBlock(context, sheet, round, index, matchRows, bottomTitleRow);
    });

    sheet.pageSetup.printArea = `A1:Q${bottomFooterRow}`;
    sheet.pageSetup.orientation = "landscape";
    sheet.pageSetup.paperSize = 9;
    sheet.pageSetup.fitToPage = true;
    sheet.pageSetup.fitToWidth = 1;
    sheet.pageSetup.fitToHeight = 0;
    sheet.pageSetup.margins = { left: 0.2, right: 0.2, top: 0.25, bottom: 0.25, header: 0, footer: 0 };
    sheet.pageSetup.horizontalCentered = true;
  });
}

function renderRoundBlock(context, sheet, round, index, matchRows, bottomTitleRow) {
  const startRow = index < 2 ? 4 : bottomTitleRow;
  const startCol = index % 2 === 0 ? 1 : 10;
  const endCol = startCol + 7;
  const matchesStartRow = startRow + 1;
  const matchesEndRow = startRow + matchRows;
  const footerRow = matchesEndRow + 1;
  const blackBorder = { style: "thin", color: { argb: "FF000000" } };
  const roundTitleFont = { name: "Calibri", bold: true, size: 13, color: { argb: "FF000000" } };
  const scheduleFont = { name: "Calibri", bold: true, size: 13, color: { argb: "FF000000" } };
  const matchFont = { name: "Calibri", size: 12, color: { argb: "FF000000" } };

  sheet.getRow(startRow).height = 29.25;
  for (let row = matchesStartRow; row <= matchesEndRow; row++) {
    sheet.getRow(row).height = 187.5 / matchRows;
  }
  sheet.getRow(footerRow).height = 15.75;
  sheet.getRow(footerRow + 1).height = 15;

  sheet.mergeCells(startRow, startCol, startRow, endCol);
  const title = sheet.getCell(startRow, startCol);
  title.value = `${ordinal(round.rodada)} Rodada`;
  title.font = roundTitleFont;
  title.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  title.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };

  sheet.mergeCells(matchesStartRow, startCol, matchesEndRow, startCol);
  const firstMatch = (round.partidas || [])[0];
  const schedule = sheet.getCell(matchesStartRow, startCol);
  schedule.value = formatSchedule(round, firstMatch);
  schedule.font = scheduleFont;
  schedule.alignment = {
    horizontal: "center",
    vertical: "middle",
    wrapText: true,
    textRotation: 90,
  };
  schedule.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };

  for (let matchIndex = 0; matchIndex < matchRows; matchIndex++) {
    const row = matchesStartRow + matchIndex;
    const match = (round.partidas || [])[matchIndex];
    if (match) {
      const [score1, score2] = context.manual ? ["", ""] : displayScores(match);
      sheet.getCell(row, startCol + 1).value = Number(match.numero1);
      sheet.getCell(row, startCol + 2).value = String(match.jogador1?.exibicao || "").toLocaleUpperCase("pt-BR");
      sheet.getCell(row, startCol + 3).value = score1;
      sheet.getCell(row, startCol + 4).value = "X";
      sheet.getCell(row, startCol + 5).value = score2;
      sheet.getCell(row, startCol + 6).value = String(match.jogador2?.exibicao || "").toLocaleUpperCase("pt-BR");
      sheet.getCell(row, startCol + 7).value = Number(match.numero2);
    }
    for (let col = startCol + 1; col <= endCol; col++) {
      const cell = sheet.getCell(row, col);
      cell.font = matchFont;
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };
    }
  }

  sheet.mergeCells(footerRow, startCol, footerRow, endCol);
  const footer = sheet.getCell(footerRow, startCol);
  footer.value = round.jogador_folga
    ? `Folga: ${String(round.jogador_folga.exibicao || "").toLocaleUpperCase("pt-BR")}`
    : "";
  footer.font = { ...matchFont, bold: true };
  footer.alignment = { horizontal: "center", vertical: "middle" };
  footer.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };
}

function addIndividualSheets(context) {
  const players = [...context.data.participantes]
    .sort((a, b) => Number(a.numero) - Number(b.numero));
  const totalRounds = Math.max(
    1,
    Number(context.data.estatisticas.total_rodadas) || 0,
    context.data.rodadas.length,
  );
  const lastRow = 3 + totalRounds * 3;
  const blackBorder = { style: "thin", color: { argb: "FF000000" } };

  chunk(players, 4).forEach((pagePlayers, pageIndex) => {
    const firstPlayer = pageIndex * 4 + 1;
    const sheet = baseSheet(context, `Fichas ${firstPlayer}-${firstPlayer + 3}`, "portrait");
    sheet.columns = [
      { width: 5 },
      { width: 5 },
      ...Array.from({ length: 8 }, () => ({ width: 11.57 })),
    ];

    sheet.mergeCells("C1:J1");
    const title = sheet.getCell("C1");
    title.value = `HISTÓRICO DE RESULTADOS DOS JOGADORES — SÉRIE ${String(context.data.divisao).toUpperCase()} — ${context.data.temporada}`;
    title.font = { name: "Calibri", bold: true, size: 13, color: { argb: "FF000000" } };
    title.alignment = { horizontal: "center", vertical: "middle" };

    sheet.mergeCells(`A4:A${lastRow}`);
    const sideLabel = sheet.getCell("A4");
    sideLabel.value = "DATA E PLACARES";
    sideLabel.font = { name: "Calibri", bold: true, size: 21, color: { argb: "FF000000" } };
    sideLabel.alignment = { horizontal: "center", vertical: "middle", textRotation: 90 };
    sideLabel.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };

    for (let round = 1; round <= totalRounds; round++) {
      const top = 4 + (round - 1) * 3;
      sheet.mergeCells(`B${top}:B${top + 2}`);
      const roundCell = sheet.getCell(top, 2);
      roundCell.value = round;
      roundCell.font = { name: "Calibri", bold: true, size: 17, color: { argb: "FF000000" } };
      roundCell.alignment = { horizontal: "center", vertical: "middle" };
      roundCell.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };
      for (let row = top; row <= top + 2; row++) sheet.getRow(row).height = 12.75;
    }

    pagePlayers.forEach((player, index) => {
      renderIndividualPlayer(context, sheet, player, index, totalRounds, blackBorder);
    });
    sheet.pageSetup.printArea = `A1:J${lastRow}`;
  });
}

function renderIndividualPlayer(context, sheet, player, index, totalRounds, blackBorder) {
  const startCol = 3 + index * 2;
  sheet.mergeCells(2, startCol, 2, startCol + 1);
  sheet.getCell(2, startCol).value = `${player.numero} - ${String(player.exibicao || "").toLocaleUpperCase("pt-BR")}`;
  sheet.getCell(2, startCol).font = { name: "Calibri", bold: true, color: { argb: "FF000000" } };
  sheet.getCell(2, startCol).alignment = { horizontal: "center", vertical: "middle" };
  styleIndividualRange(sheet, 2, startCol, 2, startCol + 1, blackBorder, { bold: true });
  sheet.getCell(3, startCol).value = "VITÓRIA";
  sheet.getCell(3, startCol + 1).value = "DERROTA";
  styleIndividualRange(sheet, 3, startCol, 3, startCol + 1, blackBorder, { bold: true, size: 10 });

  const results = new Map((context.data.estatisticas.jogadores
    .find((item) => Number(item.numero) === Number(player.numero))?.resultados || [])
    .map((result) => [Number(result.rodada), result]));
  for (let round = 1; round <= totalRounds; round++) {
    const top = 4 + (round - 1) * 3;
    styleIndividualRange(sheet, top, startCol, top + 2, startCol + 1, blackBorder, { size: 11 });
    const result = context.manual ? null : results.get(round);
    if (result) {
      const match = findPlayerMatch(context.data.rodadas, round, player.numero);
      const resultCol = result.resultado === "V" ? startCol : startCol + 1;
      sheet.getCell(top, resultCol).value = formatSpreadsheetDate(match?.data);
      sheet.getCell(top + 1, resultCol).value = perspectiveScore(match, player.numero);
      sheet.getCell(top + 2, resultCol).value = result.adversario?.exibicao || "";
      sheet.getCell(top + 1, resultCol).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: result.resultado === "V" ? COLORS.green : COLORS.orange },
      };
    }
  }
}

function styleIndividualRange(sheet, startRow, startCol, endRow, endCol, blackBorder, font = {}) {
  eachCell(sheet, startRow, startCol, endRow, endCol, (cell) => {
    cell.font = { name: "Calibri", color: { argb: "FF000000" }, ...font };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { top: blackBorder, left: blackBorder, right: blackBorder, bottom: blackBorder };
  });
}

function formatSpreadsheetDate(value) {
  const text = String(value || "").trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : text;
}

function findPlayerMatch(rounds, roundNumber, playerNumber) {
  return rounds.find((round) => Number(round.rodada) === roundNumber)?.partidas
    .find((match) => Number(match.numero1) === Number(playerNumber) || Number(match.numero2) === Number(playerNumber));
}

function perspectiveScore(match, playerNumber) {
  if (!match) return "";
  const scores = displayScores(match);
  return Number(match.numero1) === Number(playerNumber) ? `${scores[0]} x ${scores[1]}` : `${scores[1]} x ${scores[0]}`;
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
  const value = match?.data || round.data || "";
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
  const time = String(match?.hora || round.hora || "").trim();
  const dateAndTime = [displayDate, time ? `${time}h` : ""].filter(Boolean).join(" ");
  return [dateAndTime, weekday].filter(Boolean).join("\n");
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
