export function classificationTable(classificacao = []) {
  if (!classificacao.length) {
    return '<p class="stats-empty">Nenhum participante encontrado.</p>';
  }

  return `
    <div class="stats-table-scroll">
      <table class="stats-table classification-table">
        <thead>
          <tr>
            <th>Posição</th>
            <th>Jogador</th>
            <th>Vitórias</th>
            <th>Partidas</th>
          </tr>
        </thead>
        <tbody>
          ${classificacao
            .map((jogador) => {
              const medalhas = {
                1: { emoji: "🥇", titulo: "Medalha de ouro" },
                2: { emoji: "🥈", titulo: "Medalha de prata" },
                3: { emoji: "🥉", titulo: "Medalha de bronze" },
              };
              const medalha = medalhas[jogador.posicao];

              return `
                <tr class="classification-row ${jogador.zona || ""}">
                  <td class="classification-position">
                    <span class="classification-position-content">
                      <span>${jogador.posicao}º</span>
                      ${
                        medalha
                          ? `<span class="classification-medal" title="${medalha.titulo}" aria-label="${medalha.titulo}">${medalha.emoji}</span>`
                          : ""
                      }
                    </span>
                  </td>
                  <td class="classification-player">${jogador.exibicao}</td>
                  <td>${jogador.vitorias}</td>
                  <td>${jogador.partidas_vencidas}</td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;
}
