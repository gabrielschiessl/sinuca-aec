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

        <div class="player-name">

            ${partida.jogador1.exibicao}

        </div>

        <div class="score-inputs">

    ${scoreBox({
      value: partida.placar1,
      editable: partida.edicao.pode_editar,
      player: "1",
    })}

    <span class="score-x">

        X

    </span>

    ${scoreBox({
      value: partida.placar2,
      editable: partida.edicao.pode_editar,
      player: "2",
    })}

</div>

        <div class="player-name">

            ${partida.jogador2.exibicao}

        </div>

    </div>

    ${matchFooter(partida.observacao)}

</div>

`;
}
