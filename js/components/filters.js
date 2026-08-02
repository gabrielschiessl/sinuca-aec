export function filters({ rodadas = [], jogadores = [] }) {
  return `

<div class="filters">

    <div class="filter-group">

        <label class="filter-title">

            <i class="bi bi-calendar-event-fill"></i>

            Filtro de Rodada

        </label>

        <select
            class="round-select"
            id="filter-round"
        >

            <option value="">
                Todas as rodadas
            </option>

           ${rodadas
             .map(
               (rodada) => `

        <option value="${rodada.rodada}">

            Rodada ${rodada.rodada}

        </option>

    `,
             )
             .join("")}

        </select>

    </div>



    <div class="filter-group">

        <label class="filter-title">

            <i class="bi bi-person-fill"></i>

            Filtro de Jogador

        </label>

        <select
            class="round-select"
            id="filter-player"
        >

            <option value="">
                Todos os jogadores
            </option>

            ${jogadores
              .map(
                (jogador) => `

                <option value="${jogador.id}">

                    ${jogador.exibicao}

                </option>

            `,
              )
              .join("")}

        </select>

    </div>

</div>

`;
}
