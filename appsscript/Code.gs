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

    default:
      return responder({
        erro: "Ação inválida.",
      });
  }
}
