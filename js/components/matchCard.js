import { statusBadge } from "./statusBadge.js";
import { scoreBox } from "./scoreBox.js";
import { matchFooter } from "./matchFooter.js";
import { formatDate, formatTime } from "../utils/date.js";

export function matchCard(partida) {
  return `

<div
    class="match-card ${partida.status.codigo === "V" ? "live" : ""}"
    data-player1="${partida.jogador1.id}"
    data-player2="${partida.jogador2.id}"
    data-status="${partida.status.codigo}"
>

    <div class="match-header">

        <span class="match-date-time">
          <span class="match-date">${formatDate(partida.data)}</span>
          <span class="match-date-separator" aria-hidden="true">•</span>
          <span class="match-time">${formatTime(partida.hora)}</span>
        </span>

        ${statusBadge(partida.status)}

    </div>

    <div class="match-body">

        <div class="match-competitor">

          <div class="player-name">

            ${partida.jogador1.exibicao}

          </div>

          ${scoreBox({
            value: partida.placar1,
            editable: partida.edicao.pode_editar,
            player: "1",
          })}

        </div>

        <span class="score-x">

          X

        </span>

        <div class="match-competitor">

          <div class="player-name">

            ${partida.jogador2.exibicao}

          </div>

          ${scoreBox({
            value: partida.placar2,
            editable: partida.edicao.pode_editar,
            player: "2",
          })}

        </div>

    </div>

    ${matchFooter(partida.observacao)}

</div>

`;
}

export function byeMatchCard(jogador) {
  if (!jogador) return "";
  return `
<div class="match-card bye" data-player1="${jogador.id}" data-player2="" data-status="">
  <div class="match-header">
    <span class="status-badge status-bye">Folga</span>
  </div>
  <div class="match-body">
    <div class="player-name">${jogador.exibicao}</div>
  </div>
</div>`;
}
