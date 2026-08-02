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
