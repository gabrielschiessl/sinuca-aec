/************************************************
 * PROJETO AEC SINUCA
 * Code.gs
 ************************************************/

function doGet(e) {
  const acao = e.parameter.acao || "status";

  switch (acao) {
    case "status":
      return responder({
        status: "online",
        sistema: "Projeto AEC Sinuca",
        versao: API_VERSION,
      });

    case "jogadores":
      return responder(getJogadores());

    case "rodadas":
      return responder(getRodadas(e.parameter.serie || "A", e.parameter.temporada));

    case "estatisticas":
      return responder(getEstatisticas(e.parameter.serie || "A", e.parameter.temporada));

    case "temporadas":
      return responder(getTemporadasPublicas());

    default:
      return responder({
        erro: "Ação inválida.",
      });
  }
}

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents || "{}");
    const acao = dados.acao || "";

    switch (acao) {
      case "login_google":
        return responder(loginComGoogle(dados.credential));

      case "validar_sessao":
        return responder(validarSessaoAdmin(dados.token));

      case "admin_partidas":
        validarSessaoAdmin(dados.token);
        return responder(getPartidasAdmin(dados.divisao || "A"));

      case "admin_participantes":
        validarSessaoAdmin(dados.token);
        return responder(getParticipantesAdmin(dados.divisao || "A"));

      case "admin_jogadores":
        validarSessaoAdmin(dados.token);
        return responder(getJogadoresAdmin());

      case "admin_temporadas":
        validarSessaoAdmin(dados.token);
        return responder(getTemporadasAdmin());

      case "preparar_temporada":
        validarSessaoAdmin(dados.token);
        return responder(prepararNovaTemporada(dados.temporada));

      case "carregar_temporada":
        validarSessaoAdmin(dados.token);
        return responder(getTemporadaPreparacao(dados.temporada));

      case "salvar_participantes":
        validarSessaoAdmin(dados.token);
        return responder(salvarParticipantesAdmin(dados));

      case "salvar_jogadores":
        validarSessaoAdmin(dados.token);
        return responder(salvarJogadoresAdmin(dados));

      case "salvar_temporada":
        validarSessaoAdmin(dados.token);
        return responder(salvarTemporadaPreparacao(dados));

      case "excluir_temporada":
        validarSessaoAdmin(dados.token);
        return responder(excluirTemporadaPreparacao(dados.temporada));

      case "ativar_temporada":
        validarSessaoAdmin(dados.token);
        return responder(ativarTemporadaPreparacao(dados.temporada));

      case "salvar_partida":
        validarSessaoAdmin(dados.token);
        return responder(salvarPartidasAdmin({ partidas: [dados] }).partidas[0]);

      case "salvar_partidas":
        validarSessaoAdmin(dados.token);
        return responder(salvarPartidasAdmin(dados));

      case "logout":
        encerrarSessaoAdmin(dados.token);
        return responder({ sucesso: true });

      default:
        return responder({ erro: "Ação inválida." });
    }
  } catch (error) {
    return responder({ erro: error.message || "Erro inesperado." });
  }
}
