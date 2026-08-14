import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";
import {
  authenticateWithGoogle,
  endAdminSession,
  restoreAdminSession,
} from "../auth.js";
import { GOOGLE_CLIENT_ID } from "../config.js";
import {
  getAdminJogadores,
  getAdminPartidas,
  getAdminParticipantes,
  getAdminTemporada,
  getAdminTemporadas,
  getAdminDadosPlanilha,
  prepareAdminTemporada,
  prepareAdminTemporadaLegada,
  publishAdminTemporadaLegada,
  activateAdminTemporada,
  deleteAdminTemporada,
  saveAdminJogadores,
  saveAdminPartidas,
  saveAdminParticipantes,
  saveAdminRoundDate,
  saveAdminRoundDates,
  saveAdminTemporada,
  saveAdminTemporadaLegada,
  saveAdminTaxaInscricao,
  saveAdminRankingReference,
} from "../api.js";
import { setKnownCurrentSeason, withBasePath } from "../config.js";
import { resetPageScroll } from "../utils/pageScroll.js";
import { exportChampionshipSpreadsheet } from "../utils/championshipSpreadsheet.js";

const PAGE_ID = "admin-page";
const CREATE_SEASON_BUTTON_HTML = '<i class="bi bi-plus-circle"></i> Criar temporada';
let activeAdminSession = null;
let adminEditMode = false;
let temporaryActivePlayers = new Map();
let playerSearchMediaQuery = null;
let playerSearchMediaHandler = null;
let seasonDraft = null;
let savedSeasonDraft = null;
let searchablePlayerSelectsBound = false;
let xlsxLibraryPromise = null;
let legacySpreadsheetTarget = "new";
let spreadsheetSeasons = [];
let spreadsheetCurrentSeason = null;

window.addEventListener("beforeunload", (event) => {
  if (!isSeasonDirty()) return;
  event.preventDefault();
  event.returnValue = "";
});

export function renderAdministrador() {
  temporaryActivePlayers = new Map();
  seasonDraft = null;
  savedSeasonDraft = null;
  const app = document.getElementById("app");

  app.innerHTML = `
    ${renderNavbar({ title: "Administrador" })}
    <main class="admin-layout">
      <div class="admin-page" id="${PAGE_ID}">
        <section class="admin-card">
          <div class="loading-state" role="status">
            <div class="loading-spinner" aria-hidden="true"></div>
            <p>Verificando sua sessão...</p>
          </div>
        </section>
      </div>
      ${renderFooter("footer-light admin-footer")}
    </main>
  `;

  initializeAdminPage();
}

async function initializeAdminPage() {
  try {
    const session = await restoreAdminSession();

    if (!isCurrentPage()) return;

    if (session) {
      renderDashboard(session);
      return;
    }
  } catch (error) {
    if (!isCurrentPage()) return;
    renderLogin(getFriendlyAuthError(error));
    return;
  }

  renderLogin();
}

function renderLogin(message = "") {
  const page = getPage();
  if (!page) return;
  setAdminHeaderSessionVisible(false);

  page.innerHTML = `
    <section class="admin-card admin-login-card">
      <i class="bi bi-shield-lock admin-card-icon" aria-hidden="true"></i>
      <h1>Área administrativa</h1>
      <p>Entre com uma conta Google autorizada para administrar o campeonato.</p>
      ${message ? `<p class="admin-message error-state-inline">${escapeHtml(message)}</p>` : ""}
      <div id="google-signin-button" class="google-signin-button"></div>
      <p class="admin-privacy-note">Sua senha não é compartilhada com o Sistema AEC Sinuca.</p>
    </section>
  `;

  mountGoogleButton();
}

async function mountGoogleButton() {
  const button = document.getElementById("google-signin-button");
  if (!button) return;

  try {
    const googleAccounts = await waitForGoogleIdentity();
    if (!document.body.contains(button)) return;

    googleAccounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });
    googleAccounts.id.renderButton(button, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "signin_with",
      shape: "rectangular",
      width: Math.min(320, Math.max(220, button.clientWidth || 320)),
      locale: "pt-BR",
    });
  } catch (error) {
    button.innerHTML = `<button class="btn" type="button" data-admin-retry>Carregar login do Google</button>`;
    button.querySelector("[data-admin-retry]")?.addEventListener("click", mountGoogleButton);
  }
}

function waitForGoogleIdentity(timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        window.clearInterval(timer);
        resolve(window.google.accounts);
      } else if (Date.now() - startedAt >= timeout) {
        window.clearInterval(timer);
        reject(new Error("O login do Google não carregou."));
      }
    }, 100);
  });
}

async function handleGoogleCredential(response) {
  const page = getPage();
  if (!page || !response?.credential) return;

  page.innerHTML = `
    <section class="admin-card">
      <div class="loading-state" role="status">
        <div class="loading-spinner" aria-hidden="true"></div>
        <p>Validando sua conta...</p>
      </div>
    </section>
  `;

  try {
    const session = await authenticateWithGoogle(response.credential);
    if (isCurrentPage()) renderDashboard(session);
  } catch (error) {
    if (isCurrentPage()) renderLogin(getFriendlyAuthError(error));
  }
}

function spreadsheetGroup(key, title, icon, items) {
  return `
    <details class="admin-spreadsheet-group" data-spreadsheet-group="${key}" open>
      <summary>
        <span><i class="bi ${icon}" aria-hidden="true"></i> ${title}</span>
        <i class="bi bi-chevron-down" aria-hidden="true"></i>
      </summary>
      <div class="admin-spreadsheet-options">
        ${items.map(([value, label, restriction = ""]) => `
          <label data-spreadsheet-restriction="${restriction}">
            <input type="checkbox" value="${value}" data-spreadsheet-sheet checked>
            <span>${label}</span>
          </label>
        `).join("")}
      </div>
    </details>
  `;
}

function renderDashboard(session) {
  const page = getPage();
  if (!page) return;

  const admin = session.administrador || {};
  activeAdminSession = session;
  adminEditMode = false;
  setAdminHeaderSessionVisible(true);

  page.innerHTML = `
    <section class="admin-card admin-dashboard" data-admin-dashboard>
      <div class="admin-profile">
        ${
          admin.foto
            ? `<img src="${escapeHtml(admin.foto)}" alt="" referrerpolicy="no-referrer">`
            : '<i class="bi bi-person-circle" aria-hidden="true"></i>'
        }
        <div>
          <span>Conta administrativa</span>
          <strong>${escapeHtml(admin.nome || admin.email || "Administrador")}</strong>
          <small>${escapeHtml(admin.email || "")}</small>
        </div>
      </div>

      <div class="admin-mode-banner" data-admin-mode-banner>
        <i class="bi bi-eye" aria-hidden="true"></i>
        <div>
          <strong>Modo visualização</strong>
          <span>Nenhuma alteração pode ser feita enquanto este modo estiver ativo.</span>
        </div>
      </div>

      <div class="admin-actions admin-mode-action">
        <button class="btn" type="button" data-enable-edit>
          <i class="bi bi-pencil-square" aria-hidden="true"></i>
          Ativar edição
        </button>
      </div>

      <h1>Gestão do campeonato</h1>
      <p class="admin-intro">Este é o ponto de entrada para jogadores, temporadas, chaveamento e resultados.</p>

      <nav class="admin-management-tabs" aria-label="Ferramentas administrativas">
        <button class="active" type="button" data-admin-tool="partidas"><i class="bi bi-calendar3"></i> Partidas</button>
        <button type="button" data-admin-tool="participantes"><i class="bi bi-people-fill"></i> Participantes</button>
        <button type="button" data-admin-tool="jogadores"><i class="bi bi-person-badge-fill"></i> Jogadores</button>
        <button type="button" data-admin-tool="temporadas"><i class="bi bi-calendar2-plus-fill"></i> Temporadas</button>
        <button type="button" data-admin-tool="planilhas"><i class="bi bi-file-earmark-spreadsheet-fill"></i> Planilhas</button>
      </nav>

      <section class="admin-matches-module" data-admin-tool-section="partidas">
        <div class="admin-module-heading">
          <div><h2>Partidas</h2><p>Consulte status e placares da temporada atual.</p></div>
          <label><span>Divisão</span><select class="admin-select" data-admin-division><option value="A">Série A</option><option value="B">Série B</option></select></label>
        </div>
        <div class="admin-match-filters">
          <label class="admin-match-filter">
            <span><i class="bi bi-calendar3" aria-hidden="true"></i> Filtro de rodada</span>
            <select class="admin-select" data-admin-round-filter>
              <option value="">Todas as rodadas</option>
            </select>
          </label>
          <label class="admin-match-filter">
            <span><i class="bi bi-person-fill" aria-hidden="true"></i> Filtro de Jogador</span>
            <select class="admin-select" data-admin-player-filter>
              <option value="">Todos os jogadores</option>
            </select>
          </label>
        </div>
        <div class="admin-bulk-actions">
          <span data-admin-pending-count>Nenhuma alteração pendente</span>
          <button class="btn" type="button" data-save-all disabled>Salvar tudo</button>
        </div>
        <div data-admin-matches></div>
      </section>

      <section class="admin-participants-module" data-admin-tool-section="participantes" hidden>
        <div class="admin-module-heading">
          <div><h2>Participantes</h2><p>Defina qual jogador ocupa cada número competitivo da temporada atual.</p></div>
          <label><span>Divisão</span><select class="admin-select" data-participant-division><option value="A">Série A</option><option value="B">Série B</option></select></label>
        </div>
        <p class="admin-module-note"><i class="bi bi-info-circle"></i> Os números são os slots usados pelo chaveamento. Nesta etapa, somente o jogador vinculado ao número será alterado.</p>
        <div class="admin-bulk-actions">
          <span data-participant-pending>Nenhuma alteração pendente</span>
          <button class="btn" type="button" data-save-participants disabled>Salvar participantes</button>
        </div>
        <div data-admin-participants></div>
      </section>

      <section class="admin-players-module" data-admin-tool-section="jogadores" hidden>
        <div class="admin-module-heading">
          <div><h2>Jogadores</h2><p>Cadastre jogadores e defina os nomes usados pelo sistema.</p></div>
          <button class="btn" type="button" data-add-player disabled><i class="bi bi-person-plus-fill"></i> Novo jogador</button>
        </div>
        <p class="admin-module-note"><i class="bi bi-info-circle"></i> O cadastro não vincula o jogador a uma divisão. A ativação sem vínculo vale somente nesta página; ela se torna permanente quando o jogador for vinculado em Participantes.</p>
        <div class="admin-match-filters">
          <label class="admin-match-filter">
            <span><i class="bi bi-person-check-fill" aria-hidden="true"></i> Situação</span>
            <select class="admin-select" data-player-status-filter>
              <option value="">Ativos e inativos</option>
              <option value="S">Somente ativos</option>
              <option value="N">Somente inativos</option>
            </select>
          </label>
          <label class="admin-match-filter">
            <span><i class="bi bi-diagram-3-fill" aria-hidden="true"></i> Divisão atual</span>
            <select class="admin-select" data-player-division-filter>
              <option value="">Todas as divisões</option>
              <option value="A">Série A</option>
              <option value="B">Série B</option>
              <option value="NONE">Sem divisão</option>
            </select>
          </label>
        </div>
        <label class="admin-player-search">
          <span><i class="bi bi-search" aria-hidden="true"></i> Pesquisar jogador</span>
          <input class="admin-input" type="search" placeholder="Nome completo, exibição ou apelido" autocomplete="off" data-player-search-filter>
        </label>
        <div class="admin-bulk-actions">
          <span data-player-pending>Nenhuma alteração pendente</span>
          <button class="btn" type="button" data-save-players disabled>Salvar jogadores</button>
        </div>
        <div class="admin-player-list" data-admin-players></div>
        <div class="admin-filter-empty" data-player-filter-empty hidden>
          <i class="bi bi-person-x" aria-hidden="true"></i>
          <p>Nenhum jogador encontrado.</p>
        </div>
      </section>

      <section class="admin-seasons-module" data-admin-tool-section="temporadas" hidden>
        <div class="admin-module-heading">
          <div><h2>Temporadas</h2><p>Prepare uma nova temporada sem alterar o campeonato atualmente publicado.</p></div>
        </div>
        <p class="admin-module-note"><i class="bi bi-shield-check"></i> Os dados ficam separados até a futura ativação. Jogadores, partidas e temporada atual não serão alterados nesta etapa.</p>
        <div class="admin-ranking-reference">
          <div><strong>Referência do Ranking</strong><span>Define a temporada final da janela de cinco edições da Série A.</span></div>
          <select class="admin-select" data-ranking-reference disabled></select>
          <button class="btn btn-admin-secondary" type="button" data-save-ranking-reference disabled>Salvar referência</button>
        </div>
        <div data-admin-seasons></div>
        <div class="admin-season-create" data-season-create>
          <label><span>Ano da nova temporada</span><select class="admin-select" data-season-year></select></label>
          <button class="btn" type="button" data-create-season>${CREATE_SEASON_BUTTON_HTML}</button>
        </div>
        <div class="admin-season-create admin-season-create-legacy">
          <label><span>Ano da temporada passada</span><select class="admin-select" data-season-legacy-year></select></label>
          <div class="admin-season-import-actions">
            <a class="btn btn-admin-secondary" href="${withBasePath("/assets/templates/modelo-temporada-historica.xlsx")}" download><i class="bi bi-file-earmark-arrow-down"></i> Baixar modelo</a>
            <input type="file" accept=".xlsx" data-season-legacy-file hidden>
            <button class="btn btn-admin-secondary" type="button" data-create-legacy-season><i class="bi bi-file-earmark-arrow-up"></i> Importar planilha</button>
          </div>
        </div>
        <p class="admin-season-import-note">A temporada passada somente será enviada ao sistema depois da importação, revisão e confirmação em <strong>Salvar rascunho</strong>.</p>
        <div data-season-editor hidden></div>
      </section>

      <section class="admin-spreadsheets-module" data-admin-tool-section="planilhas" hidden>
        <div class="admin-module-heading">
          <div><h2>Planilhas do campeonato</h2><p>Gere somente as folhas necessárias para impressão e uso no salão de jogos.</p></div>
        </div>
        <div class="admin-spreadsheet-config">
          <label><span>Temporada</span><select class="admin-select" data-spreadsheet-season></select></label>
          <label><span>Divisão</span><select class="admin-select" data-spreadsheet-division><option value="A">Série A</option><option value="B">Série B</option></select></label>
          <label><span>Versão</span><select class="admin-select" data-spreadsheet-version><option value="updated">Atualizada</option><option value="manual">Para preenchimento manual</option></select></label>
          <label><span>Taxa de inscrição (R$)</span><div class="admin-spreadsheet-fee"><input class="admin-input" type="number" min="0" step="0.01" inputmode="decimal" data-spreadsheet-fee><button class="btn btn-admin-secondary" type="button" data-save-spreadsheet-fee disabled>Salvar taxa</button></div></label>
        </div>
        <p class="admin-module-note" data-spreadsheet-version-note><i class="bi bi-info-circle"></i> A versão atualizada utiliza o estado atual do banco de dados.</p>
        <div class="admin-spreadsheet-actions"><button class="btn btn-admin-secondary" type="button" data-spreadsheet-select-all>Selecionar todas</button><button class="btn btn-admin-secondary" type="button" data-spreadsheet-clear>Limpar seleção</button></div>
        <div class="admin-spreadsheet-groups">
          ${spreadsheetGroup("cadastros", "Cadastros", "bi-person-vcard-fill", [["jogadores", "Jogadores"], ["inscricao", "Ficha de inscrição"]])}
          ${spreadsheetGroup("estatisticas", "Estatísticas", "bi-bar-chart-fill", [["classificacao", "Classificação", "updated-only"], ["vitorias", "Vitórias"], ["resultados", "Resultados"], ["partidas", "Partidas vencidas"]])}
          ${spreadsheetGroup("jogos", "Jogos", "bi-calendar3", [["rodadas", "Rodadas (todas as folhas)"], ["individuais", "Fichas individuais"]])}
          <details class="admin-spreadsheet-group" data-spreadsheet-final-group hidden><summary><span><i class="bi bi-trophy-fill"></i> Documentos finais</span><i class="bi bi-chevron-down"></i></summary><div></div></details>
        </div>
        <div class="admin-season-actions"><button class="btn" type="button" data-generate-spreadsheet><i class="bi bi-download"></i> Gerar planilha</button></div>
      </section>

    </section>
  `;

  page.querySelector("[data-enable-edit]")?.addEventListener("click", toggleAdminEditMode);
  bindPlayerSearchPlaceholder();
  document.querySelectorAll("[data-admin-header-logout]").forEach((button) => { button.onclick = handleLogout; });
  page.querySelector("[data-admin-division]")?.addEventListener("change", (event) => loadAdminMatches(event.target.value, false));
  page.querySelector("[data-admin-round-filter]")?.addEventListener("change", applyAdminMatchFilters);
  page.querySelector("[data-admin-player-filter]")?.addEventListener("change", applyAdminMatchFilters);
  page.querySelector("[data-save-all]")?.addEventListener("click", () => saveAllMatchChanges(page.querySelector("[data-admin-division]").value));
  page.querySelectorAll("[data-admin-tool]").forEach((button) => button.addEventListener("click", () => selectAdminTool(button.dataset.adminTool)));
  page.querySelector("[data-participant-division]")?.addEventListener("change", handleParticipantDivisionChange);
  page.querySelector("[data-save-participants]")?.addEventListener("click", saveParticipantChanges);
  page.querySelector("[data-add-player]")?.addEventListener("click", addNewPlayerRow);
  page.querySelector("[data-save-players]")?.addEventListener("click", savePlayerChanges);
  page.querySelector("[data-player-status-filter]")?.addEventListener("change", applyAdminPlayerFilters);
  page.querySelector("[data-player-division-filter]")?.addEventListener("change", applyAdminPlayerFilters);
  page.querySelector("[data-player-search-filter]")?.addEventListener("input", applyAdminPlayerFilters);
  page.querySelector("[data-create-season]")?.addEventListener("click", createSeasonDraft);
  page.querySelector("[data-create-legacy-season]")?.addEventListener("click", selectLegacySeasonSpreadsheet);
  page.querySelector("[data-season-legacy-file]")?.addEventListener("change", importLegacySeasonSpreadsheet);
  page.querySelector("[data-ranking-reference]")?.addEventListener("change", updateRankingReferenceButton);
  page.querySelector("[data-save-ranking-reference]")?.addEventListener("click", saveRankingReference);
  bindSpreadsheetModule(page);
  loadAdminMatches("A", false);
}

