import { matchCard } from "./matchCard.js";
import { formatDate } from "../utils/date.js";

export function roundGroup(rodada) {
  return `

<section
    class="round-group"
    data-round="${rodada.rodada}"
>
    <div class="round-header">

            <div class="round-title">

                <i class="bi bi-8-circle-fill"></i>

                Rodada ${rodada.rodada}

            </div>

            <div class="round-status-badges">

    <span class="round-status-badge soon">
      Agendado: ${rodada.partidas_agendadas}
    </span>

    <span class="round-status-badge live">
      <span class="live-dot"></span>Em andamento: ${rodada.partidas_ao_vivo}
    </span>

    <span class="round-status-badge done">
      Encerrado: ${rodada.partidas_encerradas}
    </span>

  </div>
    </div>

    <div class="round-content">
        <div class="round-matches">
            ${rodada.partidas.map((partida) => matchCard(partida)).join("")}
        </div>
    </div>
</section>

`;
}
