import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";
import { horizontalSwipeHint } from "../components/horizontalSwipeHint.js";
import { setupHorizontalDragScroll } from "../components/horizontalDragScroll.js";
import { getRanking } from "../api.js";

export function renderRanking() {
  const app = document.getElementById("app");
  app.innerHTML = `
    ${renderNavbar({ title: "Ranking" })}
    <main class="ranking-page">
      <section class="ranking-panel">
        <div class="ranking-heading">
          <div>
            <span class="ranking-kicker"><i class="bi bi-stars"></i> Série A</span>
            <h1>Ranking AEC Sinuca</h1>
            <p>Os 30 jogadores com maior pontuação nas cinco temporadas consideradas.</p>
          </div>
          <div class="ranking-period" data-ranking-period></div>
        </div>
        <div data-ranking-content>
          <div class="loading-state"><span class="loading-spinner"></span><span>Calculando ranking...</span></div>
        </div>
      </section>
      ${renderFooter("footer-light")}
    </main>
  `;
  loadRanking(app);
}

async function loadRanking(app) {
  const content = app.querySelector("[data-ranking-content]");
  const period = app.querySelector("[data-ranking-period]");
  try {
    const data = await getRanking();
    if (!content?.isConnected) return;
    period.innerHTML = `<small>Período considerado</small><strong>${data.periodo[0]}–${data.referencia}</strong>${data.referencia_automatica ? '<span>Atualização automática</span>' : '<span>Referência definida pela organização</span>'}`;
    if (!data.ranking.length) {
      content.innerHTML = '<div class="error-state"><i class="bi bi-info-circle"></i><p>Ainda não existem temporadas suficientes para formar o ranking.</p></div>';
      return;
    }
    content.innerHTML = `
      <div class="ranking-table-card">
        ${horizontalSwipeHint()}
        <div class="ranking-table-scroll" data-horizontal-drag>
          <table class="ranking-table">
            <thead><tr><th>Posição</th><th>Jogador</th><th>Total</th>${data.periodo.map((year) => `<th>${year}</th>`).join("")}</tr></thead>
            <tbody>${data.ranking.map(rankingRow).join("")}</tbody>
          </table>
        </div>
      </div>
      <p class="ranking-note"><i class="bi bi-info-circle"></i> Em caso de empate, permanece à frente quem ocupava a melhor posição no ranking anterior.</p>
    `;
    setupHorizontalDragScroll(content);
    setupStickyRankingHeader(content.querySelector(".ranking-table-scroll"));
  } catch (error) {
    content.innerHTML = `<div class="error-state"><i class="bi bi-exclamation-circle"></i><p>${escapeHtml(error.message || "Não foi possível carregar o ranking.")}</p><button class="btn btn-outline" type="button" data-ranking-retry>Tentar novamente</button></div>`;
    content.querySelector("[data-ranking-retry]")?.addEventListener("click", () => loadRanking(app));
  }
}

function setupStickyRankingHeader(scrollBox) {
  const sourceTable = scrollBox?.querySelector(".ranking-table");
  const sourceHead = sourceTable?.querySelector("thead");
  if (!scrollBox || !sourceTable || !sourceHead) return;

  const sticky = document.createElement("div");
  sticky.className = "ranking-sticky-header";
  sticky.setAttribute("aria-hidden", "true");
  const stickyTable = document.createElement("table");
  stickyTable.className = "ranking-table";
  stickyTable.append(sourceHead.cloneNode(true));
  sticky.append(stickyTable);
  document.body.append(sticky);

  const sourceCells = [...sourceHead.querySelectorAll("th")];
  const stickyCells = [...stickyTable.querySelectorAll("th")];
  let destroyed = false;

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    window.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
    scrollBox.removeEventListener("scroll", update);
    sticky.remove();
  };

  function update() {
    if (!scrollBox.isConnected) {
      destroy();
      return;
    }
    const navbarBottom = document.querySelector(".header")?.getBoundingClientRect().bottom || 0;
    const box = scrollBox.getBoundingClientRect();
    const head = sourceHead.getBoundingClientRect();
    const tableBox = sourceTable.getBoundingClientRect();
    const visibleLeft = Math.max(box.left, tableBox.left);
    const visibleRight = Math.min(box.right, tableBox.right);
    const active = head.top <= navbarBottom && box.bottom > navbarBottom + head.height;
    sticky.classList.toggle("is-visible", active);
    sticky.style.top = `${navbarBottom}px`;
    sticky.style.left = `${visibleLeft}px`;
    sticky.style.width = `${Math.max(0, visibleRight - visibleLeft)}px`;
    stickyTable.style.width = `${sourceTable.scrollWidth}px`;
    sourceCells.forEach((cell, index) => {
      stickyCells[index].style.width = `${cell.getBoundingClientRect().width}px`;
      stickyCells[index].style.minWidth = `${cell.getBoundingClientRect().width}px`;
      stickyCells[index].style.maxWidth = `${cell.getBoundingClientRect().width}px`;
    });
    stickyTable.style.transform = `translateX(${tableBox.left - visibleLeft}px)`;
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update, { passive: true });
  scrollBox.addEventListener("scroll", update, { passive: true });
  update();
}

function rankingRow(player) {
  return `<tr>
    <td><span class="ranking-position">${player.posicao}º</span></td>
    <td class="ranking-player">${escapeHtml(player.exibicao)}</td>
    <td class="ranking-total">${player.pontos}</td>
    ${player.temporadas.map((season) => `<td class="ranking-season-points ${season.pontos ? "has-points" : ""}"><strong>${season.pontos}</strong>${season.posicao ? `<small>${season.posicao}º lugar</small>` : '<small>—</small>'}</td>`).join("")}
  </tr>`;
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = String(value || "");
  return element.innerHTML;
}
