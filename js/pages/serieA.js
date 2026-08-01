import { tabs } from "../components/tabs.js";
import { roundList } from "../components/roundList.js";
import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";
import { getRodadas } from "../api.js";
import { filters } from "../components/filters.js";
import { initFilters } from "../utils/filterController.js";

export async function renderSerieA() {
  const app = document.getElementById("app");
  const rodadas = await getRodadas("A");

  app.innerHTML = `${renderNavbar({
    title: "Série A",
  })}

                  ${tabs([
                    { id: "rodadas", label: "Rodadas" },
                    { id: "classificacao", label: "Classificação" },
                    { id: "resultados", label: "Resultados" },
                  ])} 

                  <main class="serie-page">

                    <section id="rodadas">
                        <div class="round-panel">
                            ${filters({
                              rodadas,

                              jogadores: [],
                            })}

${roundList(rodadas)}
                        </div>
                    </section>

                    <section id="classificacao">
                      <h2>Classificação</h2>
                    </section>

                    <section id="resultados">
                      <h2>Resultados</h2>
                    </section>

                    ${renderFooter("footer-light")}
                  </main>`;

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

  initFilters();
}
