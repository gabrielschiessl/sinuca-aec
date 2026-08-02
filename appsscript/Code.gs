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
      return responder(getRodadas(e.parameter.serie || "A"));

    case "estatisticas":
      return responder(getEstatisticas(e.parameter.serie || "A"));

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
