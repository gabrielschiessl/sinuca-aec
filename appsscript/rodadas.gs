/************************************************
 * PROJETO AEC SINUCA
 * Rodadas
 ************************************************/

/************************************************
 * Retorna as rodadas de uma série
 ************************************************/

function getRodadas(serie) {
  const temporada = getTemporadaAtual();

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

  return agruparRodadas(resultado);
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