function bindPlayerSearchPlaceholder() {
  if (playerSearchMediaQuery && playerSearchMediaHandler) {
    playerSearchMediaQuery.removeEventListener("change", playerSearchMediaHandler);
  }

  playerSearchMediaQuery = window.matchMedia("(max-width: 400px)");
  playerSearchMediaHandler = (event) => {
    const input = getPage()?.querySelector("[data-player-search-filter]");
    if (input) {
      input.placeholder = event.matches
        ? "Nome, exibição ou apelido"
        : "Nome completo, exibição ou apelido";
    }
  };
  playerSearchMediaQuery.addEventListener("change", playerSearchMediaHandler);
  playerSearchMediaHandler(playerSearchMediaQuery);
}

function selectAdminTool(tool) {
  const page = getPage();
  page.querySelectorAll("[data-admin-tool]").forEach((button) => button.classList.toggle("active", button.dataset.adminTool === tool));
  page.querySelectorAll("[data-admin-tool-section]").forEach((section) => { section.hidden = section.dataset.adminToolSection !== tool; });
  if (tool === "participantes" && !page.querySelector("[data-admin-participants]").dataset.loaded) {
    loadAdminParticipants(page.querySelector("[data-participant-division]").value);
  }
  if (tool === "jogadores" && !page.querySelector("[data-admin-players]").dataset.loaded) {
    loadAdminPlayers();
  }
  if (tool === "temporadas" && !page.querySelector("[data-admin-seasons]").dataset.loaded) {
    loadAdminSeasons();
  }
  if (tool === "planilhas" && !page.querySelector("[data-spreadsheet-season]").dataset.loaded) {
    loadSpreadsheetModule();
  }
  resetPageScroll();
}

function toggleAdminEditMode(event) {
  const dashboard = event.currentTarget.closest("[data-admin-dashboard]");
  const banner = dashboard?.querySelector("[data-admin-mode-banner]");
  if (!dashboard || !banner) return;

  adminEditMode = !adminEditMode;
  dashboard.classList.toggle("is-editing", adminEditMode);
  banner.innerHTML = adminEditMode
    ? `<i class="bi bi-pencil-square" aria-hidden="true"></i><div><strong>Modo de edição ativo</strong><span>Os dados do campeonato podem ser alterados e salvos.</span></div>`
    : `<i class="bi bi-eye" aria-hidden="true"></i><div><strong>Modo visualização</strong><span>Nenhuma alteração pode ser feita enquanto este modo estiver ativo.</span></div>`;

  event.currentTarget.innerHTML = adminEditMode
    ? '<i class="bi bi-eye" aria-hidden="true"></i> Voltar à visualização'
    : '<i class="bi bi-pencil-square" aria-hidden="true"></i> Ativar edição';

  dashboard.querySelectorAll("[data-admin-match]").forEach((card) => {
    const status = card.querySelector("[data-match-status]");
    const scores = [...card.querySelectorAll("[data-match-score]")];
    if (!adminEditMode && status) {
      status.value = card.dataset.originalStatus;
      status.dataset.previousStatus = card.dataset.originalStatus;
      scores[0].value = card.dataset.originalScore1 === "-" ? "" : card.dataset.originalScore1;
      scores[1].value = card.dataset.originalScore2 === "-" ? "" : card.dataset.originalScore2;
      card.dataset.woLoser = "";
      setAdminMatchObservation(card, card.dataset.originalObservation || "");
    }
    if (status) status.disabled = !adminEditMode;
    scores.forEach((score) => {
      score.disabled = !adminEditMode;
    });
    const saveButton = card.querySelector("[data-save-match]");
    if (saveButton) saveButton.disabled = !adminEditMode;
    if (!adminEditMode) updateCardDirtyState(card);
  });
  dashboard.querySelectorAll("[data-participant-select]").forEach((select) => {
    if (!adminEditMode) select.value = select.dataset.originalPlayer;
    select.disabled = !adminEditMode;
    updateParticipantDirtyState(select.closest("[data-participant-row]"));
  });
  dashboard.querySelectorAll("[data-participant-tiebreak]").forEach((input) => {
    if (!adminEditMode) input.value = input.dataset.originalTiebreak;
    input.disabled = !adminEditMode;
    updateParticipantDirtyState(input.closest("[data-participant-row]"));
  });
  dashboard.querySelectorAll("[data-participant-wo]").forEach((input) => {
    if (!adminEditMode) input.checked = input.dataset.originalWo === "true";
    input.disabled = !adminEditMode;
    updateParticipantDirtyState(input.closest("[data-participant-row]"));
  });
  dashboard.querySelectorAll("[data-round-date]").forEach((input) => {
    if (!adminEditMode) input.value = input.dataset.originalDate;
    input.disabled = !adminEditMode;
    updateRoundDateDirtyState(input.closest("[data-admin-round]"));
  });
  dashboard.querySelector("[data-add-player]").disabled = !adminEditMode;
  const createSeasonButton = dashboard.querySelector("[data-create-season]");
  if (createSeasonButton) createSeasonButton.disabled = Boolean(seasonDraft);
  dashboard.querySelectorAll("[data-season-editor] select, [data-season-editor] input, [data-season-editor] button").forEach((field) => {
    field.disabled = !adminEditMode;
  });
  const rankingReference = dashboard.querySelector("[data-ranking-reference]");
  if (rankingReference) rankingReference.disabled = !adminEditMode;
  updateRankingReferenceButton();
  dashboard.querySelectorAll("[data-player-row]").forEach((row) => {
    if (!adminEditMode && row.dataset.new === "true") {
      row.remove();
      return;
    }
    row.querySelectorAll("input, select").forEach((field) => {
      if (!adminEditMode) field.value = field.dataset.originalValue;
      field.disabled = !adminEditMode;
    });
    updatePlayerDirtyState(row);
  });
  syncSearchablePlayerComboboxes(dashboard);
  updatePlayerPendingCount();
  updateSpreadsheetConfiguration();
}

function bindSpreadsheetModule(page) {
  page.querySelector("[data-spreadsheet-season]")?.addEventListener("change", updateSpreadsheetConfiguration);
  page.querySelector("[data-spreadsheet-division]")?.addEventListener("change", updateSpreadsheetConfiguration);
  page.querySelector("[data-spreadsheet-version]")?.addEventListener("change", updateSpreadsheetConfiguration);
  page.querySelector("[data-spreadsheet-fee]")?.addEventListener("input", updateSpreadsheetFeeButton);
  page.querySelector("[data-save-spreadsheet-fee]")?.addEventListener("click", saveSpreadsheetFee);
  page.querySelector("[data-spreadsheet-select-all]")?.addEventListener("click", () => {
    page.querySelectorAll("[data-spreadsheet-sheet]:not(:disabled)").forEach((checkbox) => { checkbox.checked = true; });
  });
  page.querySelector("[data-spreadsheet-clear]")?.addEventListener("click", () => {
    page.querySelectorAll("[data-spreadsheet-sheet]").forEach((checkbox) => { checkbox.checked = false; });
  });
  page.querySelector("[data-generate-spreadsheet]")?.addEventListener("click", generateSpreadsheet);
}

async function loadSpreadsheetModule() {
  const page = getPage();
  const seasonSelect = page?.querySelector("[data-spreadsheet-season]");
  if (!page || !seasonSelect) return;
  seasonSelect.disabled = true;
  seasonSelect.innerHTML = '<option>Carregando...</option>';
  try {
    const data = await getAdminTemporadas(activeAdminSession.token);
    if (!document.body.contains(seasonSelect)) return;
    spreadsheetCurrentSeason = Number(data.temporada_atual);
    spreadsheetSeasons = (data.temporadas || []).filter((season) =>
      Number(season.participantes_a) > 0 || Number(season.participantes_b) > 0
    );
    seasonSelect.innerHTML = spreadsheetSeasons
      .map((season) => `<option value="${season.temporada}" ${Number(season.temporada) === spreadsheetCurrentSeason ? "selected" : ""}>${season.temporada} · ${season.status === "ATIVA" ? "Atual" : season.status === "ARQUIVADA" ? "Histórica" : "Em preparação"}</option>`)
      .join("");
    seasonSelect.disabled = !spreadsheetSeasons.length;
    seasonSelect.dataset.loaded = "true";
    if (!spreadsheetSeasons.length) {
      seasonSelect.innerHTML = '<option value="">Nenhuma temporada disponível</option>';
    }
    updateSpreadsheetConfiguration();
  } catch (error) {
    seasonSelect.innerHTML = '<option value="">Erro ao carregar</option>';
    showAdminModal("Não foi possível carregar", error.message, "error");
  }
}

function selectedSpreadsheetSeason() {
  const year = Number(getPage()?.querySelector("[data-spreadsheet-season]")?.value);
  return spreadsheetSeasons.find((season) => Number(season.temporada) === year) || null;
}

function updateSpreadsheetConfiguration() {
  const page = getPage();
  const season = selectedSpreadsheetSeason();
  if (!page || !season) return;
  const divisionSelect = page.querySelector("[data-spreadsheet-division]");
  const versionSelect = page.querySelector("[data-spreadsheet-version]");
  const feeInput = page.querySelector("[data-spreadsheet-fee]");
  const note = page.querySelector("[data-spreadsheet-version-note]");
  const counts = { A: Number(season.participantes_a) || 0, B: Number(season.participantes_b) || 0 };
  [...divisionSelect.options].forEach((option) => {
    option.disabled = counts[option.value] === 0;
    option.textContent = `Série ${option.value}${counts[option.value] ? ` · ${counts[option.value]} jogadores` : " · não cadastrada"}`;
  });
  if (counts[divisionSelect.value] === 0) divisionSelect.value = counts.A ? "A" : "B";

  const historical = season.status === "ARQUIVADA" || season.tipo === "LEGADA" || Number(season.temporada) < spreadsheetCurrentSeason;
  const manualOption = versionSelect.querySelector('option[value="manual"]');
  manualOption.disabled = historical;
  if (historical && versionSelect.value === "manual") versionSelect.value = "updated";
  note.innerHTML = historical
    ? '<i class="bi bi-info-circle"></i> Temporadas históricas geram somente a versão atualizada e completa.'
    : versionSelect.value === "manual"
      ? '<i class="bi bi-pencil-square"></i> A versão manual deixa placares e quadros estatísticos em branco para preenchimento à mão.'
      : '<i class="bi bi-database-check"></i> A versão atualizada utiliza o estado atual do banco de dados.';

  const classification = page.querySelector('[data-spreadsheet-sheet][value="classificacao"]');
  const classificationLabel = classification?.closest("label");
  const manual = versionSelect.value === "manual";
  if (classification) {
    classification.disabled = manual;
    classification.checked = !manual;
  }
  classificationLabel?.classList.toggle("is-disabled", manual);
  feeInput.value = season.taxa_inscricao === null || season.taxa_inscricao === undefined ? "" : Number(season.taxa_inscricao).toFixed(2);
  feeInput.dataset.savedValue = feeInput.value;
  feeInput.disabled = !adminEditMode;
  updateSpreadsheetFeeButton();
}

function updateSpreadsheetFeeButton() {
  const page = getPage();
  const input = page?.querySelector("[data-spreadsheet-fee]");
  const button = page?.querySelector("[data-save-spreadsheet-fee]");
  if (!input || !button) return;
  button.disabled = !adminEditMode || input.value === input.dataset.savedValue;
}

async function saveSpreadsheetFee(event) {
  const button = event.currentTarget;
  const page = getPage();
  const input = page?.querySelector("[data-spreadsheet-fee]");
  const season = selectedSpreadsheetSeason();
  if (!input || !season || !adminEditMode) return;
  button.disabled = true;
  button.innerHTML = '<span class="loading-spinner-inline"></span> Salvando';
  try {
    const response = await saveAdminTaxaInscricao(activeAdminSession.token, season.temporada, input.value);
    season.taxa_inscricao = response.taxa_inscricao;
    input.value = response.taxa_inscricao === null ? "" : Number(response.taxa_inscricao).toFixed(2);
    input.dataset.savedValue = input.value;
    showAdminModal("Taxa salva", `A taxa de inscrição de ${season.temporada} foi atualizada.`, "success");
  } catch (error) {
    showAdminModal("Não foi possível salvar", error.message, "error");
  } finally {
    button.innerHTML = "Salvar taxa";
    updateSpreadsheetFeeButton();
  }
}

async function generateSpreadsheet(event) {
  const page = getPage();
  const season = selectedSpreadsheetSeason();
  const division = page?.querySelector("[data-spreadsheet-division]")?.value;
  const version = page?.querySelector("[data-spreadsheet-version]")?.value;
  const sheets = [...(page?.querySelectorAll("[data-spreadsheet-sheet]:checked:not(:disabled)") || [])].map((checkbox) => checkbox.value);
  if (!season || !division || !sheets.length) {
    showAdminModal("Selecione as folhas", "Escolha ao menos uma folha para gerar a planilha.", "error");
    return;
  }
  const button = event.currentTarget;
  button.disabled = true;
  button.innerHTML = '<span class="loading-spinner-inline"></span> Gerando planilha';
  try {
    const data = await getAdminDadosPlanilha(activeAdminSession.token, season.temporada, division);
    await exportChampionshipSpreadsheet(data, { version, sheets });
    showAdminModal("Planilha gerada", `O arquivo da Série ${division} de ${season.temporada} foi preparado para download.`, "success");
  } catch (error) {
    showAdminModal("Não foi possível gerar", error.message, "error");
  } finally {
    button.disabled = false;
    button.innerHTML = '<i class="bi bi-download"></i> Gerar planilha';
  }
}

async function loadAdminSeasons() {
  const container = getPage()?.querySelector("[data-admin-seasons]");
  if (!container) return;
  container.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Carregando temporadas...</p></div>';
  try {
    const data = await getAdminTemporadas(activeAdminSession.token);
    if (!document.body.contains(container)) return;
    container.dataset.loaded = "true";
    renderSeasonList(data);
  } catch (error) {
    container.innerHTML = `<p class="error-state-inline">${escapeHtml(error.message)}</p>`;
  }
}

