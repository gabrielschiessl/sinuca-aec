/************************************************
 * PROJETO AEC SINUCA
 * Jogadores
 ************************************************/

/************************************************
 * Retorna os jogadores das Séries A e B
 ************************************************/

function getJogadores() {
  const dados = getSheetAsObjects(SHEETS.jogadores);

  return {
    A: dados
      .filter((j) => j.id_a)
      .map((j) => ({
        id: Number(j.id_a),
        nome: j.jogador_a,
        apelido: j.apelido_a || j.jogador_a,
      })),

    B: dados
      .filter((j) => j.id_b)
      .map((j) => ({
        id: Number(j.id_b),
        nome: j.jogador_b,
        apelido: j.apelido_b || j.jogador_b,
      })),
  };
}

/************************************************
 * Retorna um jogador pelo ID
 ************************************************/

function getJogador(id) {
  const jogadores = getSheetAsObjects(SHEETS.jogadores);

  return jogadores.find((j) => Number(j.id) === Number(id));
}
