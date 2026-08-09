/************************************************
 * PROJETO AEC SINUCA
 * Rodadas
 ************************************************/

/************************************************
 * Retorna as rodadas de uma série
 ************************************************/

function getRodadas(serie, temporadaInformada) {
  const temporada = validarTemporadaPublica(temporadaInformada);

  const serieNormalizada = String(serie).trim().toUpperCase();

  const partidas = getSheetAsObjects(SHEETS.rodadas);

  const filtradas = partidas.filter((partida) => {
    const temporadaPartida = Number(partida.temporada);

    const divisaoPartida = String(partida.divisao).trim().toUpperCase();

    return (
      temporadaPartida === Number(temporada) &&
      divisaoPartida === serieNormalizada
    );
  });

  const resultado = filtradas.map((partida) =>
    montarPartida(partida, temporada, serieNormalizada),
  );

  const rodadas = agruparRodadas(resultado);
  if (serieNormalizada !== "B") return rodadas;

  const participantes = getSheetAsObjects(SHEETS.participantes)
    .filter((participante) =>
      Number(participante.temporada) === Number(temporada) &&
      String(participante.divisao).trim().toUpperCase() === serieNormalizada,
    );
  if (participantes.length % 2 === 0) return rodadas;

  rodadas.forEach((rodada) => {
    const numerosEmJogo = new Set(
      rodada.partidas.flatMap((partida) => [
        Number(partida.jogador1.numero),
        Number(partida.jogador2.numero),
      ]),
    );
    const participante = participantes.find(
      (item) => !numerosEmJogo.has(Number(item.numero)),
    );
    if (!participante) return;
    const jogador = getJogador(participante.jogador_id);
    rodada.folga = {
      id: Number(jogador.id),
      numero: Number(participante.numero),
      nome: jogador.nome,
      exibicao: jogador.exibicao,
      apelido: jogador.apelido,
    };
  });
  return rodadas;
}

function getPartidasAdmin(serie) {
  return getRodadas(serie).map((rodada) => ({
    ...rodada,
    partidas: rodada.partidas.map((partida) => ({
      ...partida,
      edicao: { pode_editar: true, pode_salvar: true },
    })),
  }));
}

function salvarPartidaAdmin(dados) {
  const divisao = String(dados.divisao || "").trim().toUpperCase();
  const temporada = getTemporadaAtual();
  const rodada = Number(dados.rodada);
  const numero1 = Number(dados.numero1);
  const numero2 = Number(dados.numero2);
  if (!['A', 'B'].includes(divisao) || !rodada || !numero1 || !numero2) {
    throw new Error("Partida inválida ou incompleta.");
  }
  const validado = prepararEstadoPartidaAdmin(
    dados,
    temporada,
    divisao,
    numero1,
    numero2,
  );

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
    const aba = planilha.getSheetByName(SHEETS.rodadas);
    const valores = aba.getDataRange().getDisplayValues();
    const cabecalhos = valores[0].map((valor) =>
      String(valor).trim().toLowerCase(),
    );
    const coluna = (nome) => cabecalhos.indexOf(nome);
    const indice = valores.findIndex(
      (linha, linhaIndice) =>
        linhaIndice > 0 &&
        Number(linha[coluna("temporada")]) === temporada &&
        String(linha[coluna("divisao")]).trim().toUpperCase() === divisao &&
        Number(linha[coluna("rodada")]) === rodada &&
        Number(linha[coluna("numero1")]) === numero1 &&
        Number(linha[coluna("numero2")]) === numero2,
    );

    if (indice < 1) throw new Error("Partida não encontrada.");

    const linhaPlanilha = indice + 1;
    aba.getRange(linhaPlanilha, coluna("status") + 1).setValue(validado.status);
    aba
      .getRange(linhaPlanilha, coluna("placar1") + 1)
      .setValue(validado.placar1);
    aba
      .getRange(linhaPlanilha, coluna("placar2") + 1)
      .setValue(validado.placar2);
    aba
      .getRange(linhaPlanilha, coluna("observacao") + 1)
      .setValue(validado.observacao);
    aba
      .getRange(linhaPlanilha, coluna("atualizado_em") + 1)
      .setValue(new Date());

    return {
      sucesso: true,
      status: validado.status,
      placar1: validado.placar1,
      placar2: validado.placar2,
      observacao: validado.observacao,
    };
  } finally {
    lock.releaseLock();
  }
}

function salvarPartidasAdmin(dados) {
  const partidas = Array.isArray(dados.partidas) ? dados.partidas : [];
  if (!partidas.length) throw new Error("Nenhuma partida foi informada.");

  partidas.forEach((partida) => {
    const divisao = String(partida.divisao || "").trim().toUpperCase();
    if (!["A", "B"].includes(divisao) || !Number(partida.rodada) || !Number(partida.numero1) || !Number(partida.numero2)) {
      throw new Error("Uma das partidas está inválida ou incompleta.");
    }
    const numeroPerdedorWo = Number(partida.wo_perdedor) || null;
    const woAmbos = partida.wo_ambos === true || String(partida.wo_ambos).toLowerCase() === "true";
    if (
      numeroPerdedorWo !== null &&
      ![Number(partida.numero1), Number(partida.numero2)].includes(numeroPerdedorWo)
    ) {
      throw new Error("O jogador indicado para o W.O. não pertence à partida.");
    }
    if (numeroPerdedorWo === null && !woAmbos) {
      validarEstadoPartida(partida.status, partida.placar1, partida.placar2);
    }
  });

  const resultados = partidas.map((partida) => ({
    divisao: String(partida.divisao).trim().toUpperCase(),
    rodada: Number(partida.rodada),
    numero1: Number(partida.numero1),
    numero2: Number(partida.numero2),
    ...salvarPartidaAdmin(partida),
  }));

  delete CACHE[SHEETS.rodadas];

  return { sucesso: true, partidas: resultados };
}

