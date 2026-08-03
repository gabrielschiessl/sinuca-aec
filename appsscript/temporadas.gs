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
  const participantes = {
    A: montarSugestaoParticipantes(serieA, "A"),
    B: montarSugestaoParticipantes(serieB, "B"),
  };

  return {
    persistida: false,
    temporada,
    versao: 1,
    status: TEMPORADA_STATUS.PREPARACAO,
    participantes,
    rodadas: gerarChaveamentoTemporada(participantes),
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
  const partidas = getSheetAsObjects(SHEETS.temporadasRodadas)
    .filter(
      (item) =>
        Number(item.temporada) === temporada &&
        (Number(item.versao) || 1) === versao,
    )
    .map(normalizarRodadaTemporada);
  const participantesNormalizados = {
    A: participantes
      .filter((item) => String(item.divisao).trim().toUpperCase() === "A")
      .map(normalizarParticipanteTemporada),
    B: participantes
      .filter((item) => String(item.divisao).trim().toUpperCase() === "B")
      .map(normalizarParticipanteTemporada),
  };
  const rodadas = corrigirFolgasChaveamentoCarregado(
    agruparChaveamentoTemporada(partidas),
    participantesNormalizados,
  );

  return {
    persistida: true,
    temporada,
    versao,
    status: TEMPORADA_STATUS.PREPARACAO,
    participantes: participantesNormalizados,
    rodadas,
    jogadores: getJogadores().sort((a, b) => a.exibicao.localeCompare(b.exibicao, "pt-BR")),
  };
}

