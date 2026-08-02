/************************************************
 * PROJETO AEC SINUCA
 * Participantes
 ************************************************/

/************************************************
 * Retorna o participante de uma temporada
 ************************************************/

function getParticipante(temporada, divisao, numero) {
  const participantes = getSheetAsObjects(SHEETS.participantes);

  return participantes.find(
    (p) =>
      Number(p.temporada) === Number(temporada) &&
      p.divisao === divisao &&
      Number(p.numero) === Number(numero),
  );
}

function getParticipantesAdmin(divisaoInformada) {
  const temporada = getTemporadaAtual();
  const divisao = String(divisaoInformada || "").trim().toUpperCase();
  if (!["A", "B"].includes(divisao)) throw new Error("Divisão inválida.");

  const jogadores = getJogadores();
  const jogadoresPorId = {};
  jogadores.forEach((jogador) => { jogadoresPorId[jogador.id] = jogador; });

  const participantesTemporada = getSheetAsObjects(SHEETS.participantes)
    .filter((participante) => Number(participante.temporada) === Number(temporada));
  const participantes = participantesTemporada
    .filter((participante) =>
      String(participante.divisao).trim().toUpperCase() === divisao,
    )
    .sort((a, b) => Number(a.numero) - Number(b.numero))
    .map((participante) => ({
      temporada: Number(temporada),
      divisao,
      numero: Number(participante.numero),
      jogador_id: Number(participante.jogador_id),
      jogador: jogadoresPorId[Number(participante.jogador_id)] || null,
    }));

  const idsAtuais = new Set(participantes.map((participante) => participante.jogador_id));
  const idsOcupadosEmOutraDivisao = new Set(participantesTemporada
    .filter((participante) => String(participante.divisao).trim().toUpperCase() !== divisao)
    .map((participante) => Number(participante.jogador_id)));
  return {
    temporada: Number(temporada),
    divisao,
    participantes,
    jogadores: jogadores.filter((jogador) => idsAtuais.has(jogador.id) || (jogador.ativo && !idsOcupadosEmOutraDivisao.has(jogador.id))),
  };
}

function salvarParticipantesAdmin(dados) {
  const temporada = getTemporadaAtual();
  const divisao = String(dados.divisao || "").trim().toUpperCase();
  const alteracoes = Array.isArray(dados.participantes) ? dados.participantes : [];

  if (!["A", "B"].includes(divisao) || !alteracoes.length) {
    throw new Error("Nenhuma alteração de participante foi informada.");
  }

  const jogadores = getJogadores();
  const jogadoresValidos = new Set(jogadores.filter((jogador) => jogador.ativo).map((jogador) => jogador.id));
  alteracoes.forEach((alteracao) => {
    if (!Number(alteracao.numero) || !jogadoresValidos.has(Number(alteracao.jogador_id))) {
      throw new Error("Um dos participantes informados é inválido ou está inativo.");
    }
  });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
    const aba = planilha.getSheetByName(SHEETS.participantes);
    const valores = aba.getDataRange().getDisplayValues();
    const cabecalhos = valores[0].map((valor) => String(valor).trim().toLowerCase());
    const coluna = (nome) => cabecalhos.indexOf(nome);
    const obrigatorias = ["temporada", "divisao", "numero", "jogador_id"];
    if (obrigatorias.some((nome) => coluna(nome) < 0)) {
      throw new Error("A estrutura da aba Participantes está incompleta.");
    }

    const linhasTemporada = valores.slice(1).map((linha, indice) => ({ linha, indice: indice + 2 }))
      .filter(({ linha }) => Number(linha[coluna("temporada")]) === Number(temporada));
    const porChave = {};
    linhasTemporada.forEach(({ linha, indice }) => {
      porChave[`${String(linha[coluna("divisao")]).trim().toUpperCase()}-${Number(linha[coluna("numero")])}`] = { linha, indice };
    });

    const estadoFinal = linhasTemporada.map(({ linha }) => ({
      divisao: String(linha[coluna("divisao")]).trim().toUpperCase(),
      numero: Number(linha[coluna("numero")]),
      jogador_id: Number(linha[coluna("jogador_id")]),
    }));
    alteracoes.forEach((alteracao) => {
      const registro = estadoFinal.find((item) => item.divisao === divisao && item.numero === Number(alteracao.numero));
      if (!registro || !porChave[`${divisao}-${Number(alteracao.numero)}`]) {
        throw new Error(`Participante nº ${alteracao.numero} não encontrado na Série ${divisao}.`);
      }
      registro.jogador_id = Number(alteracao.jogador_id);
    });

    const idsDuplicados = estadoFinal.map((item) => item.jogador_id).filter((id, indice, lista) => id && lista.indexOf(id) !== indice);
    if (idsDuplicados.length) throw new Error("Um jogador não pode ocupar mais de uma vaga na mesma temporada.");

    alteracoes.forEach((alteracao) => {
      const registro = porChave[`${divisao}-${Number(alteracao.numero)}`];
      aba.getRange(registro.indice, coluna("jogador_id") + 1).setValue(Number(alteracao.jogador_id));
    });
    delete CACHE[SHEETS.participantes];
    return { sucesso: true, ...getParticipantesAdmin(divisao) };
  } finally {
    lock.releaseLock();
  }
}
