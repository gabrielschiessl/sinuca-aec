import { tabs } from "../components/tabs.js";
import { roundList } from "../components/roundList.js";
import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";
import { getRodadas } from "../api.js";
import { filters } from "../components/filters.js";
import { initFilters } from "../utils/filterController.js";

export async function renderSerieA() {
  const app = document.getElementById("app");

  app.innerHTML = renderPage();
  initTabs();

  await loadRodadas();
}

async function loadRodadas() {
  const content = document.getElementById("round-panel-content");

  if (!content) return;

  content.innerHTML = `
    <div class="loading-state" role="status" aria-live="polite">
      <span class="loading-spinner" aria-hidden="true"></span>
      <span>Carregando rodadas...</span>
    </div>`;

  try {
    const rodadas = await getRodadas("A");

    if (!content.isConnected) return;

    renderRodadas(content, rodadas);
  } catch (error) {
    if (!content.isConnected) return;

    content.innerHTML = `
      <div class="error-state" role="alert">
        <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
        <p>Não foi possível carregar as rodadas.</p>
        <button type="button" class="btn btn-outline" id="retry-rounds">
          Tentar novamente
        </button>
      </div>`;

    document.getElementById("retry-rounds")?.addEventListener("click", loadRodadas);
  }
}

function renderRodadas(content, rodadas) {
  const jogadoresMap = new Map();

  rodadas.forEach((rodada) => {
    rodada.partidas.forEach((partida) => {
      jogadoresMap.set(partida.jogador1.id, partida.jogador1);
      jogadoresMap.set(partida.jogador2.id, partida.jogador2);
    });
  });

  const jogadores = Array.from(jogadoresMap.values()).sort((a, b) => {
    const nomeA = a.exibicao || a.nome || "";
    const nomeB = b.exibicao || b.nome || "";

    return nomeA.localeCompare(nomeB, "pt-BR", { sensitivity: "base" });
  });

  content.innerHTML = `${filters({ rodadas, jogadores })}${roundList(rodadas)}`;
  initFilters();
}

function renderPage() {
  return `${renderNavbar({ title: "Série A" })}
    ${tabs([
      { id: "rodadas", label: "Rodadas", icon: "bi bi-calendar3" },
      {
        id: "classificacao",
        label: "Classificação",
        icon: "bi bi-bar-chart-steps",
      },
      { id: "resultados", label: "Resultados", icon: "bi bi-clipboard-data" },
    ])}

    <main class="serie-page">
      <section id="rodadas">
        <h2 class="section-heading-title">
          <i class="bi bi-calendar3"></i>
          Rodadas
        </h2>
        <div class="round-panel">
          <div id="round-panel-content"></div>
        </div>
      </section>

      <section id="classificacao" style="display: none">
        <h2>Classificação</h2>
      </section>

      <section id="resultados" style="display: none">
        <h2>Resultados</h2>
      </section>

      ${renderFooter("footer-light")}
    </main>`;
}

function initTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;

      document
        .querySelectorAll(".tab-button")
        .forEach((item) => item.classList.remove("active"));

      button.classList.add("active");

      document
        .querySelectorAll("#rodadas, #classificacao, #resultados")
        .forEach((section) => (section.style.display = "none"));

      document.getElementById(tab).style.display = "block";
    });
  });
}
