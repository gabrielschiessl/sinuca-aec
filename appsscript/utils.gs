/************************************************
 * PROJETO AEC SINUCA
 * Utilitários
 ************************************************/

/************************************************
 * Cache em memória da execução
 ************************************************/

const CACHE = {};

/************************************************
 * Resposta JSON
 ************************************************/

function responder(obj) {

  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);

}

/************************************************
 * Lê uma aba e retorna uma lista de objetos
 ************************************************/

function getSheetAsObjects(nomeAba) {

  if (CACHE[nomeAba]) {
    return CACHE[nomeAba];
  }

  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const aba = planilha.getSheetByName(nomeAba);

  if (!aba) {
    throw new Error(`Aba "${nomeAba}" não encontrada.`);
  }

  const dados = aba.getDataRange().getDisplayValues();

  if (dados.length <= 1) {

    CACHE[nomeAba] = [];

    return [];

  }

  const cabecalhos = dados[0].map(c =>
    String(c)
      .trim()
      .toLowerCase()
  );

  const resultado = dados.slice(1).map(linha => {

    const objeto = {};

    cabecalhos.forEach((cabecalho, indice) => {
      objeto[cabecalho] = linha[indice];
    });

    return objeto;

  });

  CACHE[nomeAba] = resultado;

  return resultado;

}

/************************************************
 * Retorna a temporada ativa
 ************************************************/

function getTemporadaAtual() {

  const config = getSheetAsObjects(SHEETS.configuracao);

  const temporada = config.find(c => c.chave === "temporada_atual");

  return Number(temporada.valor);

}

/************************************************
 * Agrupa partidas por rodada
 ************************************************/

function agruparRodadas(partidas) {

  const rodadas = [];

  partidas.forEach(partida => {

    let rodada = rodadas.find(r => r.rodada === partida.rodada);

    if (!rodada) {

      rodada = {

        rodada: partida.rodada,

        data: partida.data,

        hora: partida.hora,

        status: partida.status,

        partidas: []

      };

      rodadas.push(rodada);

    }

    rodada.partidas.push(partida);

  });

  return rodadas
    .sort((a, b) => a.rodada - b.rodada)
    .map(rodada => {

      const totalPartidas = rodada.partidas.length;

      const partidasEncerradas = rodada.partidas.filter(
        p => p.status === "E"
      ).length;

      const partidasAoVivo = rodada.partidas.filter(
        p => p.status === "V"
      ).length;

      const partidasAgendadas = rodada.partidas.filter(
        p => p.status === "F"
      ).length;

      return {

        ...rodada,

        total_partidas: totalPartidas,

        partidas_encerradas: partidasEncerradas,

        partidas_ao_vivo: partidasAoVivo,

        partidas_agendadas: partidasAgendadas

      };

    });

}

/************************************************
 * Retorna informações do status da partida
 ************************************************/

function getStatusInfo(status) {

  switch (status) {

    case "A":
      return {

        codigo: "A",

        descricao: "Agendado",

        classe: "status-soon"

      };

    case "V":
      return {

        codigo: "V",

        descricao: "Em andamento",

        classe: "status-live"

      };

    case "E":
      return {

        codigo: "E",

        descricao: "Encerrado",

        classe: "status-done"

      };

    default:

      return {

        codigo: "",

        descricao: "",

        classe: ""

      };

  }

}