import { matchCard } from "./matchCard.js";
import { formatDate } from "../utils/date.js";

export function roundGroup(rodada) {
  return `

<section class="round-group">
    <div class="round-header">

        <div>

            <div class="round-title">

                <i class="bi bi-8-circle-fill"></i>

                Rodada ${rodada.rodada}

            </div>

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
