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
      <span class="round-status-label full">Agendado</span><span class="round-status-label compact">Ag.</span>: ${rodada.partidas_agendadas}
    </span>

    <span class="round-status-badge live">
      <span class="live-dot"></span><span class="round-status-label full">Em andamento</span><span class="round-status-label compact">Ao vivo</span>: ${rodada.partidas_ao_vivo}
    </span>

    <span class="round-status-badge done">
      <span class="round-status-label full">Encerrado</span><span class="round-status-label compact">Enc.</span>: ${rodada.partidas_encerradas}
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
