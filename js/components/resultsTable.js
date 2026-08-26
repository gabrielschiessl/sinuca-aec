import { horizontalSwipeHint } from "./horizontalSwipeHint.js";

export function resultsTable(jogadores = [], totalRodadas = 0) {
  if (!jogadores.length) {
    return '<p class="stats-empty">Nenhum participante encontrado.</p>';
  }

  const rodadas = Array.from({ length: totalRodadas }, (_, indice) => indice + 1);

  return `
    ${horizontalSwipeHint("results")}
    <div class="stats-table-scroll" data-horizontal-drag>
      <table class="stats-table results-table">
        <thead>
          <tr>
            <th>Nº</th>
            <th>Jogador</th>
            ${rodadas.map((rodada) => `<th>${rodada}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${jogadores
            .map((jogador) => {
              const resultadosPorRodada = new Map(
                jogador.resultados.map((resultado) => [
                  resultado.rodada,
                  resultado,
                ]),
              );

              return `
                <tr>
                  <td>${jogador.numero}</td>
                  <td class="results-player">${jogador.exibicao}</td>
                  ${rodadas
                    .map((rodada) => {
                      const resultado = resultadosPorRodada.get(rodada);

                      if (!resultado) {
                        return '<td><span class="result-marker pending"></span></td>';
                      }

                      const classe =
                        resultado.resultado === "V" ? "victory" : "defeat";

                      return `
                        <td title="${resultado.placar} contra ${resultado.adversario.exibicao}">
                          <span class="result-marker ${classe}">${resultado.resultado}</span>
                        </td>`;
                    })
                    .join("")}
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;
}
