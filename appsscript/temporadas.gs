/************************************************
 * PROJETO AEC SINUCA
 * Temporadas e versões em preparação
 ************************************************/

const TEMPORADA_STATUS = {
  ATIVA: "ATIVA",
  PREPARACAO: "PREPARACAO",
  ARQUIVADA: "ARQUIVADA",
};

function getTemporadasAdmin() {
  garantirEstruturaTemporadas();
  const temporadaAtual = getTemporadaAtual();
  const registros = getSheetAsObjects(SHEETS.temporadas);
  const participantes = getSheetAsObjects(SHEETS.temporadasParticipantes);
  const participantesAtuais = getSheetAsObjects(SHEETS.participantes);

  return {
    temporada_atual: temporadaAtual,
    ano_minimo: new Date().getFullYear(),
    temporadas: registros
      .map((registro) => {
        const temporada = Number(registro.temporada);
        const versao = Number(registro.versao) || 1;
        const origemParticipantes =
          String(registro.status).trim().toUpperCase() === TEMPORADA_STATUS.ATIVA
            ? participantesAtuais
            : participantes;
        const vinculados = origemParticipantes.filter(
          (participante) =>
            Number(participante.temporada) === temporada &&
            (origemParticipantes === participantesAtuais ||
              (Number(participante.versao) || 1) === versao),
        );
        return {
          temporada,
          versao,
          status: String(registro.status).trim().toUpperCase(),
          tipo: registro.tipo || "NOVA",
          criado_em: registro.criado_em,
          atualizado_em: registro.atualizado_em,
          participantes_a: vinculados.filter((item) => String(item.divisao).trim().toUpperCase() === "A").length,
          participantes_b: vinculados.filter((item) => String(item.divisao).trim().toUpperCase() === "B").length,
        };
      })
      .sort((a, b) => b.temporada - a.temporada || b.versao - a.versao),
  };
}

function prepararNovaTemporada(temporadaInformada) {
  garantirEstruturaTemporadas();
  const temporada = validarAnoNovaTemporada(temporadaInformada);
  const existente = getSheetAsObjects(SHEETS.temporadas).some(
    (registro) => Number(registro.temporada) === temporada,
  );
  if (existente) throw new Error(`A temporada ${temporada} já existe.`);

  const classificacaoA = getEstatisticas("A").classificacao;
  const classificacaoB = getEstatisticas("B").classificacao;
  const serieA = [
    ...classificacaoA.slice(0, 16),
    ...classificacaoB.slice(0, 4),
  ];
  const serieB = [
    ...classificacaoB.slice(4),
    ...classificacaoA.slice(-4),
  ];

  return {
    persistida: false,
    temporada,
    versao: 1,
    status: TEMPORADA_STATUS.PREPARACAO,
    participantes: {
      A: montarSugestaoParticipantes(serieA, "A"),
      B: montarSugestaoParticipantes(serieB, "B"),
    },
    jogadores: getJogadores().sort((a, b) => a.exibicao.localeCompare(b.exibicao, "pt-BR")),
  };
}

function getTemporadaPreparacao(temporadaInformada) {
  garantirEstruturaTemporadas();
  const temporada = Number(temporadaInformada);
  const registro = getSheetAsObjects(SHEETS.temporadas).find(
    (item) =>
      Number(item.temporada) === temporada &&
      String(item.status).trim().toUpperCase() === TEMPORADA_STATUS.PREPARACAO,
  );
  if (!registro) throw new Error("Temporada em preparação não encontrada.");

  const versao = Number(registro.versao) || 1;
  const participantes = getSheetAsObjects(SHEETS.temporadasParticipantes)
    .filter(
      (item) =>
        Number(item.temporada) === temporada &&
        (Number(item.versao) || 1) === versao,
    )
    .sort((a, b) => Number(a.numero) - Number(b.numero));

  return {
    persistida: true,
    temporada,
    versao,
    status: TEMPORADA_STATUS.PREPARACAO,
    participantes: {
      A: participantes.filter((item) => String(item.divisao).trim().toUpperCase() === "A").map(normalizarParticipanteTemporada),
      B: participantes.filter((item) => String(item.divisao).trim().toUpperCase() === "B").map(normalizarParticipanteTemporada),
    },
    jogadores: getJogadores().sort((a, b) => a.exibicao.localeCompare(b.exibicao, "pt-BR")),
  };
}

function salvarTemporadaPreparacao(dados) {
  garantirEstruturaTemporadas();
  const temporada = validarAnoNovaTemporada(dados.temporada);
  const participantes = validarParticipantesTemporada(dados.participantes);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
    const abaTemporadas = planilha.getSheetByName(SHEETS.temporadas);
    const abaParticipantes = planilha.getSheetByName(SHEETS.temporadasParticipantes);
    const registros = abaTemporadas.getDataRange().getDisplayValues();
    const indice = registros.findIndex(
      (linha, linhaIndice) => linhaIndice > 0 && Number(linha[0]) === temporada,
    );
    const agora = new Date();
    const versao = indice > 0 ? Number(registros[indice][1]) || 1 : 1;

    if (indice > 0 && String(registros[indice][2]).trim().toUpperCase() !== TEMPORADA_STATUS.PREPARACAO) {
      throw new Error("Somente temporadas em preparação podem ser alteradas.");
    }
    if (indice > 0) {
      abaTemporadas.getRange(indice + 1, 6).setValue(agora);
    } else {
      abaTemporadas.appendRow([
        temporada,
        versao,
        TEMPORADA_STATUS.PREPARACAO,
        "NOVA",
        agora,
        agora,
      ]);
    }

    excluirLinhasPorTemporadaVersao(abaParticipantes, temporada, versao);
    const linhas = ["A", "B"].flatMap((divisao) =>
      participantes[divisao].map((participante, indiceParticipante) => [
        temporada,
        versao,
        divisao,
        indiceParticipante + 1,
        participante.jogador_id,
      ]),
    );
    if (linhas.length) {
      abaParticipantes
        .getRange(abaParticipantes.getLastRow() + 1, 1, linhas.length, 5)
        .setValues(linhas);
    }

    delete CACHE[SHEETS.temporadas];
    delete CACHE[SHEETS.temporadasParticipantes];
    return { sucesso: true, ...getTemporadaPreparacao(temporada) };
  } finally {
    lock.releaseLock();
  }
}

