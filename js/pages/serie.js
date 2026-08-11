import { tabs } from "../components/tabs.js";
import { roundList } from "../components/roundList.js";
import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";
import { getEstatisticas, getRodadas } from "../api.js";
import { filters } from "../components/filters.js";
import { initFilters } from "../utils/filterController.js";
import { classificationTable } from "../components/classificationTable.js";
import { resultsTable } from "../components/resultsTable.js";
import { initPdfExportButtons } from "../utils/pdfExporter.js";
import { getKnownCurrentSeason } from "../config.js";
import { resetPageScroll } from "../utils/pageScroll.js";

export async function renderSerie({ divisao, title }) {
  const app = document.getElementById("app");

  app.innerHTML = renderPage(title);
  initTabs();
  initPdfExportButtons(app, () => ({ division: divisao, season: getKnownCurrentSeason() }));

  await Promise.all([loadRodadas(divisao), loadEstatisticas(divisao)]);
}

async function loadRodadas(divisao) {
  const content = document.getElementById("round-panel-content");

  if (!content) return;

  content.innerHTML = `
    <div class="loading-state" role="status" aria-live="polite">
      <span class="loading-spinner" aria-hidden="true"></span>
      <span>Carregando rodadas...</span>
    </div>`;

  try {
    const rodadas = await getRodadas(divisao);

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

    document
      .getElementById("retry-rounds")
      ?.addEventListener("click", () => loadRodadas(divisao));
  }
}

async function loadEstatisticas(divisao) {
  const classificationContent = document.getElementById(
    "classification-content",
  );
  const resultsContent = document.getElementById("results-content");

  if (!classificationContent || !resultsContent) return;

  const loading = `
    <div class="loading-state" role="status" aria-live="polite">
      <span class="loading-spinner" aria-hidden="true"></span>
      <span>Carregando estatísticas...</span>
    </div>`;

  classificationContent.innerHTML = loading;
  resultsContent.innerHTML = loading;

  try {
    const estatisticas = await getEstatisticas(divisao);

    if (!classificationContent.isConnected || !resultsContent.isConnected) {
      return;
    }

    classificationContent.innerHTML = classificationTable(
      estatisticas.classificacao,
    );
    resultsContent.innerHTML = resultsTable(
      estatisticas.jogadores,
      estatisticas.total_rodadas,
    );
  } catch (error) {
    if (!classificationContent.isConnected || !resultsContent.isConnected) {
      return;
    }

    const errorContent = `
      <div class="error-state" role="alert">
        <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
        <p>Não foi possível carregar as estatísticas.</p>
        <button type="button" class="btn btn-outline retry-stats">
          Tentar novamente
        </button>
      </div>`;

    classificationContent.innerHTML = errorContent;
    resultsContent.innerHTML = errorContent;

    document.querySelectorAll(".retry-stats").forEach((button) => {
      button.addEventListener("click", () => loadEstatisticas(divisao));
    });
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

function renderPage(title) {
  return `${renderNavbar({ title })}
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
        <div class="section-heading-actions"><h2 class="section-heading-title">
          <i class="bi bi-calendar3"></i>
          Rodadas
        </h2><button class="btn pdf-export-button" type="button" data-pdf-export="rounds" data-pdf-source="#round-panel-content"><i class="bi bi-file-earmark-pdf"></i> Exportar PDF</button></div>
        <div class="round-panel">
          <div id="round-panel-content"></div>
        </div>
      </section>

      <section id="classificacao" style="display: none">
        <div class="section-heading-actions"><h2 class="section-heading-title">
          <i class="bi bi-bar-chart-steps"></i>
          Classificação
        </h2><button class="btn pdf-export-button" type="button" data-pdf-export="classification" data-pdf-source="#classification-content"><i class="bi bi-file-earmark-pdf"></i> Exportar PDF</button></div>
        <div class="stats-panel" id="classification-content"></div>
      </section>

      <section id="resultados" style="display: none">
        <div class="section-heading-actions"><h2 class="section-heading-title">
          <i class="bi bi-clipboard-data"></i>
          Resultados
        </h2><button class="btn pdf-export-button" type="button" data-pdf-export="results" data-pdf-source="#results-content"><i class="bi bi-file-earmark-pdf"></i> Exportar PDF</button></div>
        <div class="stats-panel" id="results-content"></div>
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
      resetPageScroll();
    });
  });
}
