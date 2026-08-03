/************************************************
 * PROJETO AEC SINUCA
 * Estatísticas e classificação
 ************************************************/

function getEstatisticas(serie, temporadaInformada) {
  const temporada = validarTemporadaPublica(temporadaInformada);
  const divisao = String(serie).trim().toUpperCase();
  const participantes = getSheetAsObjects(SHEETS.participantes);
  const jogadores = getSheetAsObjects(SHEETS.jogadores);
  const partidas = getSheetAsObjects(SHEETS.rodadas);

  return calcularEstatisticasSerie({
    temporada,
    divisao,
    participantes,
    jogadores,
    partidas,
  });
}

function getTemporadasPublicas() {
  garantirEstruturaTemporadas();
  const temporadaAtual = getTemporadaAtual();
  return {
    temporada_atual: temporadaAtual,
    temporadas: getSheetAsObjects(SHEETS.temporadas)
      .filter((item) => {
        const status = String(item.status).trim().toUpperCase();
        return status === TEMPORADA_STATUS.ATIVA || status === TEMPORADA_STATUS.ARQUIVADA;
      })
      .map((item) => Number(item.temporada))
      .filter(Number.isInteger)
      .sort((a, b) => b - a),
  };
}

function validarTemporadaPublica(valor) {
  if (valor === "" || valor === null || valor === undefined) {
    return getTemporadaAtual();
  }
  const temporada = Number(valor);
  const publica = getSheetAsObjects(SHEETS.temporadas).some((item) =>
    Number(item.temporada) === temporada &&
    [TEMPORADA_STATUS.ATIVA, TEMPORADA_STATUS.ARQUIVADA].includes(
      String(item.status).trim().toUpperCase(),
    ),
  );
  if (!Number.isInteger(temporada) || !publica) {
    throw new Error("Temporada não encontrada no histórico.");
  }
  return temporada;
}

function calcularEstatisticasSerie({
  temporada,
  divisao,
  participantes,
  jogadores,
  partidas,
}) {
  const participantesDaSerie = participantes
    .filter(
      (participante) =>
        Number(participante.temporada) === Number(temporada) &&
        String(participante.divisao).trim().toUpperCase() === divisao,
    )
    .sort((a, b) => Number(a.numero) - Number(b.numero));

  const partidasDaSerie = partidas.filter(
    (partida) =>
      Number(partida.temporada) === Number(temporada) &&
      String(partida.divisao).trim().toUpperCase() === divisao,
  );

  const jogadoresPorId = {};
  const estatisticasPorNumero = {};

  jogadores.forEach((jogador) => {
    jogadoresPorId[Number(jogador.id)] = jogador;
  });

  participantesDaSerie.forEach((participante) => {
    const numero = Number(participante.numero);
    const jogador = jogadoresPorId[Number(participante.jogador_id)];

    if (!jogador) {
      return;
    }

    estatisticasPorNumero[numero] = {
      numero,
      jogador_id: Number(jogador.id),
      nome: jogador.nome,
      exibicao: jogador.exibicao || jogador.nome,
      apelido: jogador.apelido || jogador.exibicao || jogador.nome,
      vitorias: 0,
      partidas_vencidas: 0,
      resultados: [],
    };
  });

  partidasDaSerie.forEach((partida) => {
    if (String(partida.status).trim().toUpperCase() !== "E") return;

    const placar1 = normalizarPlacar(partida.placar1);
    const placar2 = normalizarPlacar(partida.placar2);

    if (placar1 === null || placar2 === null) return;

    const jogador1 = estatisticasPorNumero[Number(partida.numero1)];
    const jogador2 = estatisticasPorNumero[Number(partida.numero2)];

    if (!jogador1 || !jogador2) return;

    jogador1.partidas_vencidas += placar1;
    jogador2.partidas_vencidas += placar2;

    if (placar1 === 2) jogador1.vitorias += 1;
    if (placar2 === 2) jogador2.vitorias += 1;

    jogador1.resultados.push(
      montarResultado(partida, placar1, placar2, jogador2),
    );
    jogador2.resultados.push(
      montarResultado(partida, placar2, placar1, jogador1),
    );
  });

  const totalRodadas = partidasDaSerie.reduce(
    (maior, partida) => Math.max(maior, Number(partida.rodada) || 0),
    0,
  );
  const jogadoresOrdenados = Object.values(estatisticasPorNumero).map(
    (jogador) => ({
      ...jogador,
      resultados: jogador.resultados.sort((a, b) => a.rodada - b.rodada),
    }),
  );
  const classificacao = jogadoresOrdenados
    .map((jogador) => ({ ...jogador }))
    .sort(
      (a, b) =>
        b.vitorias - a.vitorias ||
        b.partidas_vencidas - a.partidas_vencidas ||
        a.numero - b.numero,
    )
    .map((jogador, indice, lista) => ({
      ...jogador,
      posicao: indice + 1,
      zona: getZonaClassificacao(divisao, indice + 1, lista.length),
    }));

  return {
    temporada: Number(temporada),
    divisao,
    total_rodadas: totalRodadas,
    total_participantes: jogadoresOrdenados.length,
    jogadores: jogadoresOrdenados,
    classificacao,
  };
}

function normalizarPlacar(valor) {
  if (valor === "" || valor === null || valor === undefined || valor === "-") {
    return null;
  }

  const placar = Number(valor);

  return Number.isFinite(placar) ? placar : null;
}

function montarResultado(partida, placarProprio, placarAdversario, adversario) {
  return {
    rodada: Number(partida.rodada),
    resultado: placarProprio === 2 ? "V" : "D",
    placar: `${placarProprio} x ${placarAdversario}`,
    placar_proprio: placarProprio,
    placar_adversario: placarAdversario,
    adversario: {
      numero: adversario.numero,
      jogador_id: adversario.jogador_id,
      exibicao: adversario.exibicao,
    },
  };
}

function getZonaClassificacao(divisao, posicao, totalParticipantes) {
  if (divisao === "A") {
    if (posicao === 1) return "lider";
    if (posicao > totalParticipantes - 4) return "rebaixamento";
  }

  if (divisao === "B" && posicao <= Math.min(4, totalParticipantes)) {
    return "acesso";
  }

  return "";
}