function excluirTemporadaPreparacao(temporadaInformada) {
  garantirEstruturaTemporadas();
  const temporada = Number(temporadaInformada);
  if (temporada <= getTemporadaAtual()) {
    throw new Error("A temporada atual ou uma temporada histórica não pode ser excluída.");
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
    const abaTemporadas = planilha.getSheetByName(SHEETS.temporadas);
    const registros = abaTemporadas.getDataRange().getDisplayValues();
    const indice = registros.findIndex(
      (linha, linhaIndice) =>
        linhaIndice > 0 &&
        Number(linha[0]) === temporada &&
        String(linha[2]).trim().toUpperCase() === TEMPORADA_STATUS.PREPARACAO,
    );
    if (indice < 1) throw new Error("Temporada em preparação não encontrada.");
    const versao = Number(registros[indice][1]) || 1;

    excluirLinhasPorTemporadaVersao(
      planilha.getSheetByName(SHEETS.temporadasParticipantes),
      temporada,
      versao,
    );
    abaTemporadas.deleteRow(indice + 1);
    delete CACHE[SHEETS.temporadas];
    delete CACHE[SHEETS.temporadasParticipantes];
    return { sucesso: true, ...getTemporadasAdmin() };
  } finally {
    lock.releaseLock();
  }
}

function garantirEstruturaTemporadas() {
  const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
  const abaTemporadas = obterOuCriarAba(
    planilha,
    SHEETS.temporadas,
    ["temporada", "versao", "status", "tipo", "criado_em", "atualizado_em"],
  );
  obterOuCriarAba(
    planilha,
    SHEETS.temporadasParticipantes,
    ["temporada", "versao", "divisao", "numero", "jogador_id"],
  );

  const temporadaAtual = getTemporadaAtual();
  const existeAtual = abaTemporadas.getDataRange().getDisplayValues().slice(1)
    .some((linha) => Number(linha[0]) === temporadaAtual);
  if (!existeAtual) {
    const agora = new Date();
    abaTemporadas.appendRow([
      temporadaAtual,
      1,
      TEMPORADA_STATUS.ATIVA,
      "ATUAL",
      agora,
      agora,
    ]);
    delete CACHE[SHEETS.temporadas];
  }
}

function obterOuCriarAba(planilha, nome, cabecalhos) {
  let aba = planilha.getSheetByName(nome);
  if (!aba) {
    aba = planilha.insertSheet(nome);
    aba.getRange(1, 1, 1, cabecalhos.length).setValues([cabecalhos]);
    aba.setFrozenRows(1);
  }
  return aba;
}

function validarAnoNovaTemporada(valor) {
  const temporada = Number(valor);
  const anoMinimo = new Date().getFullYear();
  if (!Number.isInteger(temporada) || temporada < anoMinimo || temporada <= getTemporadaAtual()) {
    throw new Error(`Informe um ano posterior à temporada atual e não inferior a ${anoMinimo}.`);
  }
  return temporada;
}

function montarSugestaoParticipantes(classificacao, divisao) {
  return classificacao.map((jogador, indice) => ({
    temporada: null,
    versao: 1,
    divisao,
    numero: indice + 1,
    jogador_id: Number(jogador.jogador_id),
  }));
}

function normalizarParticipanteTemporada(item) {
  return {
    temporada: Number(item.temporada),
    versao: Number(item.versao) || 1,
    divisao: String(item.divisao).trim().toUpperCase(),
    numero: Number(item.numero),
    jogador_id: Number(item.jogador_id),
  };
}

function validarParticipantesTemporada(valor) {
  const participantes = valor || {};
  const resultado = { A: [], B: [] };
  const jogadoresExistentes = new Set(getJogadores().map((jogador) => jogador.id));

  ["A", "B"].forEach((divisao) => {
    const lista = Array.isArray(participantes[divisao]) ? participantes[divisao] : [];
    resultado[divisao] = lista.map((item) => ({ jogador_id: Number(item.jogador_id) }));
    if (resultado[divisao].some((item) => !jogadoresExistentes.has(item.jogador_id))) {
      throw new Error(`A Série ${divisao} possui um jogador inválido.`);
    }
  });

  if (resultado.A.length !== 20) {
    throw new Error("A Série A deve possuir exatamente 20 participantes.");
  }
  if (resultado.B.length < 2) {
    throw new Error("A Série B deve possuir pelo menos 2 participantes.");
  }
  const ids = [...resultado.A, ...resultado.B].map((item) => item.jogador_id);
  if (new Set(ids).size !== ids.length) {
    throw new Error("Um jogador não pode participar de duas vagas na mesma temporada.");
  }
  return resultado;
}

function excluirLinhasPorTemporadaVersao(aba, temporada, versao) {
  const valores = aba.getDataRange().getDisplayValues();
  for (let indice = valores.length - 1; indice >= 1; indice -= 1) {
    if (Number(valores[indice][0]) === temporada && (Number(valores[indice][1]) || 1) === versao) {
      aba.deleteRow(indice + 1);
    }
  }
}