function renderSeasonList(data) {
  const page = getPage();
  const container = page?.querySelector("[data-admin-seasons]");
  const yearSelect = page?.querySelector("[data-season-year]");
  const legacyYear = page?.querySelector("[data-season-legacy-year]");
  const rankingReference = page?.querySelector("[data-ranking-reference]");
  if (!container || !yearSelect) return;
  const seasons = data.temporadas || [];
  container.innerHTML = seasons.map((season) => `
    <article class="admin-season-summary ${season.status === "ATIVA" ? "is-current" : ""}">
      <div><strong>Temporada ${season.temporada}</strong><span>${season.status === "ATIVA" ? "Atual e publicada" : season.status === "ARQUIVADA" ? "Temporada histórica" : season.tipo === "LEGADA" ? "Rascunho histórico" : "Preparação salva"}</span></div>
      <small>Série A: ${season.participantes_a} · Série B: ${season.participantes_b}</small>
      ${season.status === "PREPARACAO" || (season.status === "ARQUIVADA" && season.tipo === "LEGADA") ? `<button class="btn btn-admin-secondary" type="button" data-edit-season="${season.temporada}">Editar</button>` : ""}
    </article>`).join("");
  const used = new Set(seasons.map((season) => Number(season.temporada)));
  const start = Math.max(Number(data.ano_minimo), Number(data.temporada_atual) + 1);
  yearSelect.innerHTML = Array.from({ length: 6 }, (_, index) => start + index)
    .filter((year) => !used.has(year))
    .map((year) => `<option value="${year}">${year}</option>`).join("");
  page.querySelector("[data-create-season]").disabled = !yearSelect.value || Boolean(seasonDraft);
  if (legacyYear) {
    const availableLegacyYears = [];
    let candidate = Number(data.temporada_atual) - 1;
    while (availableLegacyYears.length < 5 && candidate >= 1900) {
      if (!used.has(candidate)) availableLegacyYears.push(candidate);
      candidate -= 1;
    }
    legacyYear.innerHTML = availableLegacyYears
      .map((year) => `<option value="${year}">${year}</option>`)
      .join("");
  }
  page.querySelector("[data-create-legacy-season]").disabled = !legacyYear?.value || Boolean(seasonDraft);
  if (rankingReference) {
    const rankingSeasons = seasons
      .filter((season) => ["ATIVA", "ARQUIVADA"].includes(season.status) && Number(season.participantes_a) >= 2)
      .sort((a, b) => Number(b.temporada) - Number(a.temporada));
    rankingReference.innerHTML = [
      `<option value="">Automático (${Number(data.temporada_atual) - 1})</option>`,
      ...rankingSeasons.map((season) => `<option value="${season.temporada}">${season.temporada}${Number(season.temporada) === Number(data.temporada_atual) ? " · temporada atual" : ""}</option>`),
    ].join("");
    rankingReference.value = data.referencia_ranking == null ? "" : String(data.referencia_ranking);
    rankingReference.dataset.savedValue = rankingReference.value;
    rankingReference.disabled = !adminEditMode;
    updateRankingReferenceButton();
  }
  container.querySelectorAll("[data-edit-season]").forEach((button) => button.addEventListener("click", () => openSavedSeason(Number(button.dataset.editSeason))));
}

function updateRankingReferenceButton() {
  const select = getPage()?.querySelector("[data-ranking-reference]");
  const button = getPage()?.querySelector("[data-save-ranking-reference]");
  if (!select || !button) return;
  button.disabled = !adminEditMode || select.value === select.dataset.savedValue;
}

async function saveRankingReference(event) {
  const select = getPage()?.querySelector("[data-ranking-reference]");
  if (!select || !adminEditMode) return;
  const button = event.currentTarget;
  button.disabled = true;
  button.innerHTML = '<span class="loading-spinner-inline"></span> Salvando';
  try {
    const result = await saveAdminRankingReference(activeAdminSession.token, select.value || null);
    select.dataset.savedValue = result.referencia_ranking == null ? "" : String(result.referencia_ranking);
    showAdminModal(
      "Referência atualizada",
      result.referencia_ranking == null
        ? `O Ranking acompanhará automaticamente a temporada ${result.referencia_ranking_efetiva}.`
        : `O Ranking agora considera as cinco temporadas até ${result.referencia_ranking_efetiva}.`,
      "success",
    );
  } catch (error) {
    showAdminModal("Não foi possível salvar", error.message, "error");
  } finally {
    button.innerHTML = "Salvar referência";
    updateRankingReferenceButton();
  }
}

function selectLegacySeasonSpreadsheet() {
  if (!adminEditMode) {
    showAdminModal("Ative o modo de edição", "Para importar uma temporada passada, primeiro ative o modo de edição.", "error");
    return;
  }
  const year = Number(getPage()?.querySelector("[data-season-legacy-year]")?.value);
  if (!year) {
    showAdminModal("Informe o ano", "Escolha o ano da temporada passada antes de selecionar a planilha.", "error");
    return;
  }
  legacySpreadsheetTarget = "new";
  getPage()?.querySelector("[data-season-legacy-file]")?.click();
}

function selectLegacySeasonSpreadsheetForEditor() {
  if (!adminEditMode || seasonDraft?.modo !== "LEGADA") return;
  legacySpreadsheetTarget = "editor";
  getPage()?.querySelector("[data-season-legacy-file]")?.click();
}

async function importLegacySeasonSpreadsheet(event) {
  const file = event.currentTarget.files?.[0];
  event.currentTarget.value = "";
  if (!file) return;
  const editingExisting = legacySpreadsheetTarget === "editor" && seasonDraft?.modo === "LEGADA";
  const year = editingExisting
    ? Number(seasonDraft.temporada)
    : Number(getPage()?.querySelector("[data-season-legacy-year]")?.value);
  const button = editingExisting
    ? getPage()?.querySelector("[data-import-season-spreadsheet]")
    : getPage()?.querySelector("[data-create-legacy-season]");
  if (button) {
    button.disabled = true;
    button.innerHTML = '<span class="loading-spinner loading-spinner-inline" aria-hidden="true"></span> Importando...';
  }
  try {
    const base = editingExisting
      ? structuredClone(seasonDraft)
      : await prepareAdminTemporadaLegada(activeAdminSession.token, year);
    const imported = await readLegacySeasonSpreadsheet(file, base.jogadores || [], editingExisting ? base : null);
    if (!imported) return;
    const importedDraft = {
      ...base,
      persistida: editingExisting ? base.persistida : false,
      modo: "LEGADA",
      participantes: imported.participantes,
      rodadas: imported.rodadas,
    };
    if (editingExisting) {
      seasonDraft = structuredClone(importedDraft);
      renderSeasonEditor();
      getPage()?.querySelector("[data-season-editor]")?.classList.add("is-dirty");
    } else {
      setSeasonDraft(importedDraft);
    }
    showAdminModal(
      "Planilha importada",
      editingExisting
        ? `As séries presentes na planilha foram atualizadas em ${year}. As demais foram preservadas. Confira tudo antes de salvar as alterações.`
        : `Os dados de ${year} foram carregados somente para revisão. Confira participantes, datas, horários e placares antes de salvar o rascunho.`,
      "success",
    );
  } catch (error) {
    showAdminModal("Não foi possível importar", error.message, "error");
  } finally {
    if (button) {
      button.disabled = editingExisting ? !adminEditMode : Boolean(seasonDraft);
      button.innerHTML = editingExisting
        ? '<i class="bi bi-file-earmark-arrow-up"></i> Importar/atualizar planilha'
        : '<i class="bi bi-file-earmark-arrow-up"></i> Importar planilha';
    }
    legacySpreadsheetTarget = "new";
  }
}

async function readLegacySeasonSpreadsheet(file, players, existingDraft = null) {
  const XLSX = await loadXlsxLibrary();
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const participantRows = getImportedSheetRows(XLSX, workbook, "Participantes");
  const matchRows = getImportedSheetRows(XLSX, workbook, "Partidas");
  if (!participantRows.length) throw new Error("A aba Participantes está vazia.");
  if (!matchRows.length) throw new Error("A aba Partidas está vazia.");

  const participantes = { A: [], B: [] };
  const importedDivisions = new Set();
  const usedPlayers = new Set();
  participantRows.forEach((row, index) => {
    const division = String(row.divisao || "").trim().toUpperCase();
    importedDivisions.add(division);
    const number = Number(row.numero);
    if (!participantes[division]) throw new Error(`Participantes, linha ${index + 2}: informe divisão A ou B.`);
    if (!Number.isInteger(number) || number < 1) throw new Error(`Participantes, linha ${index + 2}: número inválido.`);
    const player = resolveImportedPlayer(row, players, index + 2);
    if (usedPlayers.has(Number(player.id))) throw new Error(`O jogador ${player.exibicao} aparece mais de uma vez em Participantes.`);
    usedPlayers.add(Number(player.id));
    const tiebreak = row.desempate === "" || row.desempate === undefined
      ? null
      : Number(row.desempate);
    if (tiebreak !== null && (!Number.isInteger(tiebreak) || tiebreak < 1)) {
      throw new Error(`Participantes, linha ${index + 2}: desempate deve ser um inteiro a partir de 1.`);
    }
    participantes[division].push({
      divisao: division,
      numero: number,
      jogador_id: Number(player.id),
      desempate: tiebreak,
      wo_direto: false,
    });
  });
  ["A", "B"].forEach((division) => {
    participantes[division].sort((a, b) => a.numero - b.numero);
    participantes[division].forEach((participant, index) => {
      if (participant.numero !== index + 1) throw new Error(`Na Série ${division}, os participantes devem ser numerados em sequência a partir de 1.`);
    });
  });
  if (!existingDraft && participantes.A.length < 2) throw new Error("A aba Participantes deve conter pelo menos 2 jogadores na Série A.");
  if (participantes.B.length === 1) throw new Error("Quando informada, a Série B deve conter pelo menos 2 jogadores.");
  if (!existingDraft && !participantes.B.length) {
    const confirmed = await confirmAdminChange(
      "Temporada sem Série B?",
      "A planilha não possui participantes da Série B. Confirma que esta temporada teve somente a Série A?",
    );
    if (!confirmed) return null;
  }

  const roundMaps = { A: new Map(), B: new Map() };
  matchRows.forEach((row, index) => {
    const line = index + 2;
    const division = String(row.divisao || "").trim().toUpperCase();
    const roundNumber = Number(row.rodada);
    const number1 = Number(row.numero1);
    const number2 = Number(row.numero2);
    if (!roundMaps[division]) throw new Error(`Partidas, linha ${line}: informe divisão A ou B.`);
    if (!importedDivisions.has(division)) {
      throw new Error(`Partidas, linha ${line}: inclua também os participantes da Série ${division} nesta importação.`);
    }
    if (!Number.isInteger(roundNumber) || roundNumber < 1) throw new Error(`Partidas, linha ${line}: rodada inválida.`);
    const participantNumbers = new Set(participantes[division].map((item) => item.numero));
    if (!participantNumbers.has(number1) || !participantNumbers.has(number2) || number1 === number2) {
      throw new Error(`Partidas, linha ${line}: os números dos jogadores são inválidos.`);
    }
    const importedScore = normalizeImportedScorePair(row.placar1, row.placar2, line);
    const placar1 = importedScore.placar1;
    const placar2 = importedScore.placar2;
    const loserNumber = importedScore.woLoser === 1 ? number1 : importedScore.woLoser === 2 ? number2 : null;
    const loser = loserNumber === null
      ? null
      : participantes[division].find((item) => item.numero === loserNumber);
    const loserPlayer = loser
      ? players.find((player) => Number(player.id) === Number(loser.jogador_id))
      : null;
    const importedObservation = importedScore.woBoth
      ? "W.O.: ambos abandonaram a competição"
      : loserPlayer
        ? `W.O.: ${loserPlayer.exibicao}`
        : String(row.observacao || "").trim();
    if (!roundMaps[division].has(roundNumber)) {
      roundMaps[division].set(roundNumber, { rodada: roundNumber, tipo: "REGULAR", folga: null, partidas: [] });
    }
    roundMaps[division].get(roundNumber).partidas.push({
      numero1: number1,
      numero2: number2,
      data: normalizeImportedDate(row.data, line),
      hora: normalizeImportedTime(row.hora, line),
      status: "E",
      placar1,
      placar2,
      observacao: importedObservation,
    });
  });

  const rodadas = { A: [], B: [] };
  ["A", "B"].forEach((division) => {
    rodadas[division] = [...roundMaps[division].values()].sort((a, b) => a.rodada - b.rodada);
    rodadas[division].forEach((round, index) => {
      if (round.rodada !== index + 1) throw new Error(`As rodadas da Série ${division} devem ser numeradas em sequência a partir de 1.`);
      const used = new Set(round.partidas.flatMap((match) => [match.numero1, match.numero2]));
      if (used.size !== round.partidas.length * 2) throw new Error(`Um participante aparece duas vezes na rodada ${round.rodada} da Série ${division}.`);
      const expectedPlayers = participantes[division].length - (participantes[division].length % 2);
      if (used.size !== expectedPlayers) {
        throw new Error(`A rodada ${round.rodada} da Série ${division} não contém a quantidade esperada de participantes.`);
      }
      if (participantes[division].length % 2 === 1) {
        const absent = participantes[division].filter((item) => !used.has(item.numero));
        if (absent.length !== 1) throw new Error(`A rodada ${round.rodada} da Série ${division} deve possuir exatamente uma folga.`);
        round.folga = absent[0].numero;
      }
    });
  });
  if (!existingDraft) return { participantes, rodadas };
  const mergedParticipants = structuredClone(existingDraft.participantes);
  const mergedRounds = structuredClone(existingDraft.rodadas);
  importedDivisions.forEach((division) => {
    mergedParticipants[division] = participantes[division];
    mergedRounds[division] = rodadas[division];
  });
  const mergedIds = [...mergedParticipants.A, ...mergedParticipants.B]
    .map((item) => Number(item.jogador_id));
  if (new Set(mergedIds).size !== mergedIds.length) {
    throw new Error("Um jogador não pode participar das duas séries na mesma temporada.");
  }
  return { participantes: mergedParticipants, rodadas: mergedRounds };
}

function getImportedSheetRows(XLSX, workbook, expectedName) {
  const sheetName = workbook.SheetNames.find(
    (name) => normalizeImportedText(name) === normalizeImportedText(expectedName),
  );
  if (!sheetName) throw new Error(`A planilha não contém a aba ${expectedName}. Use o modelo disponibilizado pelo sistema.`);
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: true })
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeImportedText(key), value])))
    .filter((row) => Object.values(row).some((value) => String(value ?? "").trim() !== ""));
}

function resolveImportedPlayer(row, players, line) {
  const informedId = Number(row.jogador_id);
  if (Number.isInteger(informedId) && informedId > 0) {
    const player = players.find((item) => Number(item.id) === informedId);
    if (!player) throw new Error(`Participantes, linha ${line}: jogador_id ${informedId} não foi encontrado.`);
    return player;
  }
  const informedName = normalizeImportedText(row.jogador);
  if (!informedName) throw new Error(`Participantes, linha ${line}: informe jogador_id ou jogador.`);
  const matches = players.filter((player) =>
    [player.exibicao, player.nome, player.apelido].some((value) => normalizeImportedText(value) === informedName),
  );
  if (matches.length !== 1) {
    throw new Error(matches.length ? `Participantes, linha ${line}: o nome ${row.jogador} é ambíguo; use jogador_id.` : `Participantes, linha ${line}: jogador ${row.jogador} não foi encontrado.`);
  }
  return matches[0];
}

function normalizeImportedText(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");
}

function normalizeImportedScore(value, line) {
  if (value === "" || value === null || value === undefined || value === "-") return "-";
  const score = Number(value);
  if (!Number.isInteger(score) || score < 0 || score > 2) throw new Error(`Partidas, linha ${line}: placar inválido.`);
  return String(score);
}

function normalizeImportedScorePair(value1, value2, line) {
  const compact1 = normalizeImportedWalkoverToken(value1);
  const compact2 = normalizeImportedWalkoverToken(value2);
  const combined1 = compact1.match(/^(W|0)X(W|0)$/);
  const combined2 = compact2.match(/^(W|0)X(W|0)$/);
  if (combined1 || combined2) {
    const combined = combined1 || combined2;
    const otherValue = combined1 ? value2 : value1;
    if (String(otherValue ?? "").trim() !== "") {
      throw new Error(`Partidas, linha ${line}: informe o W.O. compacto em apenas uma das colunas de placar.`);
    }
    return normalizeImportedWalkoverPair(combined[1], combined[2], line);
  }

  const token1 = compact1 === "W" ? "W" : value1;
  const token2 = compact2 === "W" ? "W" : value2;
  if (token1 === "W" || token2 === "W") {
    return normalizeImportedWalkoverPair(token1, token2, line);
  }
  return {
    placar1: normalizeImportedScore(value1, line),
    placar2: normalizeImportedScore(value2, line),
    woLoser: null,
    woBoth: false,
  };
}

