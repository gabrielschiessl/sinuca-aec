/************************************************
 * PROJETO AEC SINUCA
 * Jogadores
 ************************************************/

/************************************************
 * Retorna os jogadores das Séries A e B
 ************************************************/

function getJogadores() {
  const dados = getSheetAsObjects(SHEETS.jogadores);

  return dados
    .filter((jogador) => jogador.id)
    .map((jogador) => ({
      id: Number(jogador.id),
      nome: jogador.nome,
      exibicao: jogador.exibicao || jogador.nome,
      apelido: jogador.apelido || jogador.exibicao || jogador.nome,
      ativo: String(jogador.ativo).trim().toUpperCase() === "S",
    }));
}

/************************************************
 * Retorna um jogador pelo ID
 ************************************************/

function getJogador(id) {
  const jogadores = getSheetAsObjects(SHEETS.jogadores);

  return jogadores.find((j) => Number(j.id) === Number(id));
}

/************************************************
 * Gestão administrativa de jogadores
 ************************************************/

function getJogadoresAdmin() {
  const temporada = getTemporadaAtual();
  const vinculados = {};

  getSheetAsObjects(SHEETS.participantes)
    .filter((participante) => Number(participante.temporada) === temporada)
    .forEach((participante) => {
      vinculados[Number(participante.jogador_id)] = {
        divisao: String(participante.divisao).trim().toUpperCase(),
        numero: Number(participante.numero),
      };
    });

  return {
    temporada,
    jogadores: getJogadores()
      .sort((a, b) => a.exibicao.localeCompare(b.exibicao, "pt-BR"))
      .map((jogador) => ({
        ...jogador,
        participante_atual: vinculados[jogador.id] || null,
      })),
  };
}

function salvarJogadoresAdmin(dados) {
  const alteracoes = Array.isArray(dados.jogadores) ? dados.jogadores : [];
  if (!alteracoes.length) throw new Error("Nenhuma alteração de jogador foi informada.");

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const planilha = SpreadsheetApp.openById(SPREADSHEET_ID);
    const aba = planilha.getSheetByName(SHEETS.jogadores);
    const valores = aba.getDataRange().getDisplayValues();
    const cabecalhos = valores[0].map((valor) => String(valor).trim().toLowerCase());
    const coluna = (nome) => cabecalhos.indexOf(nome);
    const obrigatorias = ["id", "nome", "exibicao", "apelido", "ativo"];

    if (obrigatorias.some((nome) => coluna(nome) < 0)) {
      throw new Error("A estrutura da aba Jogadores está incompleta.");
    }

    const registros = valores.slice(1)
      .map((linha, indice) => ({
        id: Number(linha[coluna("id")]),
        linha: indice + 2,
      }))
      .filter((registro) => registro.id);
    const registrosPorId = {};
    registros.forEach((registro) => { registrosPorId[registro.id] = registro; });

    const participantesAtuais = new Set(
      getSheetAsObjects(SHEETS.participantes)
        .filter((participante) => Number(participante.temporada) === getTemporadaAtual())
        .map((participante) => Number(participante.jogador_id)),
    );

    let proximoId = Math.max(0, ...registros.map((registro) => registro.id)) + 1;
    const normalizadas = alteracoes.map((alteracao) => {
      const idInformado = Number(alteracao.id);
      const novo = !idInformado;
      const id = novo ? proximoId++ : idInformado;
      const nome = String(alteracao.nome || "").trim();
      const exibicao = String(alteracao.exibicao || nome).trim();
      const apelido = String(alteracao.apelido || exibicao).trim();
      const ativo = alteracao.ativo === true || String(alteracao.ativo).trim().toUpperCase() === "S";

      if (!nome || !exibicao || !apelido) {
        throw new Error("Nome, nome de exibição e apelido são obrigatórios.");
      }
      if ([nome, exibicao, apelido].some((valor) => valor.length > 80)) {
        throw new Error("Os campos do jogador devem possuir no máximo 80 caracteres.");
      }
      if (!novo && !registrosPorId[id]) {
        throw new Error(`Jogador nº ${id} não encontrado.`);
      }
      if (!ativo && participantesAtuais.has(id)) {
        throw new Error(`O jogador ${exibicao} participa da temporada atual e não pode ser inativado.`);
      }

      return { id, nome, exibicao, apelido, ativo, novo };
    });

    const ids = normalizadas.map((jogador) => jogador.id);
    if (new Set(ids).size !== ids.length) {
      throw new Error("Um jogador foi informado mais de uma vez.");
    }

    normalizadas.forEach((jogador) => {
      let linha = registrosPorId[jogador.id]?.linha;
      if (!linha) {
        linha = aba.getLastRow() + 1;
        aba.getRange(linha, 1, 1, aba.getLastColumn()).setValues([
          Array(aba.getLastColumn()).fill(""),
        ]);
      }
      aba.getRange(linha, coluna("id") + 1).setValue(jogador.id);
      aba.getRange(linha, coluna("nome") + 1).setValue(jogador.nome);
      aba.getRange(linha, coluna("exibicao") + 1).setValue(jogador.exibicao);
      aba.getRange(linha, coluna("apelido") + 1).setValue(jogador.apelido);
      aba.getRange(linha, coluna("ativo") + 1).setValue(jogador.ativo ? "S" : "N");
    });

    delete CACHE[SHEETS.jogadores];
    return { sucesso: true, ...getJogadoresAdmin() };
  } finally {
    lock.releaseLock();
  }
}
