import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";
import { tabs } from "../components/tabs.js";
import { filters } from "../components/filters.js";
import { roundList } from "../components/roundList.js";
import { classificationTable } from "../components/classificationTable.js";
import { resultsTable } from "../components/resultsTable.js";
import { initFilters } from "../utils/filterController.js";
import { getEstatisticas, getRodadas, getTemporadas } from "../api.js";
import { initPdfExportButtons } from "../utils/pdfExporter.js";
import { resetPageScroll } from "../utils/pageScroll.js";

export async function renderHistorico() {
  const app = document.getElementById("app");
  app.innerHTML = `${renderNavbar({ title: "Histórico" })}
    ${tabs([
      { id: "historico-rodadas", label: "Rodadas", icon: "bi bi-calendar3" },
      { id: "historico-classificacao", label: "Classificação", icon: "bi bi-bar-chart-steps" },
      { id: "historico-resultados", label: "Resultados", icon: "bi bi-clipboard-data" },
    ])}
    <main class="serie-page history-page">
      <div class="round-panel history-panel">
        <div class="history-intro">
          <div><h1>Histórico</h1><p>Consulte rodadas, classificação e resultados de temporadas encerradas.</p></div>
          <div class="history-selectors">
            <label><span>Temporada</span><select class="round-select" data-history-season></select></label>
            <label><span>Divisão</span><select class="round-select" data-history-division><option value="A">Série A</option><option value="B">Série B</option></select></label>
          </div>
        </div>
        <section id="historico-rodadas"><div class="history-export-toolbar"><button class="btn pdf-export-button" type="button" data-pdf-export="rounds" data-pdf-source="[data-history-rounds]"><i class="bi bi-file-earmark-pdf"></i> Exportar PDF</button></div><div data-history-rounds><div class="loading-state"><span class="loading-spinner"></span><span>Carregando temporadas...</span></div></div></section>
        <section id="historico-classificacao" style="display:none"><div class="history-export-toolbar"><button class="btn pdf-export-button" type="button" data-pdf-export="classification" data-pdf-source="[data-history-classification]"><i class="bi bi-file-earmark-pdf"></i> Exportar PDF</button></div><div class="stats-panel" data-history-classification></div></section>
        <section id="historico-resultados" style="display:none"><div class="history-export-toolbar"><button class="btn pdf-export-button" type="button" data-pdf-export="results" data-pdf-source="[data-history-results]"><i class="bi bi-file-earmark-pdf"></i> Exportar PDF</button></div><div class="stats-panel" data-history-results></div></section>
      </div>
      ${renderFooter("footer-light")}
    </main>`;

  initHistoryTabs(app);
  initPdfExportButtons(app, () => ({
    division: app.querySelector("[data-history-division]")?.value,
    season: app.querySelector("[data-history-season]")?.value,
  }));
  try {
    const data = await getTemporadas();
    if (!app.querySelector("[data-history-season]")) return;
    const seasons = data.temporadas
      .filter((season) => Number(season) !== Number(data.temporada_atual))
      .sort((a, b) => Number(b) - Number(a));
    const select = app.querySelector("[data-history-season]");
    select.innerHTML = seasons.map((season) => `<option value="${season}">${season}</option>`).join("");
    const previousSeason = Number(data.temporada_atual) - 1;
    select.value = seasons.some((season) => Number(season) === previousSeason)
      ? String(previousSeason)
      : String(seasons[0] || "");
    if (!seasons.length) {
      renderHistoryError("Ainda não foram cadastradas temporadas passadas.", false);
      select.disabled = true;
      app.querySelector("[data-history-division]").disabled = true;
      return;
    }
    select.addEventListener("change", loadHistorySelection);
    app.querySelector("[data-history-division]").addEventListener("change", loadHistorySelection);
    await loadHistorySelection();
  } catch (error) {
    renderHistoryError("Não foi possível carregar o histórico.");
  }
}

async function loadHistorySelection() {
  const roundContent = document.querySelector("[data-history-rounds]");
  const classificationContent = document.querySelector("[data-history-classification]");
  const resultsContent = document.querySelector("[data-history-results]");
  const season = document.querySelector("[data-history-season]")?.value;
  const division = document.querySelector("[data-history-division]")?.value;
  if (!roundContent || !classificationContent || !resultsContent || !season || !division) return;
  const loading = '<div class="loading-state"><span class="loading-spinner"></span><span>Carregando histórico...</span></div>';
  roundContent.innerHTML = loading;
  classificationContent.innerHTML = loading;
  resultsContent.innerHTML = loading;

  try {
    const [rounds, stats] = await Promise.all([
      getRodadas(division, season),
      getEstatisticas(division, season),
    ]);
    if (!roundContent.isConnected) return;
    if (!stats.total_participantes) {
      const empty = historyDivisionEmptyState(division);
      roundContent.innerHTML = `${filters({ rodadas: [], jogadores: [] })}${empty}`;
      classificationContent.innerHTML = empty;
      resultsContent.innerHTML = empty;
      initFilters();
      return;
    }
    roundContent.innerHTML = `${filters({ rodadas: rounds, jogadores: getPlayers(rounds) })}${roundList(rounds)}`;
    classificationContent.innerHTML = classificationTable(stats.classificacao);
    resultsContent.innerHTML = resultsTable(stats.jogadores, stats.total_rodadas);
    initFilters();
  } catch (error) {
    renderHistoryError(error.message || "Não foi possível carregar esta temporada.");
  }
}

function historyDivisionEmptyState(division) {
  return `<div class="error-state history-empty-state"><i class="bi bi-info-circle"></i><p>Não há Série ${escapeHtml(division)} registrada nesta temporada.</p></div>`;
}

function renderHistoryError(message, retry = true) {
  const html = `<div class="error-state"><i class="bi bi-exclamation-circle"></i><p>${escapeHtml(message)}</p>${retry ? '<button class="btn btn-outline" type="button" data-history-retry>Tentar novamente</button>' : ""}</div>`;
  document.querySelectorAll("[data-history-rounds],[data-history-classification],[data-history-results]").forEach((content) => { content.innerHTML = html; });
  document.querySelectorAll("[data-history-retry]").forEach((button) => button.addEventListener("click", loadHistorySelection));
}

function getPlayers(rounds) {
  const players = new Map();
  rounds.forEach((round) => round.partidas.forEach((match) => {
    players.set(match.jogador1.id, match.jogador1);
    players.set(match.jogador2.id, match.jogador2);
  }));
  return [...players.values()].sort((a, b) =>
    (a.exibicao || a.nome || "").localeCompare(b.exibicao || b.nome || "", "pt-BR"),
  );
}

function initHistoryTabs(app) {
  app.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      app.querySelectorAll(".tab-button").forEach((item) => item.classList.toggle("active", item === button));
      ["historico-rodadas", "historico-classificacao", "historico-resultados"].forEach((id) => {
        app.querySelector(`#${id}`).style.display = id === button.dataset.tab ? "block" : "none";
      });
      resetPageScroll();
    });
  });
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = String(value || "");
  return element.innerHTML;
}