function normalizeImportedWalkoverToken(value) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/W\.O\.?|WO/g, "W")
    .replace(/×/g, "X");
}

function normalizeImportedWalkoverPair(value1, value2, line) {
  const token1 = normalizeImportedWalkoverToken(value1);
  const token2 = normalizeImportedWalkoverToken(value2);
  if (token1 === "W" && token2 === "W") {
    return { placar1: "0", placar2: "0", woLoser: null, woBoth: true };
  }
  if (token1 === "W" && token2 === "0") {
    return { placar1: "2", placar2: "0", woLoser: 2, woBoth: false };
  }
  if (token1 === "0" && token2 === "W") {
    return { placar1: "0", placar2: "2", woLoser: 1, woBoth: false };
  }
  throw new Error(`Partidas, linha ${line}: use W x 0, 0 x W ou W x W para registrar W.O.`);
}

function normalizeImportedDate(value, line) {
  if (value === "" || value === null || value === undefined) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const brazilian = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brazilian) return `${brazilian[3]}-${brazilian[2].padStart(2, "0")}-${brazilian[1].padStart(2, "0")}`;
  throw new Error(`Partidas, linha ${line}: data inválida.`);
}

function normalizeImportedTime(value, line) {
  if (value === "" || value === null || value === undefined) return "19:00";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getUTCHours()).padStart(2, "0")}:${String(value.getUTCMinutes()).padStart(2, "0")}`;
  }
  if (typeof value === "number" && value >= 0 && value < 1) {
    const minutes = Math.round(value * 24 * 60) % (24 * 60);
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  }
  const match = String(value).trim().match(/^([01]?\d|2[0-3]):([0-5]\d)/);
  if (match) return `${match[1].padStart(2, "0")}:${match[2]}`;
  throw new Error(`Partidas, linha ${line}: horário inválido.`);
}

function loadXlsxLibrary() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  if (xlsxLibraryPromise) return xlsxLibraryPromise;
  xlsxLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("Não foi possível carregar o leitor de planilhas. Verifique sua conexão e tente novamente."));
    document.head.appendChild(script);
  });
  return xlsxLibraryPromise;
}

async function createSeasonDraft() {
  if (!adminEditMode) {
    showAdminModal(
      "Ative o modo de edição",
      "Para criar uma temporada, primeiro ative o modo de edição no início da página.",
      "error",
    );
    return;
  }
  const year = Number(getPage()?.querySelector("[data-season-year]")?.value);
  if (!year) return;
  const button = getPage()?.querySelector("[data-create-season]");
  if (button) {
    button.disabled = true;
    button.innerHTML = '<span class="loading-spinner loading-spinner-inline" aria-hidden="true"></span> Preparando...';
  }
  try {
    const data = await prepareAdminTemporada(activeAdminSession.token, year);
    setSeasonDraft(data);
  } catch (error) {
    showAdminModal("Não foi possível criar", error.message, "error");
  } finally {
    if (button) {
      button.innerHTML = CREATE_SEASON_BUTTON_HTML;
      button.disabled = Boolean(seasonDraft);
    }
  }
}

async function openSavedSeason(year) {
  if (seasonDraft && isSeasonDirty()) {
    const confirmed = await confirmAdminChange("Descartar alterações?", "As alterações não salvas da temporada aberta serão perdidas.");
    if (!confirmed) return;
  }
  try {
    const data = await getAdminTemporada(activeAdminSession.token, year);
    setSeasonDraft(data);
  } catch (error) {
    showAdminModal("Não foi possível carregar", error.message, "error");
  }
}

function setSeasonDraft(data) {
  seasonDraft = structuredClone(data);
  savedSeasonDraft = data.persistida ? structuredClone(data) : null;
  renderSeasonEditor();
}

function renderSeasonEditor() {
  const page = getPage();
  const editor = page?.querySelector("[data-season-editor]");
  if (!editor || !seasonDraft) return;
  const players = seasonDraft.jogadores || [];
  const options = (selected) => players.map((player) => `<option value="${player.id}" data-player-search="${escapeHtml([player.nome, player.exibicao, player.apelido].filter(Boolean).join(" "))}" ${Number(selected) === Number(player.id) ? "selected" : ""}>${escapeHtml(player.exibicao)}${player.ativo ? "" : " (inativo)"}</option>`).join("");
  const rows = (division) => seasonDraft.participantes[division].map((participant, index) => `
    <div class="admin-season-participant ${seasonDraft.modo === "LEGADA" ? "has-tiebreak" : ""} ${division === "B" ? "has-remove" : ""}" data-season-participant data-division="${division}">
      <span>${index + 1}</span><select class="admin-select" ${adminEditMode ? "" : "disabled"}>${options(participant.jogador_id)}</select>
      ${seasonDraft.modo === "LEGADA" ? `<label class="admin-season-tiebreak" title="Prioridade interna aplicada somente em empates"><span>Desempate</span><input class="admin-input" type="number" min="1" step="1" inputmode="numeric" value="${participant.desempate || ""}" data-season-tiebreak ${adminEditMode ? "" : "disabled"}></label>` : ""}
      <label class="admin-season-wo" title="Não contabilizar pontos desta temporada no Ranking"><input type="checkbox" data-season-wo ${participant.wo_direto ? "checked" : ""} ${adminEditMode ? "" : "disabled"}><span>W.O.</span></label>
      ${division === "B" ? '<button class="btn btn-admin-secondary" type="button" data-remove-season-player aria-label="Remover participante"><i class="bi bi-trash"></i></button>' : ""}
    </div>`).join("");
  const publishedLegacy = seasonDraft.modo === "LEGADA" && seasonDraft.status === "ARQUIVADA";
  const persistedControls = seasonDraft.persistida && !publishedLegacy
    ? `<div class="admin-season-editor-controls"><button class="btn" type="button" data-activate-season>${seasonDraft.modo === "LEGADA" ? "Publicar" : "Ativar temporada"}</button><button class="btn btn-admin-danger" type="button" data-delete-season>Excluir temporada</button></div>`
    : "";
  editor.hidden = false;
  editor.innerHTML = `
    <div class="admin-season-editor-heading"><div><strong>Temporada ${seasonDraft.temporada}</strong><span>${publishedLegacy ? "Temporada histórica publicada" : seasonDraft.modo === "LEGADA" ? seasonDraft.persistida ? "Rascunho histórico salvo" : "Cadastro de temporada passada" : seasonDraft.persistida ? "Preparação salva" : "Novo rascunho não salvo"}</span></div>${persistedControls}</div>
    ${seasonDraft.modo === "LEGADA" ? `<div class="admin-season-editor-controls"><button class="btn btn-admin-secondary" type="button" data-import-season-spreadsheet ${adminEditMode ? "" : "disabled"}><i class="bi bi-file-earmark-arrow-up"></i> Importar/atualizar planilha</button></div>` : ""}
    ${seasonDraft.modo === "LEGADA" ? '<p class="admin-season-tiebreak-note"><strong>Desempate interno:</strong> use 1, 2, 3… somente para definir a ordem manual entre jogadores com os mesmos números de vitórias e partidas ganhas. Essa prioridade não aparece no site público.</p>' : ""}
    <p class="admin-season-tiebreak-note"><strong>W.O. direto:</strong> o participante não pontuará neste ano no Ranking. Ao salvar, seus confrontos serão encerrados como derrota por W.O.; contra outro participante marcado, o resultado será 0 × 0.</p>
    <div class="admin-season-divisions">
      <section><h3>Série A <small>${seasonDraft.participantes.A.length} participantes</small></h3><div data-season-list="A">${rows("A")}</div></section>
      <section><h3>Série B <small>${seasonDraft.participantes.B.length} participantes${seasonDraft.modo === "LEGADA" ? " (opcional)" : ""}</small></h3><div data-season-list="B">${rows("B")}</div><button class="btn btn-admin-secondary admin-season-add" type="button" data-add-season-player ${adminEditMode ? "" : "disabled"}><i class="bi bi-person-plus"></i> Adicionar participante</button></section>
    </div>
    ${renderSeasonSchedulePreview()}
    <div class="admin-season-actions"><button class="btn btn-admin-secondary" type="button" data-cancel-season>Cancelar alterações</button><button class="btn" type="button" data-save-season ${adminEditMode ? "" : "disabled"}>${publishedLegacy ? "Salvar alterações" : seasonDraft.modo === "LEGADA" ? "Salvar rascunho" : "Salvar temporada"}</button></div>`;
  editor.querySelectorAll("[data-season-participant] select").forEach((select) => select.addEventListener("change", syncSeasonDraftFromEditor));
  editor.querySelectorAll("[data-season-tiebreak]").forEach((input) => input.addEventListener("change", syncSeasonDraftFromEditor));
  editor.querySelectorAll("[data-season-wo]").forEach((input) => input.addEventListener("change", syncSeasonDraftFromEditor));
  editor.querySelectorAll("[data-season-participant] select").forEach(enhanceSearchablePlayerSelect);
  editor.querySelectorAll("[data-remove-season-player]").forEach((button) => button.addEventListener("click", removeSeasonPlayer));
  editor.querySelector("[data-add-season-player]")?.addEventListener("click", addSeasonPlayer);
  editor.querySelector("[data-cancel-season]")?.addEventListener("click", cancelSeasonChanges);
  editor.querySelector("[data-save-season]")?.addEventListener("click", saveSeasonChanges);
  editor.querySelector("[data-delete-season]")?.addEventListener("click", deleteSeasonDraft);
  editor.querySelector("[data-activate-season]")?.addEventListener("click", activateSeasonDraft);
  editor.querySelector("[data-import-season-spreadsheet]")?.addEventListener("click", selectLegacySeasonSpreadsheetForEditor);
  editor.querySelectorAll("[data-draw-season]").forEach((button) =>
    button.addEventListener("click", () => previewSeasonDraw(button.dataset.drawSeason)),
  );
  editor.querySelectorAll("[data-season-schedule-details]").forEach((details) =>
    details.addEventListener("toggle", handleSeasonScheduleOpen),
  );
  editor.querySelectorAll("[data-season-schedule-field]").forEach((input) =>
    input.addEventListener("change", updateSeasonScheduleField),
  );
  editor.querySelectorAll("[data-season-round-field]").forEach((input) =>
    input.addEventListener("change", updateSeasonRoundField),
  );
  enableSeasonSchedulePickers(editor);
  page.querySelector("[data-create-season]").disabled = true;
  page.querySelector("[data-create-legacy-season]").disabled = true;
}

function syncSeasonDraftFromEditor() {
  const editor = getPage()?.querySelector("[data-season-editor]");
  ["A", "B"].forEach((division) => {
    seasonDraft.participantes[division] = [...editor.querySelectorAll(`[data-season-participant][data-division="${division}"]`)]
      .map((row, index) => ({
        divisao: division,
        numero: index + 1,
        jogador_id: Number(row.querySelector("select").value),
        desempate: row.querySelector("[data-season-tiebreak]")?.value
          ? Number(row.querySelector("[data-season-tiebreak]").value)
          : null,
        wo_direto: Boolean(row.querySelector("[data-season-wo]")?.checked),
      }));
  });
  editor.classList.toggle("is-dirty", isSeasonDirty());
}

function renderSeasonSchedulePreview() {
  const schedules = getEffectiveSeasonSchedules();
  const playersById = new Map((seasonDraft.jogadores || []).map((player) => [Number(player.id), player]));
  const playerName = (division, number) => {
    const participant = seasonDraft.participantes[division][number - 1];
    return playersById.get(Number(participant?.jogador_id))?.exibicao || `Nº ${number}`;
  };
  const divisionPreview = (division) => {
    const rounds = schedules[division] || [];
    const totalMatches = rounds.reduce((total, round) => total + round.partidas.length, 0);
    const drawButton = seasonDraft.modo === "LEGADA"
      ? ""
      : `<button class="btn btn-admin-secondary admin-season-draw" type="button" data-draw-season="${division}" ${adminEditMode ? "" : "disabled"}><i class="bi bi-shuffle"></i> Simular sorteio da Série ${division}</button>`;
    return `<div class="admin-season-schedule-wrap">
      ${drawButton}
      <details class="admin-season-schedule" data-season-schedule-details data-division="${division}">
      <summary><span><strong>Chaveamento da Série ${division}</strong><small>${rounds.length} rodadas · ${totalMatches} partidas</small></span><i class="bi bi-chevron-down"></i></summary>
      <div class="admin-season-round-list">${rounds.map((round) => renderSeasonRoundSchedule(division, round, playerName)).join("")}</div>
      </details>
    </div>`;
  };
  return `<div class="admin-season-schedules"><h3>Prévia do chaveamento</h3><p>Cada participante enfrenta todos os demais uma única vez.</p>${divisionPreview("A")}${divisionPreview("B")}</div>`;
}

function renderSeasonRoundSchedule(division, round, playerName) {
  const commonDate = getCommonSeasonRoundValue(round, "data");
  const commonTime = getCommonSeasonRoundValue(round, "hora");
  return `<section data-season-round-preview data-division="${division}" data-round-index="${round.rodada - 1}">
    <h4>Rodada ${round.rodada}</h4>
    <div class="admin-season-round-schedule">
      <label><span>Data da rodada</span><input class="admin-input" type="date" value="${escapeHtml(commonDate)}" data-season-round-field="data" data-division="${division}" data-round-index="${round.rodada - 1}" ${adminEditMode ? "" : "disabled"}></label>
      <label><span>Horário da rodada</span><input class="admin-input" type="time" value="${escapeHtml(commonTime)}" data-season-round-field="hora" data-division="${division}" data-round-index="${round.rodada - 1}" ${adminEditMode ? "" : "disabled"}></label>
    </div>
    ${round.partidas.map((match, matchIndex) => `<div class="admin-season-match-preview"><p><span>${escapeHtml(playerName(division, match.numero1))}</span><b>×</b><span>${escapeHtml(playerName(division, match.numero2))}</span></p><div class="admin-season-match-schedule"><label><span>Data</span><input class="admin-input" type="date" value="${escapeHtml(match.data || "")}" data-season-schedule-field="data" data-division="${division}" data-round-index="${round.rodada - 1}" data-match-index="${matchIndex}" ${adminEditMode ? "" : "disabled"}></label><label><span>Horário</span><input class="admin-input" type="time" value="${escapeHtml(match.hora || "19:00")}" data-season-schedule-field="hora" data-division="${division}" data-round-index="${round.rodada - 1}" data-match-index="${matchIndex}" ${adminEditMode ? "" : "disabled"}></label>${renderHistoricalMatchResult(division, round.rodada - 1, matchIndex, match)}</div></div>`).join("")}
    ${round.folga ? `<small class="admin-season-bye"><i class="bi bi-pause-circle"></i> Folga: ${escapeHtml(playerName(division, round.folga))}</small>` : ""}
  </section>`;
}

function renderHistoricalMatchResult(division, roundIndex, matchIndex, match) {
  if (seasonDraft.modo !== "LEGADA") return "";
  const option = (value, selected, label = value) => `<option value="${value}" ${String(selected) === String(value) ? "selected" : ""}>${label}</option>`;
  const attributes = `data-division="${division}" data-round-index="${roundIndex}" data-match-index="${matchIndex}" ${adminEditMode ? "" : "disabled"}`;
  const scoreOptions = (selected) => ["-", 0, 1, 2].map((value) => option(value, selected)).join("") + option("WO", selected, "W.O.") + option("WO2", selected, "W.O. 2");
  return `<label><span>Placar</span><div class="admin-season-history-score"><select class="admin-select" data-season-schedule-field="placar1" ${attributes}>${scoreOptions(match.placar1 ?? "-")}</select><b>×</b><select class="admin-select" data-season-schedule-field="placar2" ${attributes}>${scoreOptions(match.placar2 ?? "-")}</select></div></label><label><span>Status</span><span class="admin-season-history-status"><i class="bi bi-check-circle"></i> Encerrada</span></label><small class="admin-season-history-observation" data-season-history-observation ${match.observacao ? "" : "hidden"}>${escapeHtml(match.observacao || "")}</small>`;
}

function getCommonSeasonRoundValue(round, field) {
  const values = [...new Set(round.partidas.map((match) => match[field] || (field === "hora" ? "19:00" : "")))];
  return values.length === 1 ? values[0] : "";
}

function handleSeasonScheduleOpen(event) {
  const details = event.currentTarget;
  if (!details.open || !adminEditMode) return;
  const division = details.dataset.division;
  const firstRound = seasonDraft.rodadas?.[division]?.[0];
  if (!firstRound || getCommonSeasonRoundValue(firstRound, "data")) return;
  details.open = false;
  requestSeasonScheduleStart(division, details);
}

function requestSeasonScheduleStart(division, details) {
  document.querySelector(".admin-modal-backdrop")?.remove();
  const legacy = seasonDraft.modo === "LEGADA";
  const firstRound = seasonDraft.rodadas?.[division]?.[0];
  const initialTime = firstRound
    ? getCommonSeasonRoundValue(firstRound, "hora") || "19:00"
    : "19:00";
  const modal = document.createElement("div");
  modal.className = "admin-modal-backdrop";
  modal.innerHTML = `<div class="admin-modal admin-season-start-modal" role="dialog" aria-modal="true">
    <i class="bi bi-calendar2-week"></i>
    <h2>Início da Série ${division}</h2>
    <p>${legacy
      ? "Informe a data e o horário da primeira rodada. As demais rodadas poderão ser ajustadas individualmente."
      : "Informe a data e o horário da primeira rodada. A partir da rodada seguinte, as datas serão distribuídas automaticamente entre as próximas terças e quintas."}</p>
    <div class="admin-season-start-fields">
      <label><span>Data de início</span><input class="admin-input" type="date" data-season-start-date required></label>
      <label><span>Horário</span><input class="admin-input" type="time" value="${escapeHtml(initialTime)}" data-season-start-time required></label>
    </div>
    <div class="admin-modal-actions"><button class="btn btn-admin-secondary" type="button" data-cancel>Cancelar</button><button class="btn" type="button" data-confirm>Confirmar</button></div>
  </div>`;
  document.body.appendChild(modal);
  enableSeasonSchedulePickers(modal);
  const dateInput = modal.querySelector("[data-season-start-date]");
  const timeInput = modal.querySelector("[data-season-start-time]");
  dateInput.focus();
  modal.querySelector("[data-cancel]").addEventListener("click", () => modal.remove());
  modal.querySelector("[data-confirm]").addEventListener("click", () => {
    const firstDate = parseSeasonDate(dateInput.value);
    if (!firstDate) {
      showSeasonStartDateError(modal, dateInput);
      return;
    }
    if (!timeInput.value) {
      timeInput.reportValidity();
      return;
    }
    seasonDraft.rodadas = getEffectiveSeasonSchedules();
    if (legacy) {
      const formatted = formatSeasonDate(firstDate);
      seasonDraft.rodadas[division][0].partidas.forEach((match) => {
        match.data = formatted;
      });
    } else {
      fillSeasonCalendar(division, firstDate);
    }
    seasonDraft.rodadas[division][0].partidas.forEach((match) => {
      match.hora = timeInput.value;
    });
    modal.remove();
    details.open = true;
    updateSeasonScheduleInputs(division);
    getPage()?.querySelector("[data-season-editor]")?.classList.add("is-dirty");
  });
}

function showSeasonStartDateError(startModal, dateInput) {
  startModal.style.display = "none";
  const errorModal = document.createElement("div");
  errorModal.className = "admin-modal-backdrop";
  errorModal.innerHTML = `<div class="admin-modal" role="alertdialog" aria-modal="true">
    <i class="bi bi-exclamation-triangle"></i>
    <h2>Data inicial inválida</h2>
    <p>Informe uma data válida para a primeira rodada.</p>
    <button class="btn" type="button">Entendi</button>
  </div>`;
  document.body.appendChild(errorModal);
  errorModal.querySelector("button").addEventListener("click", () => {
    errorModal.remove();
    startModal.style.display = "";
    dateInput.focus();
  });
}

function updateSeasonScheduleField(event) {
  const input = event.currentTarget;
  seasonDraft.rodadas = getEffectiveSeasonSchedules();
  const match = seasonDraft.rodadas[input.dataset.division]
    ?.[Number(input.dataset.roundIndex)]
    ?.partidas[Number(input.dataset.matchIndex)];
  if (!match) return;
  const field = input.dataset.seasonScheduleField;
  const matchElement = input.closest(".admin-season-match-preview");
  if (["placar1", "placar2"].includes(field) && ["WO", "WO2"].includes(input.value)) {
    const loserIsFirst = field === "placar1";
    if (input.value === "WO2") {
      match.placar1 = "0";
      match.placar2 = "0";
      match.observacao = "W.O.: ambos abandonaram a competição";
    } else {
      match.placar1 = loserIsFirst ? "0" : "2";
      match.placar2 = loserIsFirst ? "2" : "0";
      match.observacao = `W.O.: ${getSeasonPlayerName(input.dataset.division, loserIsFirst ? match.numero1 : match.numero2)}`;
    }
    const scoreInputs = matchElement?.querySelectorAll('.admin-season-history-score select') || [];
    if (scoreInputs[0]) scoreInputs[0].value = match.placar1;
    if (scoreInputs[1]) scoreInputs[1].value = match.placar2;
  } else {
    match[field] = input.value;
    if (["placar1", "placar2"].includes(field) && /^W\.O\.:/i.test(match.observacao || "")) {
      match.observacao = "";
    }
  }
  const observation = matchElement?.querySelector("[data-season-history-observation]");
  if (observation) {
    observation.textContent = match.observacao || "";
    observation.hidden = !match.observacao;
  }
  if (field === "status" && input.value === "A") {
    match.placar1 = "-";
    match.placar2 = "-";
    renderSeasonEditor();
  }
  updateSeasonRoundControls(input.dataset.division, Number(input.dataset.roundIndex));
  getPage()?.querySelector("[data-season-editor]")?.classList.toggle("is-dirty", isSeasonDirty());
}

function updateSeasonRoundField(event) {
  const input = event.currentTarget;
  const division = input.dataset.division;
  const roundIndex = Number(input.dataset.roundIndex);
  const field = input.dataset.seasonRoundField;
  seasonDraft.rodadas = getEffectiveSeasonSchedules();
  const rounds = seasonDraft.rodadas[division];
  const round = rounds?.[roundIndex];
  if (!round) return;

  if (seasonDraft.modo !== "LEGADA" && field === "data" && roundIndex === 0 && input.value) {
    const firstDate = parseSeasonDate(input.value);
    if (!firstDate) {
      input.value = getCommonSeasonRoundValue(round, "data");
      showAdminModal(
        "Data inicial inválida",
        "Informe uma data válida para a primeira rodada.",
        "error",
      );
      return;
    }
    fillSeasonCalendar(division, firstDate);
    updateSeasonScheduleInputs(division);
  } else {
    round.partidas.forEach((match) => {
      match[field] = input.value || (field === "hora" ? "19:00" : "");
    });
    updateSeasonScheduleInputs(division, roundIndex);
  }
  getPage()?.querySelector("[data-season-editor]")?.classList.toggle("is-dirty", isSeasonDirty());
}

function fillSeasonCalendar(division, firstDate) {
  let date = new Date(firstDate);
  seasonDraft.rodadas[division].forEach((round, index) => {
    if (index > 0) date = getNextSeasonTuesdayOrThursday(date);
    const formatted = formatSeasonDate(date);
    round.partidas.forEach((match) => {
      match.data = formatted;
      match.hora = match.hora || "19:00";
    });
  });
}

function getNextSeasonTuesdayOrThursday(informedDate) {
  const date = new Date(informedDate);
  do {
    date.setDate(date.getDate() + 1);
  } while (![2, 4].includes(date.getDay()));
  return date;
}

function parseSeasonDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatSeasonDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function updateSeasonScheduleInputs(division, onlyRoundIndex = null) {
  const editor = getPage()?.querySelector("[data-season-editor]");
  if (!editor) return;
  const rounds = seasonDraft.rodadas[division];
  rounds.forEach((round, roundIndex) => {
    if (onlyRoundIndex !== null && roundIndex !== onlyRoundIndex) return;
    ["data", "hora"].forEach((field) => {
      const roundInput = editor.querySelector(`[data-season-round-field="${field}"][data-division="${division}"][data-round-index="${roundIndex}"]`);
      if (roundInput) roundInput.value = getCommonSeasonRoundValue(round, field);
    });
    round.partidas.forEach((match, matchIndex) => {
      ["data", "hora"].forEach((field) => {
        const matchInput = editor.querySelector(`[data-season-schedule-field="${field}"][data-division="${division}"][data-round-index="${roundIndex}"][data-match-index="${matchIndex}"]`);
        if (matchInput) matchInput.value = match[field] || (field === "hora" ? "19:00" : "");
      });
    });
  });
}

function updateSeasonRoundControls(division, roundIndex) {
  const round = seasonDraft.rodadas[division]?.[roundIndex];
  if (!round) return;
  ["data", "hora"].forEach((field) => {
    const input = getPage()?.querySelector(`[data-season-round-field="${field}"][data-division="${division}"][data-round-index="${roundIndex}"]`);
    if (input) input.value = getCommonSeasonRoundValue(round, field);
  });
}

function enableSeasonSchedulePickers(container) {
  container.querySelectorAll('input[type="date"], input[type="time"]').forEach((input) => {
    input.addEventListener("click", () => {
      if (!input.disabled && typeof input.showPicker === "function") {
        try {
          input.showPicker();
        } catch (error) {
          // Alguns navegadores já abrem o seletor no clique nativo.
        }
      }
    });
  });
}

function buildSeasonSchedules(participants) {
  return Object.fromEntries(["A", "B"].map((division) => {
    const numbers = participants[division].map((_, index) => index + 1);
    return [division, buildDivisionSchedule(numbers, division === "B")];
  }));
}

function getEffectiveSeasonSchedules() {
  const schedules = seasonDraft.rodadas;
  if (Array.isArray(schedules?.A) && Array.isArray(schedules?.B)) return schedules;
  return buildSeasonSchedules(seasonDraft.participantes);
}

function buildDivisionSchedule(orderedNumbers, standardizeByes = false) {
    const rotation = orderedNumbers.length % 2 === 0
      ? [...orderedNumbers]
      : [...orderedNumbers, null];
    const rounds = [];
    let current = [...rotation];
    for (let roundIndex = 0; roundIndex < current.length - 1; roundIndex += 1) {
      const matches = [];
      for (let index = 0; index < current.length / 2; index += 1) {
        let number1 = current[index];
        let number2 = current[current.length - 1 - index];
        if (number1 === null || number2 === null) continue;
        if ((roundIndex + index) % 2 === 1) [number1, number2] = [number2, number1];
        matches.push({
          numero1: number1,
          numero2: number2,
          data: "",
          hora: "19:00",
        });
      }
      const used = new Set(matches.flatMap((match) => [match.numero1, match.numero2]));
      const folga = orderedNumbers.find((number) => !used.has(number)) || null;
      rounds.push({ rodada: roundIndex + 1, tipo: "REGULAR", folga, partidas: matches });
      current = [current[0], current[current.length - 1], ...current.slice(1, -1)];
    }
    if (!standardizeByes || orderedNumbers.length % 2 === 0) return rounds;
    const byBye = new Map(rounds.map((round) => [Number(round.folga), round]));
    return [...orderedNumbers]
      .sort((a, b) => a - b)
      .map((number, index) => ({
        ...byBye.get(number),
        rodada: index + 1,
        folga: number,
      }));
}

function previewSeasonDraw(division) {
  syncSeasonDraftFromEditor();
  const numbers = seasonDraft.participantes[division].map((_, index) => index + 1);
  const currentSignature = getScheduleSignature(getEffectiveSeasonSchedules()[division]);
  const hasScheduledMatches = getEffectiveSeasonSchedules()[division].some((round) =>
    round.partidas.some((match) => match.data || (match.hora && match.hora !== "19:00")),
  );
  let suggestion = null;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    suggestion = buildDivisionSchedule(
      shuffleSeasonNumbers(numbers),
      division === "B",
    );
    if (getScheduleSignature(suggestion) !== currentSignature) break;
  }
  const modal = document.createElement("div");
  modal.className = "admin-modal-backdrop";
  modal.innerHTML = `<div class="admin-modal admin-draw-modal" role="dialog" aria-modal="true">
    <i class="bi bi-shuffle"></i>
    <h2>Sugestão para a Série ${division}</h2>
    <p>Confira o sorteio antes de aplicá-lo ao rascunho.${hasScheduledMatches ? " As datas e os horários personalizados desta série serão removidos." : ""}</p>
    <div class="admin-draw-preview">${suggestion.map((round) => `
      <section><h3>Rodada ${round.rodada}</h3>${round.partidas.map((match) => `<p><span>${escapeHtml(getSeasonPlayerName(division, match.numero1))}</span><b>×</b><span>${escapeHtml(getSeasonPlayerName(division, match.numero2))}</span></p>`).join("")}${round.folga ? `<small class="admin-season-bye"><i class="bi bi-pause-circle"></i> Folga: ${escapeHtml(getSeasonPlayerName(division, round.folga))}</small>` : ""}</section>`).join("")}</div>
    <div class="admin-modal-actions"><button class="btn btn-admin-secondary" type="button" data-cancel>Cancelar</button><button class="btn" type="button" data-apply>Aplicar sugestão</button></div>
  </div>`;
  document.querySelector(".admin-modal-backdrop")?.remove();
  document.body.appendChild(modal);
  modal.querySelector("[data-cancel]").addEventListener("click", () => modal.remove());
  modal.querySelector("[data-apply]").addEventListener("click", () => {
    seasonDraft.rodadas = getEffectiveSeasonSchedules();
    seasonDraft.rodadas[division] = suggestion;
    modal.remove();
    renderSeasonEditor();
    getPage()?.querySelector("[data-season-editor]")?.classList.add("is-dirty");
  });
}

function getScheduleSignature(rounds) {
  return JSON.stringify((rounds || []).map((round) =>
    round.partidas.map((match) => [Number(match.numero1), Number(match.numero2)]),
  ));
}

function shuffleSeasonNumbers(numbers) {
  const shuffled = [...numbers];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomValues = new Uint32Array(1);
    crypto.getRandomValues(randomValues);
    const target = randomValues[0] % (index + 1);
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

function getSeasonPlayerName(division, number) {
  const participant = seasonDraft.participantes[division][number - 1];
  const player = (seasonDraft.jogadores || []).find(
    (item) => Number(item.id) === Number(participant?.jogador_id),
  );
  return player?.exibicao || `Nº ${number}`;
}

function isSeasonDirty() {
  if (!seasonDraft) return false;
  if (!savedSeasonDraft) return true;
  const comparable = (draft) => ({
    participantes: ["A", "B"].map((division) =>
      draft.participantes[division].map((item) => [
        Number(item.jogador_id),
        Number(item.desempate) || null,
        Boolean(item.wo_direto),
      ]),
    ),
    rodadas: ["A", "B"].map((division) =>
      (draft.rodadas?.[division] || []).map((round) =>
        [
          Number(round.folga) || null,
          ...round.partidas.map((match) => [
            Number(match.numero1),
            Number(match.numero2),
            match.data || "",
            match.hora || "",
            match.status || "A",
            String(match.placar1 ?? "-"),
            String(match.placar2 ?? "-"),
            match.observacao || "",
          ]),
        ],
      ),
    ),
  });
  return JSON.stringify(comparable(seasonDraft)) !== JSON.stringify(comparable(savedSeasonDraft));
}

function addSeasonPlayer() {
  const used = new Set([...seasonDraft.participantes.A, ...seasonDraft.participantes.B].map((item) => Number(item.jogador_id)));
  const player = seasonDraft.jogadores.find((item) => !used.has(Number(item.id)));
  if (!player) return showAdminModal("Sem jogadores disponíveis", "Cadastre outro jogador antes de adicionar uma nova vaga.", "error");
  seasonDraft.participantes.B.push({ divisao: "B", numero: seasonDraft.participantes.B.length + 1, jogador_id: player.id, desempate: null, wo_direto: false });
  seasonDraft.rodadas = getEffectiveSeasonSchedules();
  seasonDraft.rodadas.B = buildDivisionSchedule(
    seasonDraft.participantes.B.map((_, index) => index + 1),
    true,
  );
  renderSeasonEditor();
  getPage()?.querySelector("[data-season-editor]")?.classList.add("is-dirty");
}

function removeSeasonPlayer(event) {
  if (seasonDraft.modo !== "LEGADA" && seasonDraft.participantes.B.length <= 2) return showAdminModal("Mínimo de participantes", "A Série B deve possuir ao menos 2 participantes.", "error");
  const row = event.currentTarget.closest("[data-season-participant]");
  const rows = [...row.parentElement.children];
  seasonDraft.participantes.B.splice(rows.indexOf(row), 1);
  seasonDraft.rodadas = getEffectiveSeasonSchedules();
  seasonDraft.rodadas.B = buildDivisionSchedule(
    seasonDraft.participantes.B.map((_, index) => index + 1),
    true,
  );
  renderSeasonEditor();
  getPage()?.querySelector("[data-season-editor]")?.classList.add("is-dirty");
}

async function cancelSeasonChanges() {
  if (isSeasonDirty()) {
    const confirmed = await confirmAdminChange("Descartar alterações?", "Todas as alterações não salvas desta temporada serão perdidas.");
    if (!confirmed) return;
  }
  if (savedSeasonDraft) {
    seasonDraft = structuredClone(savedSeasonDraft);
    renderSeasonEditor();
  } else {
    closeSeasonEditor();
  }
}

async function saveSeasonChanges() {
  syncSeasonDraftFromEditor();
  const ids = [...seasonDraft.participantes.A, ...seasonDraft.participantes.B].map((item) => item.jogador_id);
  if (new Set(ids).size !== ids.length) return showAdminModal("Jogador duplicado", "Cada jogador pode ocupar somente uma vaga na temporada.", "error");
  const legacy = seasonDraft.modo === "LEGADA";
  const publishedLegacy = legacy && seasonDraft.status === "ARQUIVADA";
  const confirmed = await confirmAdminChange(
    publishedLegacy ? "Salvar alterações no Histórico?" : legacy ? "Salvar rascunho histórico?" : "Salvar preparação?",
    publishedLegacy
      ? `A temporada ${seasonDraft.temporada} continuará publicada e o Histórico será atualizado com estes dados.`
      : legacy
      ? `O cadastro de ${seasonDraft.temporada} será salvo como rascunho e ainda não aparecerá no Histórico.`
      : `A temporada ${seasonDraft.temporada} será salva sem alterar a temporada atual.`,
  );
  if (!confirmed) return;
  try {
    const savedYear = seasonDraft.temporada;
    const save = legacy ? saveAdminTemporadaLegada : saveAdminTemporada;
    const data = await save(
      activeAdminSession.token,
      seasonDraft.temporada,
      seasonDraft.participantes,
      getEffectiveSeasonSchedules(),
    );
    setSeasonDraft(data);
    await loadAdminSeasons();
    showAdminModal(
      publishedLegacy ? "Temporada histórica atualizada" : legacy ? "Rascunho histórico salvo" : "Temporada salva",
      publishedLegacy
        ? `As alterações de ${savedYear} foram salvas e já estão disponíveis no Histórico.`
        : legacy
        ? `O cadastro de ${savedYear} foi salvo e ainda não está publicado no Histórico.`
        : "A preparação foi salva e poderá ser retomada em outra sessão.",
      "success",
    );
  } catch (error) {
    showAdminModal("Não foi possível salvar", error.message, "error");
  }
}

async function deleteSeasonDraft() {
  const confirmed = await confirmAdminChange("Excluir temporada?", `Todos os dados preparados para ${seasonDraft.temporada} serão apagados. Esta ação não pode ser desfeita.`);
  if (!confirmed) return;
  try {
    await deleteAdminTemporada(activeAdminSession.token, seasonDraft.temporada);
    closeSeasonEditor();
    await loadAdminSeasons();
    showAdminModal("Temporada excluída", "A preparação e seus vínculos foram removidos.", "success");
  } catch (error) {
    showAdminModal("Não foi possível excluir", error.message, "error");
  }
}

async function activateSeasonDraft() {
  if (isSeasonDirty()) {
    const legacy = seasonDraft.modo === "LEGADA";
    showAdminModal(
      "Existem alterações não salvas",
      `Salve ou cancele as alterações antes de ${legacy ? "publicar" : "ativar"} esta temporada.`,
      "error",
    );
    return;
  }
  const legacy = seasonDraft.modo === "LEGADA";
  const confirmed = await confirmAdminChange(
    legacy ? "Publicar temporada passada?" : "Ativar nova temporada?",
    legacy
      ? `A temporada ${seasonDraft.temporada} será publicada no Histórico. A temporada atual não será alterada.`
      : `A temporada ${seasonDraft.temporada} substituirá a temporada atual. Participantes, rodadas e jogadores ativos serão atualizados. Esta ação não poderá ser desfeita.`,
  );
  if (!confirmed) return;

  const button = getPage()?.querySelector("[data-activate-season]");
  if (button) {
    button.disabled = true;
    button.innerHTML = `<span class="loading-spinner loading-spinner-inline" aria-hidden="true"></span> ${legacy ? "Publicando..." : "Ativando..."}`;
  }
  try {
    const temporada = seasonDraft.temporada;
    const activation = legacy
      ? await publishAdminTemporadaLegada(activeAdminSession.token, temporada)
      : await activateAdminTemporada(activeAdminSession.token, temporada);
    if (!legacy) setKnownCurrentSeason(activation.temporada_atual || temporada);
    temporaryActivePlayers = new Map();
    closeSeasonEditor();
    const page = getPage();
    if (page) {
      page.querySelector("[data-admin-participants]").dataset.loaded = "";
      page.querySelector("[data-admin-players]").dataset.loaded = "";
    }
    await loadAdminSeasons();
    showAdminModal(
      legacy ? "Temporada publicada" : "Temporada ativada",
      legacy
        ? `A temporada ${temporada} agora está disponível no Histórico.`
        : `A temporada ${temporada} agora é a temporada atual do campeonato.`,
      "success",
    );
  } catch (error) {
    showAdminModal(legacy ? "Não foi possível publicar" : "Não foi possível ativar", error.message, "error");
    if (button?.isConnected) {
      button.disabled = false;
      button.textContent = legacy ? "Publicar" : "Ativar temporada";
    }
  }
}

function closeSeasonEditor() {
  seasonDraft = null;
  savedSeasonDraft = null;
  const editor = getPage()?.querySelector("[data-season-editor]");
  if (editor) { editor.hidden = true; editor.innerHTML = ""; }
  const create = getPage()?.querySelector("[data-create-season]");
  if (create) {
    create.innerHTML = CREATE_SEASON_BUTTON_HTML;
    create.disabled = false;
  }
  const createLegacy = getPage()?.querySelector("[data-create-legacy-season]");
  if (createLegacy) createLegacy.disabled = false;
}

function refreshSeasonDraftPlayers(players) {
  if (!seasonDraft || !Array.isArray(players)) return;

  seasonDraft.jogadores = players.map((player) => ({ ...player }));
  if (savedSeasonDraft) {
    savedSeasonDraft.jogadores = players.map((player) => ({ ...player }));
  }

  renderSeasonEditor();
  getPage()
    ?.querySelector("[data-season-editor]")
    ?.classList.toggle("is-dirty", isSeasonDirty());
}

async function loadAdminParticipants(divisao) {
  const content = getPage()?.querySelector("[data-admin-participants]");
  if (!content || !activeAdminSession?.token) return;
  content.dataset.loaded = "";
  content.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Carregando participantes...</p></div>';
  try {
    const data = await getAdminParticipantes(activeAdminSession.token, divisao);
    if (!content.isConnected) return;
    const jogadoresDisponiveis = [...data.jogadores];
    temporaryActivePlayers.forEach((jogador, id) => {
      if (!jogadoresDisponiveis.some((item) => item.id === id)) {
        jogadoresDisponiveis.push({ ...jogador, ativo: true });
      }
    });
    content.innerHTML = data.participantes.map((participante) => renderParticipantRow(participante, jogadoresDisponiveis)).join("");
    content.dataset.loaded = "true";
    bindParticipantEvents();
    updateParticipantPendingCount();
  } catch (error) {
    if (content.isConnected) {
      const message = /ação inválida/i.test(error.message)
        ? "A versão publicada do Apps Script ainda não possui a gestão de participantes. Publique uma nova versão da implantação e tente novamente."
        : error.message;
      content.innerHTML = `<div class="error-state"><i class="bi bi-exclamation-circle"></i><p>${escapeHtml(message)}</p></div>`;
    }
  }
}

async function handleParticipantDivisionChange(event) {
  const select = event.currentTarget;
  const previous = select.dataset.previousValue || "A";
  const pending = getPage()?.querySelectorAll("[data-participant-row].is-dirty").length || 0;
  if (pending) {
    const confirmed = await confirmAdminChange("Descartar alterações?", "Ao trocar de divisão, as alterações de participantes ainda não salvas serão descartadas.");
    if (!confirmed) { select.value = previous; return; }
  }
  select.dataset.previousValue = select.value;
  loadAdminParticipants(select.value);
}

function renderParticipantRow(participante, jogadores) {
  const options = jogadores
    .slice()
    .sort((a, b) => a.exibicao.localeCompare(b.exibicao, "pt-BR"))
    .map((jogador) => `<option value="${jogador.id}" data-player-search="${escapeHtml([jogador.nome, jogador.exibicao, jogador.apelido].filter(Boolean).join(" "))}" ${jogador.id === participante.jogador_id ? "selected" : ""}>${escapeHtml(jogador.exibicao)}${jogador.ativo ? "" : " (inativo)"}</option>`)
    .join("");
  const desempate = participante.desempate || "";
  const woDireto = Boolean(participante.wo_direto);
  return `<article class="admin-participant-row has-tiebreak" data-participant-row data-number="${participante.numero}">
    <span class="admin-participant-number">${participante.numero}</span>
    <label><span>Jogador</span><select class="admin-select" data-participant-select data-original-player="${participante.jogador_id}" ${adminEditMode ? "" : "disabled"}>${options}</select></label>
    <label class="admin-participant-tiebreak"><span>Desempate</span><input class="admin-input" type="number" min="1" step="1" inputmode="numeric" value="${desempate}" data-participant-tiebreak data-original-tiebreak="${desempate}" aria-label="Prioridade de desempate do participante ${participante.numero}" ${adminEditMode ? "" : "disabled"}></label>
    <label class="admin-participant-wo" title="Não contabilizar pontos desta temporada no Ranking"><input type="checkbox" data-participant-wo data-original-wo="${woDireto}" ${woDireto ? "checked" : ""} ${adminEditMode ? "" : "disabled"}><span>W.O.</span></label>
  </article>`;
}

function bindParticipantEvents() {
  getPage()?.querySelectorAll("[data-participant-select]").forEach((select) => {
    select.addEventListener("change", () => updateParticipantDirtyState(select.closest("[data-participant-row]")));
    enhanceSearchablePlayerSelect(select);
  });
  getPage()?.querySelectorAll("[data-participant-tiebreak]").forEach((input) => {
    input.addEventListener("input", () => updateParticipantDirtyState(input.closest("[data-participant-row]")));
  });
  getPage()?.querySelectorAll("[data-participant-wo]").forEach((input) => {
    input.addEventListener("change", () => updateParticipantDirtyState(input.closest("[data-participant-row]")));
  });
}

function enhanceSearchablePlayerSelect(select) {
  if (!select || select.dataset.searchableEnhanced === "true") return;
  select.dataset.searchableEnhanced = "true";
  select.classList.add("admin-search-select-native");

  const combobox = document.createElement("div");
  combobox.className = "admin-player-combobox";
  combobox.innerHTML = `
    <div class="admin-player-combobox-control">
      <i class="bi bi-search" aria-hidden="true"></i>
      <input type="search" autocomplete="off" aria-label="Pesquisar e selecionar jogador">
      <i class="bi bi-chevron-down admin-player-combobox-chevron" aria-hidden="true"></i>
    </div>
    <div class="admin-player-combobox-menu" role="listbox" hidden></div>`;
  select.insertAdjacentElement("afterend", combobox);

  const input = combobox.querySelector("input");
  const menu = combobox.querySelector("[role='listbox']");
  const renderOptions = (query = "") => {
    const normalizedQuery = normalizePlayerSearch(query);
    const options = [...select.options].filter((option) =>
      !normalizedQuery || normalizePlayerSearch(option.dataset.playerSearch || option.textContent).includes(normalizedQuery)
    );
    menu.innerHTML = options.length
      ? options.map((option) => `<button type="button" role="option" data-player-option="${escapeHtml(option.value)}" aria-selected="${option.selected}">${escapeHtml(option.textContent)}</button>`).join("")
      : '<p class="admin-player-combobox-empty">Nenhum jogador encontrado.</p>';
    menu.querySelectorAll("[data-player-option]").forEach((button) => {
      button.addEventListener("click", () => {
        select.value = button.dataset.playerOption;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        input.value = select.options[select.selectedIndex]?.textContent || "";
        closeSearchablePlayerCombobox(combobox);
      });
    });
  };
  const open = () => {
    if (select.disabled) return;
    closeAllSearchablePlayerComboboxes(combobox);
    combobox.classList.add("is-open");
    menu.hidden = false;
    input.value = "";
    input.placeholder = "Digite para pesquisar...";
    renderOptions();
  };

  input.value = select.options[select.selectedIndex]?.textContent || "";
  input.disabled = select.disabled;
  input.addEventListener("focus", open);
  input.addEventListener("click", open);
  input.addEventListener("input", () => renderOptions(input.value));
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeSearchablePlayerCombobox(combobox);
      input.blur();
    }
  });
  select.addEventListener("change", () => {
    input.value = select.options[select.selectedIndex]?.textContent || "";
  });

  if (!searchablePlayerSelectsBound) {
    searchablePlayerSelectsBound = true;
    document.addEventListener("pointerdown", (event) => {
      if (!event.target.closest(".admin-player-combobox")) {
        closeAllSearchablePlayerComboboxes();
      }
    });
  }
}

function closeSearchablePlayerCombobox(combobox) {
  if (!combobox) return;
  const select = combobox.previousElementSibling;
  const input = combobox.querySelector("input");
  combobox.classList.remove("is-open");
  combobox.querySelector("[role='listbox']").hidden = true;
  input.placeholder = "";
  input.value = select?.options[select.selectedIndex]?.textContent || "";
}

function closeAllSearchablePlayerComboboxes(exception = null) {
  document.querySelectorAll(".admin-player-combobox.is-open").forEach((combobox) => {
    if (combobox !== exception) closeSearchablePlayerCombobox(combobox);
  });
}

function syncSearchablePlayerComboboxes(container = document) {
  container.querySelectorAll("select.admin-search-select-native").forEach((select) => {
    const combobox = select.nextElementSibling;
    const input = combobox?.querySelector("input");
    if (!input) return;
    input.disabled = select.disabled;
    input.value = select.options[select.selectedIndex]?.textContent || "";
    if (select.disabled) closeSearchablePlayerCombobox(combobox);
  });
}

function updateParticipantDirtyState(row) {
  if (!row) return;
  const select = row.querySelector("[data-participant-select]");
  const desempate = row.querySelector("[data-participant-tiebreak]");
  const wo = row.querySelector("[data-participant-wo]");
  row.classList.toggle("is-dirty", select.value !== select.dataset.originalPlayer ||
    desempate.value !== desempate.dataset.originalTiebreak ||
    wo.checked !== (wo.dataset.originalWo === "true"));
  updateParticipantPendingCount();
}

function updateParticipantPendingCount() {
  const page = getPage();
  const total = page?.querySelectorAll("[data-participant-row].is-dirty").length || 0;
  const label = page?.querySelector("[data-participant-pending]");
  const button = page?.querySelector("[data-save-participants]");
  if (label) label.textContent = total ? `${total} ${total === 1 ? "alteração pendente" : "alterações pendentes"}` : "Nenhuma alteração pendente";
  if (button) button.disabled = !adminEditMode || total === 0;
}

async function saveParticipantChanges() {
  const page = getPage();
  const rows = [...page.querySelectorAll("[data-participant-row].is-dirty")];
  if (!rows.length) return;
  const selectedPlayers = [...page.querySelectorAll("[data-participant-select]")].map((select) => select.value);
  if (selectedPlayers.some((id, index) => selectedPlayers.indexOf(id) !== index)) {
    return showAdminModal("Jogador duplicado", "Cada jogador pode ocupar somente um número na divisão.", "error");
  }
  const changes = rows.map((row) => ({
    numero: Number(row.dataset.number),
    jogador_id: Number(row.querySelector("[data-participant-select]").value),
    desempate: row.querySelector("[data-participant-tiebreak]").value,
    wo_direto: row.querySelector("[data-participant-wo]").checked,
  }));
  const summary = rows.map((row) => {
    const prioridade = row.querySelector("[data-participant-tiebreak]").value;
    const wo = row.querySelector("[data-participant-wo]").checked;
    return `Nº ${row.dataset.number}: ${row.querySelector("option:checked").textContent}${prioridade ? ` (desempate ${prioridade})` : ""}${wo ? " (W.O.)" : ""}`;
  }).join("; ");
  const activatesDirectWo = rows.some((row) => {
    const input = row.querySelector("[data-participant-wo]");
    return input.checked && input.dataset.originalWo !== "true";
  });
  const woWarning = activatesDirectWo
    ? " Os confrontos dos participantes marcados serão encerrados automaticamente como derrota por W.O.; se os dois estiverem marcados, o resultado será 0 × 0."
    : "";
  const confirmed = await confirmAdminChange("Salvar participantes?", `Confira as alterações: ${summary}.${woWarning}`);
  if (!confirmed) return;
  const button = page.querySelector("[data-save-participants]");
  button.disabled = true;
  try {
    const divisao = page.querySelector("[data-participant-division]").value;
    const ativarJogadores = changes
      .map((change) => change.jogador_id)
      .filter((id) => temporaryActivePlayers.has(id));
    await saveAdminParticipantes(activeAdminSession.token, divisao, changes, ativarJogadores);
    ativarJogadores.forEach((id) => temporaryActivePlayers.delete(id));
    const matchDivision = page.querySelector("[data-admin-division]").value;
    const refreshes = [
      loadAdminParticipants(divisao),
      loadAdminPlayers(),
    ];
    if (matchDivision === divisao) {
      refreshes.push(loadAdminMatches(matchDivision, true));
    }
    await Promise.all(refreshes);
    showAdminModal("Participantes salvos", "Os vínculos da temporada foram atualizados com sucesso.", "success");
  } catch (error) {
    updateParticipantPendingCount();
    showAdminModal("Não foi possível salvar", error.message, "error");
  }
}

async function loadAdminPlayers() {
  const content = getPage()?.querySelector("[data-admin-players]");
  if (!content || !activeAdminSession?.token) return;
  content.dataset.loaded = "";
  content.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Carregando jogadores...</p></div>';

  try {
    const data = await getAdminJogadores(activeAdminSession.token);
    if (!content.isConnected) return;
    const jogadores = data.jogadores.map((jogador) => (
      temporaryActivePlayers.has(jogador.id) ? { ...jogador, ativo: true } : jogador
    ));
    content.innerHTML = jogadores.map((jogador) => renderPlayerRow(jogador)).join("");
    content.dataset.loaded = "true";
    bindPlayerEvents(content);
    updatePlayerPendingCount();
    applyAdminPlayerFilters();
  } catch (error) {
    if (!content.isConnected) return;
    const message = /ação inválida/i.test(error.message)
      ? "A versão publicada do Apps Script ainda não possui a gestão de jogadores. Publique uma nova versão da implantação e tente novamente."
      : error.message;
    content.innerHTML = `<div class="error-state"><i class="bi bi-exclamation-circle"></i><p>${escapeHtml(message)}</p></div>`;
  }
}

function renderPlayerRow(jogador, novo = false) {
  const id = Number(jogador.id) || "";
  const nome = String(jogador.nome || "");
  const exibicao = String(jogador.exibicao || "");
  const apelido = String(jogador.apelido || "");
  const ativo = jogador.ativo !== false;
  const vinculo = jogador.participante_atual;
  const disabled = adminEditMode ? "" : "disabled";

  return `<article class="admin-player-row${novo ? " is-dirty is-new" : ""}" data-player-row data-player-id="${id}" data-player-active="${ativo ? "S" : "N"}" data-player-division="${vinculo?.divisao || "NONE"}" data-new="${novo}">
    <div class="admin-player-identity">
      <span class="admin-player-id">${id ? `#${id}` : "Novo"}</span>
      ${vinculo ? `<span class="admin-player-link">Série ${escapeHtml(vinculo.divisao)} · Nº ${vinculo.numero}</span>` : '<span class="admin-player-link">Sem vínculo atual</span>'}
    </div>
    <label><span>Nome completo</span><input class="admin-input" type="text" maxlength="80" value="${escapeHtml(nome)}" data-player-field="nome" data-original-value="${escapeHtml(nome)}" ${disabled}></label>
    <label><span>Nome de exibição</span><input class="admin-input" type="text" maxlength="80" value="${escapeHtml(exibicao)}" data-player-field="exibicao" data-original-value="${escapeHtml(exibicao)}" ${disabled}></label>
    <label><span>Apelido</span><input class="admin-input" type="text" maxlength="80" value="${escapeHtml(apelido)}" data-player-field="apelido" data-original-value="${escapeHtml(apelido)}" ${disabled}></label>
    <label><span>Situação</span><select class="admin-select" data-player-field="ativo" data-original-value="${ativo ? "S" : "N"}" ${disabled}><option value="S" ${ativo ? "selected" : ""}>Ativo</option><option value="N" ${ativo ? "" : "selected"}>Inativo</option></select></label>
  </article>`;
}

function bindPlayerEvents(container = getPage()) {
  const rows = container?.matches?.("[data-player-row]")
    ? [container]
    : [...(container?.querySelectorAll("[data-player-row]") || [])];
  rows.forEach((row) => {
    row.querySelectorAll("input, select").forEach((field) => {
      const handleChange = () => {
        updatePlayerDirtyState(row);
        applyAdminPlayerFilters();
      };
      field.addEventListener("input", handleChange);
      field.addEventListener("change", handleChange);
    });
  });
}

function addNewPlayerRow() {
  if (!adminEditMode) return;
  const page = getPage();
  const content = page?.querySelector("[data-admin-players]");
  if (!content) return;
  page.querySelector("[data-player-status-filter]").value = "";
  page.querySelector("[data-player-division-filter]").value = "";
  page.querySelector("[data-player-search-filter]").value = "";
  content.insertAdjacentHTML("afterbegin", renderPlayerRow({ ativo: false }, true));
  const row = content.firstElementChild;
  bindPlayerEvents(row);
  row.querySelector("input")?.focus();
  updatePlayerPendingCount();
  applyAdminPlayerFilters();
}

function applyAdminPlayerFilters() {
  const page = getPage();
  const status = page?.querySelector("[data-player-status-filter]")?.value || "";
  const division = page?.querySelector("[data-player-division-filter]")?.value || "";
  const search = normalizePlayerSearch(
    page?.querySelector("[data-player-search-filter]")?.value || "",
  );
  let visiblePlayers = 0;
  page?.querySelectorAll("[data-player-row]").forEach((row) => {
    const currentStatus = row.querySelector('[data-player-field="ativo"]')?.value || row.dataset.playerActive;
    const searchableNames = [...row.querySelectorAll('input[data-player-field]')]
      .map((input) => input.value)
      .join(" ");
    const visible = (
      (!status || currentStatus === status) &&
      (!division || row.dataset.playerDivision === division) &&
      (!search || normalizePlayerSearch(searchableNames).includes(search))
    );
    row.hidden = !visible;
    if (visible) visiblePlayers += 1;
  });
  const empty = page?.querySelector("[data-player-filter-empty]");
  if (empty) empty.hidden = visiblePlayers > 0;
}

function normalizePlayerSearch(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

function updatePlayerDirtyState(row) {
  if (!row) return;
  const dirty = row.dataset.new === "true" || [...row.querySelectorAll("input, select")]
    .some((field) => field.value.trim() !== String(field.dataset.originalValue || "").trim());
  row.classList.toggle("is-dirty", dirty);
  updatePlayerPendingCount();
}

function updatePlayerPendingCount() {
  const page = getPage();
  const total = page?.querySelectorAll("[data-player-row].is-dirty").length || 0;
  const label = page?.querySelector("[data-player-pending]");
  const button = page?.querySelector("[data-save-players]");
  if (label) label.textContent = total ? `${total} ${total === 1 ? "alteração pendente" : "alterações pendentes"}` : "Nenhuma alteração pendente";
  if (button) button.disabled = !adminEditMode || total === 0;
}

async function savePlayerChanges() {
  const page = getPage();
  const rows = [...page.querySelectorAll("[data-player-row].is-dirty")];
  if (!rows.length) return;

  const jogadores = rows.map((row) => ({
    id: Number(row.dataset.playerId) || null,
    nome: row.querySelector('[data-player-field="nome"]').value.trim(),
    exibicao: row.querySelector('[data-player-field="exibicao"]').value.trim(),
    apelido: row.querySelector('[data-player-field="apelido"]').value.trim(),
    ativo: row.querySelector('[data-player-field="ativo"]').value === "S",
  }));
  if (jogadores.some((jogador) => !jogador.nome)) {
    return showAdminModal("Nome obrigatório", "Informe ao menos o nome completo de todos os jogadores alterados.", "error");
  }

  jogadores.forEach((jogador) => {
    if (!jogador.exibicao) jogador.exibicao = jogador.nome;
    if (!jogador.apelido) jogador.apelido = jogador.exibicao;
  });
  const resumo = jogadores
    .map((jogador) => `${jogador.id ? `#${jogador.id}` : "Novo"}: ${jogador.exibicao} (${jogador.ativo ? "ativo" : "inativo"})`)
    .join("; ");
  const confirmed = await confirmAdminChange("Salvar jogadores?", `Confira as alterações: ${resumo}`);
  if (!confirmed) return;

  const button = page.querySelector("[data-save-players]");
  button.disabled = true;
  try {
    const result = await saveAdminJogadores(activeAdminSession.token, jogadores);
    const temporarios = new Set(result.ativacoes_temporarias || []);
    result.jogadores.forEach((jogador) => {
      if (temporarios.has(jogador.id)) {
        temporaryActivePlayers.set(jogador.id, { ...jogador, ativo: true });
      } else if (
        jogador.participante_atual ||
        jogadores.some((alterado) => alterado.id === jogador.id && !alterado.ativo)
      ) {
        temporaryActivePlayers.delete(jogador.id);
      }
    });
    refreshSeasonDraftPlayers(result.jogadores);
    const participantDivision = page.querySelector("[data-participant-division]").value;
    const matchDivision = page.querySelector("[data-admin-division]").value;
    await Promise.all([
      loadAdminPlayers(),
      loadAdminParticipants(participantDivision),
      loadAdminMatches(matchDivision, true),
    ]);
    showAdminModal("Jogadores salvos", "Os cadastros foram atualizados com sucesso.", "success");
  } catch (error) {
    updatePlayerPendingCount();
    showAdminModal("Não foi possível salvar", error.message, "error");
  }
}

async function loadAdminMatches(divisao, preserveFilters = true) {
  const page = getPage();
  const content = page?.querySelector("[data-admin-matches]");
  if (!content || !activeAdminSession?.token) return;
  const previousRound = preserveFilters ? page.querySelector("[data-admin-round-filter]")?.value || "" : "";
  const previousPlayer = preserveFilters ? page.querySelector("[data-admin-player-filter]")?.value || "" : "";
  content.innerHTML = '<div class="loading-state"><div class="loading-spinner"></div><p>Carregando partidas...</p></div>';
  try {
    const rodadas = await getAdminPartidas(activeAdminSession.token, divisao);
    if (!content.isConnected) return;
    populateAdminMatchFilters(rodadas, previousRound, previousPlayer);
    content.innerHTML = rodadas.map(renderAdminRound).join("");
    enableSeasonSchedulePickers(content);
    bindAdminMatchEvents(divisao);
    applyAdminMatchFilters();
  } catch (error) {
    if (content.isConnected) content.innerHTML = `<div class="error-state"><i class="bi bi-exclamation-circle"></i><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function renderAdminRound(rodada) {
  const data = toAdminDateInputValue(rodada.data);
  return `<section class="admin-round" data-admin-round="${rodada.rodada}">
    <div class="admin-round-heading"><h3>Rodada ${rodada.rodada}</h3><div class="admin-round-date-controls"><label><span>Data da rodada</span><input class="admin-input" type="date" value="${data}" data-round-date data-original-date="${data}" ${adminEditMode ? "" : "disabled"}></label><button class="btn btn-admin-save" type="button" data-save-round-date disabled>Salvar data</button></div></div>
    ${rodada.partidas.map(renderAdminMatch).join("")}
  </section>`;
}

