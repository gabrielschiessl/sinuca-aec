import { tabs } from "../components/tabs.js";
import { roundCard } from "../components/roundCard.js";
import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";

export function renderSerieA() {
  const app = document.getElementById("app");

  const partidas = [
    {
      id: 1,
      jogador1: "João Silva",
      jogador2: "Pedro Souza",
      placar1: 3,
      placar2: 2,
    },

    {
      id: 2,
      jogador1: "Carlos",
      jogador2: "Marcos",
      placar1: "-",
      placar2: "-",
    },
  ];

  app.innerHTML = `${renderNavbar()}


        <main class="serie-page">


            <h1>
                Campeonato Série A
            </h1>


            ${tabs([
              {
                id: "rodadas",
                label: "Rodadas",
              },

              {
                id: "classificacao",
                label: "Classificação",
              },

              {
                id: "resultados",
                label: "Resultados",
              },
            ])}



            <section id="rodadas">


                <div class="filters">


<div class="filter-group">


<label class="filter-title">

<i class="bi bi-calendar-event-fill"></i>

Filtro de Rodada

</label>


<select class="round-select">

<option>
Todas as rodadas
</option>

<option>
Rodada 1
</option>

<option>
Rodada 2
</option>

</select>


</div>



<div class="filter-group">


<label class="filter-title">

<i class="bi bi-person-fill"></i>

Visualizar rodadas de

</label>


<select class="round-select">

<option>
Todos os jogadores
</option>

<option>
João Silva
</option>

<option>
Pedro Souza
</option>

</select>


</div>


</div>



                ${roundCard({
                  numero: 1,

                  partidas,
                })}



            </section>


            <section id="classificacao">

                <h2>
                    Classificação
                </h2>

            </section>



            <section id="resultados">

                <h2>
                    Resultados
                </h2>

            </section>


${renderFooter()}
        </main>


    `;

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;

      document
        .querySelectorAll(".tab-button")
        .forEach((btn) => btn.classList.remove("active"));

      button.classList.add("active");

      document
        .querySelectorAll("#rodadas, #classificacao, #resultados")
        .forEach((section) => (section.style.display = "none"));

      document.getElementById(tab).style.display = "block";
    });
  });
}