function validarEstadoPartida(statusInformado, placar1Informado, placar2Informado) {
  let status = String(statusInformado || "").trim().toUpperCase();

  if (!['A', 'V', 'E'].includes(status)) {
    throw new Error("Selecione um status válido para a partida.");
  }

  const vazio1 = placar1Informado === "" || placar1Informado === null || placar1Informado === undefined || placar1Informado === "-";
  const vazio2 = placar2Informado === "" || placar2Informado === null || placar2Informado === undefined || placar2Informado === "-";

  if (status === 'A') {
    if (!vazio1 || !vazio2) {
      throw new Error("Partida agendada não pode possuir placar.");
    }
    return { status: 'A', placar1: '-', placar2: '-' };
  }

  if (vazio1 || vazio2) {
    throw new Error("Informe os dois placares para uma partida ao vivo ou encerrada.");
  }

  const placar1 = Number(placar1Informado);
  const placar2 = Number(placar2Informado);
  const valido = (placar) => Number.isInteger(placar) && placar >= 0 && placar <= 2;

  if (!valido(placar1) || !valido(placar2)) {
    throw new Error("O placar deve conter valores inteiros entre 0 e 2.");
  }

  if (placar1 === 2 || placar2 === 2) status = 'E';

  if (status === 'V' && (placar1 > 1 || placar2 > 1)) {
    throw new Error("Partida ao vivo aceita somente placares até 1 ponto.");
  }

  if (status === 'E') {
    const vencedores = [placar1, placar2].filter((placar) => placar === 2).length;
    if (vencedores !== 1 || placar1 === placar2) {
      throw new Error("Partida encerrada exige exatamente um jogador com 2 pontos.");
    }
  }

  return { status, placar1, placar2 };
}

function prepararEstadoPartidaAdmin(dados, temporada, divisao, numero1, numero2) {
  const woAmbos = dados.wo_ambos === true || String(dados.wo_ambos).toLowerCase() === "true";
  if (woAmbos) {
    return {
      status: "E",
      placar1: 0,
      placar2: 0,
      observacao: "W.O.: ambos abandonaram a competição",
    };
  }

  const numeroPerdedorWo = Number(dados.wo_perdedor) || null;
  if (numeroPerdedorWo !== null) {
    if (![numero1, numero2].includes(numeroPerdedorWo)) {
      throw new Error("O jogador indicado para o W.O. não pertence à partida.");
    }
    const participante = getParticipante(
      temporada,
      divisao,
      numeroPerdedorWo,
    );
    const jogador = participante && getJogador(participante.jogador_id);
    if (!jogador) throw new Error("Não foi possível identificar o jogador que perdeu por W.O.");
    return {
      status: "E",
      placar1: numeroPerdedorWo === numero1 ? 0 : 2,
      placar2: numeroPerdedorWo === numero2 ? 0 : 2,
      observacao: `W.O.: ${jogador.exibicao || jogador.nome}`,
    };
  }

  const estado = validarEstadoPartida(dados.status, dados.placar1, dados.placar2);
  const observacao = String(dados.observacao || "").trim();
  if (observacao.length > 300) {
    throw new Error("A observação da partida deve possuir no máximo 300 caracteres.");
  }
  return { ...estado, observacao };
}

/************************************************
 * Monta uma partida completa
 ************************************************/
function montarPartida(partida, temporada, divisao) {
  const participante1 = getParticipante(temporada, divisao, partida.numero1);

  const participante2 = getParticipante(temporada, divisao, partida.numero2);

  const jogador1 = getJogador(participante1.jogador_id);

  const jogador2 = getJogador(participante2.jogador_id);

  return {
    rodada: Number(partida.rodada),

    data: partida.data,

    hora: partida.hora.split(":").slice(0, 2).join(":"),

    status: getStatusInfo(partida.status),

    jogador1: {
      id: Number(jogador1.id),

      numero: Number(participante1.numero),

      nome: jogador1.nome,

      exibicao: jogador1.exibicao,

      apelido: jogador1.apelido,
    },

    jogador2: {
      id: Number(jogador2.id),

      numero: Number(participante2.numero),

      nome: jogador2.nome,

      exibicao: jogador2.exibicao,

      apelido: jogador2.apelido,
    },

    placar1: partida.placar1 || "-",
    placar2: partida.placar2 || "-",

    observacao: {
      texto: partida.observacao,

      tipo: "",
    },

    atualizado_em: partida.atualizado_em,

    id: `${temporada}-${divisao}-${partida.rodada}-${partida.numero1}-${partida.numero2}`,
    edicao: {
      pode_editar: false,

      pode_salvar: false,
    },
  };
}