function toAdminDateInputValue(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function populateAdminMatchFilters(rodadas, selectedRound = "", selectedPlayer = "") {
  const page = getPage();
  const roundFilter = page?.querySelector("[data-admin-round-filter]");
  const playerFilter = page?.querySelector("[data-admin-player-filter]");
  if (!roundFilter || !playerFilter) return;

  const rounds = [...new Set(rodadas.map((rodada) => String(rodada.rodada)))];
  const players = new Map();
  rodadas.forEach((rodada) => rodada.partidas.forEach((partida) => {
    players.set(String(partida.jogador1.numero), partida.jogador1.exibicao);
    players.set(String(partida.jogador2.numero), partida.jogador2.exibicao);
  }));

  roundFilter.innerHTML = '<option value="">Todas as rodadas</option>' + rounds
    .map((round) => `<option value="${round}">Rodada ${round}</option>`)
    .join("");
  playerFilter.innerHTML = '<option value="">Todos os jogadores</option>' + [...players.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
    .map(([number, name]) => `<option value="${number}">${escapeHtml(name)}</option>`)
    .join("");

  if (rounds.includes(selectedRound)) roundFilter.value = selectedRound;
  if (players.has(selectedPlayer)) playerFilter.value = selectedPlayer;
}

function applyAdminMatchFilters() {
  const page = getPage();
  const selectedRound = page?.querySelector("[data-admin-round-filter]")?.value || "";
  const selectedPlayer = page?.querySelector("[data-admin-player-filter]")?.value || "";

  page?.querySelectorAll("[data-admin-round]").forEach((round) => {
    let visibleMatches = 0;
    round.querySelectorAll("[data-admin-match]").forEach((match) => {
      const matchesRound = !selectedRound || match.dataset.round === selectedRound;
      const matchesPlayer = !selectedPlayer || match.dataset.player1 === selectedPlayer || match.dataset.player2 === selectedPlayer;
      match.hidden = !(matchesRound && matchesPlayer);
      if (!match.hidden) visibleMatches += 1;
    });
    round.hidden = visibleMatches === 0;
  });
}

function renderAdminMatch(partida) {
  const observation = partida.observacao?.texto || "";
  return `<article class="admin-match" data-admin-match data-round="${partida.rodada}" data-player1="${partida.jogador1.numero}" data-player2="${partida.jogador2.numero}" data-original-status="${partida.status.codigo}" data-original-score1="${partida.placar1}" data-original-score2="${partida.placar2}" data-original-observation="${escapeHtml(observation)}" data-wo-loser="" data-wo-both="">
    <div class="admin-match-players"><strong>${escapeHtml(partida.jogador1.exibicao)}</strong><span>×</span><strong>${escapeHtml(partida.jogador2.exibicao)}</strong></div>
    <div class="admin-match-controls"><select class="admin-select" data-match-status ${adminEditMode ? "" : "disabled"}>${statusOption("A", "Agendada", partida.status.codigo)}${statusOption("V", "Ao vivo", partida.status.codigo)}${statusOption("E", "Encerrada", partida.status.codigo)}</select><div class="admin-score-pair">${scoreSelect(partida.placar1)}<span>×</span>${scoreSelect(partida.placar2)}</div><button class="btn btn-admin-save" type="button" data-save-match ${adminEditMode ? "" : "disabled"}>Salvar</button></div>
    <small class="admin-match-observation" data-match-observation ${observation ? "" : "hidden"}>${escapeHtml(observation)}</small>
  </article>`;
}

function statusOption(value, label, selected) {
  return `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`;
}

function scoreSelect(value) {
  const normalized = value === "-" ? "" : String(value);
  return `<select class="admin-select admin-score" data-match-score ${adminEditMode ? "" : "disabled"}><option value="" ${normalized === "" ? "selected" : ""}>-</option>${[0, 1, 2].map((score) => `<option value="${score}" ${normalized === String(score) ? "selected" : ""}>${score}</option>`).join("")}<option value="WO">W.O.</option><option value="WO2">W.O. 2</option></select>`;
}

function setAdminMatchObservation(card, value) {
  const observation = card.querySelector("[data-match-observation]");
  if (!observation) return;
  observation.textContent = value;
  observation.hidden = !value;
}

function bindAdminMatchEvents(divisao) {
  getPage()?.querySelectorAll("[data-admin-round]").forEach((round) => {
    const input = round.querySelector("[data-round-date]");
    input?.addEventListener("change", () => updateRoundDateDirtyState(round));
    round.querySelector("[data-save-round-date]")?.addEventListener("click", () => saveRoundDate(round, divisao));
  });
  getPage()?.querySelectorAll("[data-admin-match]").forEach((card) => {
    const status = card.querySelector("[data-match-status]");
    const scores = [...card.querySelectorAll("[data-match-score]")];
    status.dataset.previousStatus = status.value;
    status?.addEventListener("change", async () => {
      const previous = status.dataset.previousStatus;
      const next = status.value;

      if (next === "A") {
        const confirmed = await confirmAdminChange(
          "Voltar para Agendada?",
          "O placar atual será apagado e a partida voltará para – × –.",
        );
        if (!confirmed) { status.value = previous; return; }
        scores.forEach((score) => { score.value = ""; score.disabled = false; });
        card.dataset.woLoser = "";
        card.dataset.woBoth = "";
        if (/^W\.O\.:/i.test(card.querySelector("[data-match-observation]")?.textContent || "")) {
          setAdminMatchObservation(card, "");
        }
      } else {
        scores.forEach((score) => { score.disabled = false; });
        if (previous === "A" && scores.every((score) => score.value === "")) {
          scores.forEach((score) => { score.value = "0"; });
        }
        if (next === "V" && previous === "E" && scores.some((score) => score.value === "2")) {
          const confirmed = await confirmAdminChange(
            "Reabrir como Ao vivo?",
            "A partida será reaberta, mas você deverá corrigir qualquer placar 2 para 0 ou 1 antes de salvar.",
          );
          if (!confirmed) { status.value = previous; return; }
        }
      }
      status.dataset.previousStatus = next;
      updateCardDirtyState(card);
    });
    scores.forEach((score, scoreIndex) => score.addEventListener("change", () => {
      if (score.value === "WO2") {
        scores.forEach((item) => { item.value = "0"; });
        card.dataset.woLoser = "";
        card.dataset.woBoth = "true";
        setAdminMatchObservation(card, "W.O.: ambos abandonaram a competição");
        status.value = "E";
        status.dataset.previousStatus = "E";
        updateCardDirtyState(card);
        return;
      }
      if (score.value === "WO") {
        const loserName = card.querySelectorAll(".admin-match-players strong")[scoreIndex]?.textContent.trim() || "Jogador";
        scores[scoreIndex].value = "0";
        scores[scoreIndex === 0 ? 1 : 0].value = "2";
        card.dataset.woLoser = scoreIndex === 0 ? card.dataset.player1 : card.dataset.player2;
        card.dataset.woBoth = "";
        setAdminMatchObservation(card, `W.O.: ${loserName}`);
        status.value = "E";
        status.dataset.previousStatus = "E";
        updateCardDirtyState(card);
        return;
      }
      if (card.dataset.woLoser || card.dataset.woBoth || /^W\.O\.:/i.test(card.querySelector("[data-match-observation]")?.textContent || "")) {
        card.dataset.woLoser = "";
        card.dataset.woBoth = "";
        setAdminMatchObservation(card, "");
      }
      if (scores.some((item) => item.value === "2")) {
        status.value = "E";
        status.dataset.previousStatus = "E";
      } else if (status.value === "A" && scores.some((item) => item.value !== "")) {
        status.value = "V";
        status.dataset.previousStatus = "V";
      }
      updateCardDirtyState(card);
    }));
    card.querySelector("[data-save-match]")?.addEventListener("click", () => requestSaveCards(card, divisao));
  });
}

function updateRoundDateDirtyState(round) {
  if (!round) return;
  const input = round.querySelector("[data-round-date]");
  const button = round.querySelector("[data-save-round-date]");
  const dirty = input.value !== input.dataset.originalDate;
  round.classList.toggle("has-date-change", dirty);
  if (button) button.disabled = !adminEditMode || !dirty || !input.value;
  updateAdminMatchPendingState();
}

async function saveRoundDate(round, divisao) {
  const input = round.querySelector("[data-round-date]");
  if (!input.value) return showAdminModal("Data obrigatória", "Informe a nova data da rodada.", "error");
  const rodada = Number(round.dataset.adminRound);
  const confirmed = await confirmAdminChange("Alterar data da rodada?", `Todas as partidas da Rodada ${rodada} serão transferidas para a data informada.`);
  if (!confirmed) return;
  const button = round.querySelector("[data-save-round-date]");
  button.disabled = true;
  try {
    const result = await saveAdminRoundDate(activeAdminSession.token, divisao, rodada, input.value);
    input.value = input.dataset.originalDate = result.data;
    updateRoundDateDirtyState(round);
    showAdminModal("Data atualizada", `A data da Rodada ${rodada} foi alterada com sucesso.`, "success");
  } catch (error) {
    updateRoundDateDirtyState(round);
    showAdminModal("Não foi possível alterar", error.message, "error");
  }
}

function updateCardDirtyState(card) {
  const status = card.querySelector("[data-match-status]").value;
  const scores = [...card.querySelectorAll("[data-match-score]")].map((item) => item.value || "-");
  const observation = card.querySelector("[data-match-observation]")?.textContent || "";
  const dirty = status !== card.dataset.originalStatus || scores[0] !== card.dataset.originalScore1 || scores[1] !== card.dataset.originalScore2 || observation !== card.dataset.originalObservation;
  card.classList.toggle("is-dirty", dirty);
  updateAdminMatchPendingState();
}

function updateAdminMatchPendingState() {
  const page = getPage();
  const pendingMatches = page?.querySelectorAll("[data-admin-match].is-dirty").length || 0;
  const pendingDates = page?.querySelectorAll("[data-admin-round].has-date-change").length || 0;
  const pending = pendingMatches + pendingDates;
  const label = getPage()?.querySelector("[data-admin-pending-count]");
  const saveAll = getPage()?.querySelector("[data-save-all]");
  if (label) label.textContent = pending ? `${pending} ${pending === 1 ? "alteração pendente" : "alterações pendentes"}` : "Nenhuma alteração pendente";
  if (saveAll) saveAll.disabled = pending === 0 || !adminEditMode;
}

async function saveAllMatchChanges(divisao) {
  const page = getPage();
  const cards = [...page.querySelectorAll("[data-admin-match].is-dirty")];
  const rounds = [...page.querySelectorAll("[data-admin-round].has-date-change")];
  if (!cards.length && !rounds.length) return;
  const invalid = cards.map((card) => ({ card, change: getCardChange(card, divisao) })).find((item) => item.change.error);
  if (invalid) {
    invalid.card.classList.add("has-error");
    return showAdminModal("Confira a partida", invalid.change.error, "error");
  }
  if (rounds.some((round) => !round.querySelector("[data-round-date]").value)) {
    return showAdminModal("Confira as datas", "Todas as rodadas alteradas devem possuir uma data.", "error");
  }
  const details = [
    cards.length ? `${cards.length} ${cards.length === 1 ? "partida alterada" : "partidas alteradas"}` : "",
    rounds.length ? `${rounds.length} ${rounds.length === 1 ? "data de rodada alterada" : "datas de rodadas alteradas"}` : "",
  ].filter(Boolean).join(" e ");
  const confirmed = await confirmAdminChange("Salvar todas as alterações?", `Serão salvas ${details}.`);
  if (!confirmed) return;
  const saveAll = page.querySelector("[data-save-all]");
  saveAll.disabled = true;
  try {
    const operations = rounds.length ? [saveAdminRoundDates(activeAdminSession.token, rounds.map((round) => ({
      divisao,
      rodada: Number(round.dataset.adminRound),
      data: round.querySelector("[data-round-date]").value,
    })))] : [];
    if (cards.length) operations.unshift(saveAdminPartidas(activeAdminSession.token, cards.map((card) => getCardChange(card, divisao))));
    await Promise.all(operations);
    await loadAdminMatches(divisao, true);
    showAdminModal("Alterações salvas", `Foram salvas ${details} com sucesso.`, "success");
  } catch (error) {
    await loadAdminMatches(divisao, true);
    showAdminModal("Não foi possível salvar tudo", error.message, "error");
  }
}

function getCardChange(card, divisao) {
  const status = card.querySelector("[data-match-status]").value;
  const scores = [...card.querySelectorAll("[data-match-score]")].map((item) => item.value);
  if (card.dataset.woBoth) {
    return {
      divisao,
      rodada: card.dataset.round,
      numero1: card.dataset.player1,
      numero2: card.dataset.player2,
      status: "E",
      placar1: 0,
      placar2: 0,
      observacao: "W.O.: ambos abandonaram a competição",
      wo_ambos: true,
    };
  }
  const validation = validateMatchState(status, scores[0], scores[1]);
  if (validation.error) return { error: validation.error };
  return { divisao, rodada: card.dataset.round, numero1: card.dataset.player1, numero2: card.dataset.player2, observacao: card.querySelector("[data-match-observation]")?.textContent || "", ...(card.dataset.woLoser ? { wo_perdedor: card.dataset.woLoser } : {}), ...validation };
}

async function requestSaveCards(selectedCard, divisao) {
  const dirtyCards = [...getPage().querySelectorAll("[data-admin-match].is-dirty")];
  if (!dirtyCards.length) return;
  const scope = await confirmAdminSave(selectedCard, dirtyCards);
  if (scope === "cancel") return;
  const cards = scope === "all" ? dirtyCards : [selectedCard];
  const invalid = cards.map((card) => ({ card, change: getCardChange(card, divisao) })).find((item) => item.change.error);
  if (invalid) {
    invalid.card.classList.add("has-error");
    return showAdminModal("Confira a partida", invalid.change.error, "error");
  }
  await saveCards(cards, divisao);
}

async function saveCards(cards, divisao) {
  const changes = cards.map((card) => getCardChange(card, divisao));
  const buttons = cards.map((card) => card.querySelector("[data-save-match]"));
  buttons.forEach((button) => { button.disabled = true; });
  getPage().querySelector("[data-save-all]").disabled = true;
  try {
    const response = await saveAdminPartidas(activeAdminSession.token, changes);
    response.partidas.forEach((result) => {
      const card = cards.find((item) => item.dataset.round === String(result.rodada) && item.dataset.player1 === String(result.numero1) && item.dataset.player2 === String(result.numero2));
      if (!card) return;
      const status = card.querySelector("[data-match-status]");
      const scores = [...card.querySelectorAll("[data-match-score]")];
      status.value = status.dataset.previousStatus = result.status;
      scores[0].value = result.placar1 === "-" ? "" : String(result.placar1);
      scores[1].value = result.placar2 === "-" ? "" : String(result.placar2);
      card.dataset.originalStatus = result.status;
      card.dataset.originalScore1 = String(result.placar1);
      card.dataset.originalScore2 = String(result.placar2);
      card.dataset.originalObservation = result.observacao || "";
      card.dataset.woLoser = "";
      card.dataset.woBoth = "";
      setAdminMatchObservation(card, result.observacao || "");
      card.classList.remove("is-dirty", "has-error");
      scores.forEach((score) => { score.disabled = !adminEditMode; });
      card.querySelector("[data-save-match]").disabled = false;
    });
    updateCardDirtyState(cards[0]);
    showAdminModal("Alterações salvas", `${cards.length} ${cards.length === 1 ? "partida foi atualizada" : "partidas foram atualizadas"} com sucesso.`, "success");
  } catch (error) {
    buttons.forEach((button) => { button.disabled = false; });
    updateCardDirtyState(cards[0]);
    showAdminModal("Não foi possível salvar", error.message, "error");
  }
}

function confirmAdminSave(selectedCard, dirtyCards) {
  return new Promise((resolve) => {
    document.querySelector(".admin-modal-backdrop")?.remove();
    const modal = document.createElement("div");
    modal.className = "admin-modal-backdrop";
    const list = dirtyCards.map((card) => {
      const names = [...card.querySelectorAll(".admin-match-players strong")].map((item) => item.textContent.trim());
      const status = card.querySelector("[data-match-status] option:checked").textContent;
      const scores = [...card.querySelectorAll("[data-match-score]")].map((item) => item.value || "-");
      const observation = card.querySelector("[data-match-observation]")?.textContent || "";
      return `<li><strong>Rodada ${card.dataset.round}:</strong> ${escapeHtml(names[0])} ${scores[0]} × ${scores[1]} ${escapeHtml(names[1])} — ${escapeHtml(status)}${observation ? `<br><small>${escapeHtml(observation)}</small>` : ""}</li>`;
    }).join("");
    const multipleChoice = selectedCard && dirtyCards.length > 1;
    modal.innerHTML = `<div class="admin-modal admin-save-modal ${multipleChoice ? "has-multiple-actions" : ""}" role="dialog" aria-modal="true"><i class="bi bi-check2-square"></i><h2>Confira as alterações</h2><ul>${list}</ul><div class="admin-modal-actions"><button class="btn btn-admin-secondary" data-scope="cancel">Cancelar</button>${multipleChoice ? '<button class="btn btn-admin-secondary" data-scope="one">Salvar esta</button>' : ""}<button class="btn" data-scope="all">${multipleChoice ? "Salvar tudo" : "Confirmar"}</button></div></div>`;
    document.body.appendChild(modal);
    modal.querySelectorAll("[data-scope]").forEach((button) => button.addEventListener("click", () => { const scope = button.dataset.scope; modal.remove(); resolve(scope); }));
  });
}

function validateMatchState(status, placar1, placar2) {
  if (status === "A") {
    if (placar1 !== "" || placar2 !== "") return { error: "Partidas agendadas não podem possuir placar." };
    return { status, placar1: "-", placar2: "-" };
  }
  const scores = [placar1, placar2].map(Number);
  if (placar1 === "" || placar2 === "" || scores.some((score) => !Number.isInteger(score) || score < 0 || score > 2)) return { error: "Informe os dois placares entre 0 e 2." };
  if (status === "V" && scores.includes(2)) return { error: "Para salvar como Ao vivo, corrija o placar 2 para 0 ou 1. Se mantiver 2, a partida deve ficar Encerrada." };
  if (status === "E" && scores.filter((score) => score === 2).length !== 1) return { error: "Uma partida encerrada exige exatamente um jogador com 2 pontos." };
  if (status === "V" && scores.some((score) => score > 1)) return { error: "Ao vivo aceita somente 0 ou 1 ponto para cada jogador." };
  return { status, placar1: scores[0], placar2: scores[1] };
}

function showAdminModal(title, message, type) {
  document.querySelector(".admin-modal-backdrop")?.remove();
  const modal = document.createElement("div"); modal.className = "admin-modal-backdrop";
  modal.innerHTML = `<div class="admin-modal" role="alertdialog" aria-modal="true"><i class="bi ${type === "success" ? "bi-check-circle" : "bi-exclamation-triangle"}"></i><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><button class="btn" type="button">Entendi</button></div>`;
  document.body.appendChild(modal); modal.querySelector("button").addEventListener("click", () => modal.remove());
}

function confirmAdminChange(title, message) {
  return new Promise((resolve) => {
    document.querySelector(".admin-modal-backdrop")?.remove();
    const modal = document.createElement("div");
    modal.className = "admin-modal-backdrop";
    modal.innerHTML = `<div class="admin-modal" role="dialog" aria-modal="true"><i class="bi bi-arrow-counterclockwise"></i><h2>${escapeHtml(title)}</h2><p>${escapeHtml(message)}</p><div class="admin-modal-actions"><button class="btn btn-admin-secondary" type="button" data-cancel>Cancelar</button><button class="btn" type="button" data-confirm>Confirmar</button></div></div>`;
    document.body.appendChild(modal);
    const finish = (result) => { modal.remove(); resolve(result); };
    modal.querySelector("[data-cancel]").addEventListener("click", () => finish(false));
    modal.querySelector("[data-confirm]").addEventListener("click", () => finish(true));
  });
}

async function handleLogout(event) {
  if (isSeasonDirty()) {
    const confirmed = await confirmAdminChange(
      "Sair sem salvar?",
      "As alterações ainda não salvas da temporada serão descartadas.",
    );
    if (!confirmed) return;
  }
  event.currentTarget.disabled = true;
  temporaryActivePlayers = new Map();
  seasonDraft = null;
  savedSeasonDraft = null;

  try {
    await endAdminSession();
  } catch (error) {
    // A sessão local já foi removida; o usuário pode sair mesmo se a API estiver indisponível.
  }

  if (isCurrentPage()) renderLogin();
}

function setAdminHeaderSessionVisible(visible) {
  document.querySelectorAll("[data-admin-header-session]").forEach((element) => {
    element.classList.toggle("is-hidden", !visible);
  });
}

function getPage() {
  return document.getElementById(PAGE_ID);
}

function isCurrentPage() {
  return Boolean(getPage());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFriendlyAuthError(error) {
  const message = String(error?.message || "");

  if (
    message.includes("UrlFetchApp") ||
    message.includes("script.external_request")
  ) {
    return "O servidor ainda precisa da autorização do proprietário para validar contas Google. Execute a autorização no Apps Script e tente novamente.";
  }

  return message || "Não foi possível validar a conta. Tente novamente.";
}