function salvarTemporadaPreparacao(dados) {
  garantirEstruturaTemporadas();
  const temporada = validarAnoNovaTemporada(dados.temporada);
  const participantes = validarParticipantesTemporada(dados.participantes);
  const rodadas = validarRodadasTemporadaInformadas(
    dados.rodadas,
    participantes,
  );
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
    const abaTemporadas = planilha.getSheetByName(SHEETS.temporadas);
    const abaParticipantes = planilha.getSheetByName(SHEETS.temporadasParticipantes);
    const abaRodadas = planilha.getSheetByName(SHEETS.temporadasRodadas);
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

    excluirLinhasPorTemporadaVersao(abaRodadas, temporada, versao);
    const linhasRodadas = ["A", "B"].flatMap((divisao) =>
      rodadas[divisao].flatMap((rodada) =>
        rodada.partidas.map((partida) => [
          temporada,
          versao,
          divisao,
          rodada.rodada,
          "REGULAR",
          partida.numero1,
          partida.numero2,
          "",
          "",
          "A",
          "-",
          "-",
          "",
          agora,
          rodada.folga || "",
        ]),
      ),
    );
    if (linhasRodadas.length) {
      abaRodadas
        .getRange(abaRodadas.getLastRow() + 1, 1, linhasRodadas.length, 15)
        .setValues(linhasRodadas);
    }

    delete CACHE[SHEETS.temporadas];
    delete CACHE[SHEETS.temporadasParticipantes];
    delete CACHE[SHEETS.temporadasRodadas];
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
    excluirLinhasPorTemporadaVersao(
      planilha.getSheetByName(SHEETS.temporadasRodadas),
      temporada,
      versao,
    );
    abaTemporadas.deleteRow(indice + 1);
    delete CACHE[SHEETS.temporadas];
    delete CACHE[SHEETS.temporadasParticipantes];
    delete CACHE[SHEETS.temporadasRodadas];
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
  obterOuCriarAba(
    planilha,
    SHEETS.temporadasRodadas,
    [
      "temporada",
      "versao",
      "divisao",
      "rodada",
      "tipo",
      "numero1",
      "numero2",
      "data",
      "hora",
      "status",
      "placar1",
      "placar2",
      "observacao",
      "atualizado_em",
      "folga",
    ],
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
  } else {
    const existentes = aba.getRange(1, 1, 1, Math.max(aba.getLastColumn(), 1))
      .getDisplayValues()[0]
      .map((valor) => String(valor).trim().toLowerCase());
    const ausentes = cabecalhos.filter(
      (cabecalho) => !existentes.includes(String(cabecalho).trim().toLowerCase()),
    );
    if (ausentes.length) {
      aba.getRange(1, aba.getLastColumn() + 1, 1, ausentes.length)
        .setValues([ausentes]);
    }
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

function gerarChaveamentoTemporada(participantes) {
  const resultado = {};
  ["A", "B"].forEach((divisao) => {
    const numeros = participantes[divisao].map((item, indice) =>
      Number(item.numero) || indice + 1,
    );
    resultado[divisao] = gerarRodadasTodosContraTodos(numeros);
    if (divisao === "B" && numeros.length % 2 === 1) {
      resultado[divisao] = padronizarFolgasSerieB(
        resultado[divisao],
        numeros,
      );
    }
    validarChaveamentoTodosContraTodos(resultado[divisao], numeros, divisao);
  });
  return resultado;
}

function gerarRodadasTodosContraTodos(numerosInformados) {
  const numeros = numerosInformados.map(Number);
  if (numeros.length < 2) return [];
  const participantes = numeros.length % 2 === 0 ? [...numeros] : [...numeros, null];
  const totalRodadas = participantes.length - 1;
  const rodadas = [];
  let rotacao = [...participantes];

  for (let indiceRodada = 0; indiceRodada < totalRodadas; indiceRodada += 1) {
    const partidas = [];
    for (let indice = 0; indice < rotacao.length / 2; indice += 1) {
      let numero1 = rotacao[indice];
      let numero2 = rotacao[rotacao.length - 1 - indice];
      if (numero1 === null || numero2 === null) continue;
      if ((indiceRodada + indice) % 2 === 1) {
        const temporario = numero1;
        numero1 = numero2;
        numero2 = temporario;
      }
      partidas.push({ numero1, numero2 });
    }
    const usados = new Set(
      partidas.flatMap((partida) => [partida.numero1, partida.numero2]),
    );
    const folga = numeros.find((numero) => !usados.has(numero)) || null;
    rodadas.push({
      rodada: indiceRodada + 1,
      tipo: "REGULAR",
      folga,
      partidas,
    });
    rotacao = [rotacao[0], rotacao[rotacao.length - 1], ...rotacao.slice(1, -1)];
  }
  return rodadas;
}

function padronizarFolgasSerieB(rodadas, numeros) {
  const porFolga = {};
  rodadas.forEach((rodada) => {
    porFolga[Number(rodada.folga)] = rodada;
  });
  return numeros.map((numero, indice) => ({
    ...porFolga[numero],
    rodada: indice + 1,
    folga: numero,
  }));
}

function validarChaveamentoTodosContraTodos(rodadas, numeros, divisao) {
  const jogadores = new Set(numeros.map(Number));
  const confrontos = new Set();
  rodadas.forEach((rodada) => {
    const usadosNaRodada = new Set();
    rodada.partidas.forEach((partida) => {
      const numero1 = Number(partida.numero1);
      const numero2 = Number(partida.numero2);
      if (!jogadores.has(numero1) || !jogadores.has(numero2) || numero1 === numero2) {
        throw new Error(`O chaveamento da Série ${divisao} contém uma partida inválida.`);
      }
      if (usadosNaRodada.has(numero1) || usadosNaRodada.has(numero2)) {
        throw new Error(`Um participante da Série ${divisao} aparece duas vezes na mesma rodada.`);
      }
      usadosNaRodada.add(numero1);
      usadosNaRodada.add(numero2);
      const chave = [numero1, numero2].sort((a, b) => a - b).join("-");
      if (confrontos.has(chave)) {
        throw new Error(`O confronto ${chave} está duplicado na Série ${divisao}.`);
      }
      confrontos.add(chave);
    });
  });

  const totalEsperado = (numeros.length * (numeros.length - 1)) / 2;
  const totalRodadasEsperado = numeros.length % 2 === 0
    ? numeros.length - 1
    : numeros.length;
  const numerosRodadas = rodadas.map((rodada) => Number(rodada.rodada));
  if (
    rodadas.length !== totalRodadasEsperado ||
    new Set(numerosRodadas).size !== rodadas.length ||
    numerosRodadas.some((numero, indice) => numero !== indice + 1)
  ) {
    throw new Error(`A Série ${divisao} deve possuir ${totalRodadasEsperado} rodadas regulares numeradas em sequência.`);
  }
  if (divisao === "B" && numeros.length % 2 === 1) {
    const folgas = rodadas.map((rodada) => Number(rodada.folga));
    const folgasValidas = folgas.every(
      (numero, indice) => numero === indice + 1 && jogadores.has(numero),
    );
    if (!folgasValidas || new Set(folgas).size !== numeros.length) {
      throw new Error("Na Série B ímpar, a rodada N deve dar folga exclusivamente ao participante nº N.");
    }
  }
  if (confrontos.size !== totalEsperado) {
    throw new Error(`O chaveamento da Série ${divisao} não contém todos os confrontos necessários.`);
  }
}

function validarRodadasTemporadaInformadas(valor, participantes) {
  if (!valor || !Array.isArray(valor.A) || !Array.isArray(valor.B)) {
    return gerarChaveamentoTemporada(participantes);
  }

  const resultado = {};
  ["A", "B"].forEach((divisao) => {
    resultado[divisao] = valor[divisao].map((rodada, indice) => ({
      rodada: indice + 1,
      tipo: "REGULAR",
      folga: Number(rodada.folga) || null,
      partidas: (Array.isArray(rodada.partidas) ? rodada.partidas : []).map(
        (partida) => ({
          numero1: Number(partida.numero1),
          numero2: Number(partida.numero2),
        }),
      ),
    }));
    const numeros = participantes[divisao].map((_, indice) => indice + 1);
    validarChaveamentoTodosContraTodos(resultado[divisao], numeros, divisao);
  });
  return resultado;
}

function normalizarRodadaTemporada(item) {
  return {
    divisao: String(item.divisao).trim().toUpperCase(),
    rodada: Number(item.rodada),
    tipo: item.tipo || "REGULAR",
    numero1: Number(item.numero1),
    numero2: Number(item.numero2),
    data: item.data || "",
    hora: item.hora || "",
    status: item.status || "A",
    folga: Number(item.folga) || null,
  };
}

function agruparChaveamentoTemporada(partidas) {
  const resultado = { A: [], B: [] };
  ["A", "B"].forEach((divisao) => {
    const mapa = {};
    partidas
      .filter((item) => item.divisao === divisao)
      .forEach((partida) => {
        if (!mapa[partida.rodada]) {
          mapa[partida.rodada] = {
            rodada: partida.rodada,
          tipo: partida.tipo,
          folga: partida.folga,
            partidas: [],
          };
        }
        mapa[partida.rodada].partidas.push({
          numero1: partida.numero1,
          numero2: partida.numero2,
          data: partida.data,
          hora: partida.hora,
          status: partida.status,
        });
      });
    resultado[divisao] = Object.values(mapa).sort((a, b) => a.rodada - b.rodada);
  });
  return resultado;
}

function corrigirFolgasChaveamentoCarregado(rodadas, participantes) {
  if (participantes.B.length % 2 === 0 || !rodadas.B.length) return rodadas;
  const numeros = participantes.B.map((_, indice) => indice + 1);
  const comFolgas = rodadas.B.map((rodada) => {
    const usados = new Set(
      rodada.partidas.flatMap((partida) => [partida.numero1, partida.numero2]),
    );
    return {
      ...rodada,
      folga: Number(rodada.folga) || numeros.find((numero) => !usados.has(numero)),
    };
  });
  rodadas.B = padronizarFolgasSerieB(comFolgas, numeros);
  return rodadas;
}

function excluirLinhasPorTemporadaVersao(aba, temporada, versao) {
  const valores = aba.getDataRange().getDisplayValues();
  for (let indice = valores.length - 1; indice >= 1; indice -= 1) {
    if (Number(valores[indice][0]) === temporada && (Number(valores[indice][1]) || 1) === versao) {
      aba.deleteRow(indice + 1);
    }
  }
}
