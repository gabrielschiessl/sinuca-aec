import { matchCard } from "./matchCard.js";

export function roundCard({ numero, partidas }) {
  return `

<section class="round-card">


<h3>
Rodada ${numero}
</h3>


<div class="matches">


${partidas.map((partida) => matchCard(partida)).join("")}


</div>


</section>

`;
}
