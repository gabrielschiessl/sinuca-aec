/************************************************
 * PROJETO AEC SINUCA
 * Snapshot temporário para migração ao MySQL
 ************************************************/

/**
 * Execute manualmente pelo editor do Apps Script.
 * A função cria um JSON no Google Drive do usuário que a executou.
 * O arquivo não contém tokens nem propriedades privadas do script.
 */
function exportarSnapshotMigracaoMySql() {
  garantirEstruturaTemporadas();
  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const tabelas = {
    configuracao: lerAbaSnapshotMigracao(planilha, SHEETS.configuracao),
    jogadores: lerAbaSnapshotMigracao(planilha, SHEETS.jogadores),
    temporadas: lerAbaSnapshotMigracao(planilha, SHEETS.temporadas),
    participantes: lerAbaSnapshotMigracao(planilha, SHEETS.participantes),
    rodadas: lerAbaSnapshotMigracao(planilha, SHEETS.rodadas),
    temporadas_participantes: lerAbaSnapshotMigracao(
      planilha,
      SHEETS.temporadasParticipantes,
    ),
    temporadas_rodadas: lerAbaSnapshotMigracao(
      planilha,
      SHEETS.temporadasRodadas,
    ),
  };
  const snapshot = {
    formato: "aec-sinuca-mysql-snapshot",
    versao: 1,
    gerado_em: new Date().toISOString(),
    temporada_atual: getTemporadaAtual(),
    tabelas,
  };
  const nome = `aec-sinuca-snapshot-${Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyyMMdd-HHmmss",
  )}.json`;
  const arquivo = DriveApp.createFile(
    nome,
    JSON.stringify(snapshot),
    MimeType.PLAIN_TEXT,
  );

  Logger.log(`Snapshot criado: ${arquivo.getUrl()}`);
  return { nome, url: arquivo.getUrl(), id: arquivo.getId() };
}

function lerAbaSnapshotMigracao(planilha, nomeAba) {
  const aba = planilha.getSheetByName(nomeAba);
  if (!aba) return [];
  const valores = aba.getDataRange().getDisplayValues();
  if (valores.length <= 1) return [];
  const cabecalhos = valores[0].map((valor) =>
    String(valor).trim().toLowerCase(),
  );
  return valores.slice(1)
    .filter((linha) => linha.some((valor) => String(valor).trim() !== ""))
    .map((linha) => {
      const registro = {};
      cabecalhos.forEach((cabecalho, indice) => {
        if (cabecalho) registro[cabecalho] = linha[indice] || "";
      });
      return registro;
    });
}

