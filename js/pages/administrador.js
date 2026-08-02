import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";
import {
  authenticateWithGoogle,
  endAdminSession,
  restoreAdminSession,
} from "../auth.js";
import { GOOGLE_CLIENT_ID } from "../config.js";
import { getAdminPartidas, saveAdminPartidas } from "../api.js";

const PAGE_ID = "admin-page";
let activeAdminSession = null;
let adminEditMode = false;

export function renderAdministrador() {
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

      <section class="admin-matches-module">
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
            <span><i class="bi bi-person-fill" aria-hidden="true"></i> Visualizar partidas de</span>
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

    </section>
  `;

  page.querySelector("[data-enable-edit]")?.addEventListener("click", toggleAdminEditMode);
  document.querySelectorAll("[data-admin-header-logout]").forEach((button) => { button.onclick = handleLogout; });
  page.querySelector("[data-admin-division]")?.addEventListener("change", (event) => loadAdminMatches(event.target.value, false));
  page.querySelector("[data-admin-round-filter]")?.addEventListener("change", applyAdminMatchFilters);
  page.querySelector("[data-admin-player-filter]")?.addEventListener("change", applyAdminMatchFilters);
  page.querySelector("[data-save-all]")?.addEventListener("click", () => requestSaveCards(null, page.querySelector("[data-admin-division]").value));
  loadAdminMatches("A", false);
}

function toggleAdminEditMode(event) {
  const dashboard = event.currentTarget.closest("[data-admin-dashboard]");
  const banner = dashboard?.querySelector("[data-admin-mode-banner]");
  if (!dashboard || !banner) return;

  adminEditMode = !adminEditMode;
  dashboard.classList.toggle("is-editing", adminEditMode);
  banner.innerHTML = adminEditMode
    ? `<i class="bi bi-pencil-square" aria-hidden="true"></i><div><strong>Modo de edição ativo</strong><span>Status e placares podem ser alterados e salvos.</span></div>`
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
    }
    const scheduled = status?.value === "A";
    if (status) status.disabled = !adminEditMode;
    scores.forEach((score) => {
      score.disabled = !adminEditMode || scheduled;
    });
    const saveButton = card.querySelector("[data-save-match]");
    if (saveButton) saveButton.disabled = !adminEditMode;
    if (!adminEditMode) updateCardDirtyState(card);
  });
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
    bindAdminMatchEvents(divisao);
    applyAdminMatchFilters();
  } catch (error) {
    if (content.isConnected) content.innerHTML = `<div class="error-state"><i class="bi bi-exclamation-circle"></i><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function renderAdminRound(rodada) {
  return `<section class="admin-round" data-admin-round="${rodada.rodada}"><h3>Rodada ${rodada.rodada}</h3>${rodada.partidas.map(renderAdminMatch).join("")}</section>`;
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
  const scheduled = partida.status.codigo === "A";
  return `<article class="admin-match" data-admin-match data-round="${partida.rodada}" data-player1="${partida.jogador1.numero}" data-player2="${partida.jogador2.numero}" data-original-status="${partida.status.codigo}" data-original-score1="${partida.placar1}" data-original-score2="${partida.placar2}">
    <div class="admin-match-players"><strong>${escapeHtml(partida.jogador1.exibicao)}</strong><span>×</span><strong>${escapeHtml(partida.jogador2.exibicao)}</strong></div>
    <div class="admin-match-controls"><select class="admin-select" data-match-status ${adminEditMode ? "" : "disabled"}>${statusOption("A", "Agendada", partida.status.codigo)}${statusOption("V", "Ao vivo", partida.status.codigo)}${statusOption("E", "Encerrada", partida.status.codigo)}</select><div class="admin-score-pair">${scoreSelect(partida.placar1, scheduled)}<span>×</span>${scoreSelect(partida.placar2, scheduled)}</div><button class="btn btn-admin-save" type="button" data-save-match ${adminEditMode ? "" : "disabled"}>Salvar</button></div>
  </article>`;
}

function statusOption(value, label, selected) {
  return `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`;
}

function scoreSelect(value, scheduled) {
  const normalized = value === "-" ? "" : String(value);
  return `<select class="admin-select admin-score" data-match-score ${!adminEditMode || scheduled ? "disabled" : ""}><option value="" ${normalized === "" ? "selected" : ""}>-</option>${[0, 1, 2].map((score) => `<option value="${score}" ${normalized === String(score) ? "selected" : ""}>${score}</option>`).join("")}</select>`;
}

function bindAdminMatchEvents(divisao) {
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
        scores.forEach((score) => { score.value = ""; score.disabled = true; });
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
    scores.forEach((score) => score.addEventListener("change", () => {
      if (scores.some((item) => item.value === "2")) {
        status.value = "E";
        status.dataset.previousStatus = "E";
      }
      updateCardDirtyState(card);
    }));
    card.querySelector("[data-save-match]")?.addEventListener("click", () => requestSaveCards(card, divisao));
  });
}

function updateCardDirtyState(card) {
  const status = card.querySelector("[data-match-status]").value;
  const scores = [...card.querySelectorAll("[data-match-score]")].map((item) => item.value || "-");
  const dirty = status !== card.dataset.originalStatus || scores[0] !== card.dataset.originalScore1 || scores[1] !== card.dataset.originalScore2;
  card.classList.toggle("is-dirty", dirty);
  const pending = getPage()?.querySelectorAll("[data-admin-match].is-dirty").length || 0;
  const label = getPage()?.querySelector("[data-admin-pending-count]");
  const saveAll = getPage()?.querySelector("[data-save-all]");
  if (label) label.textContent = pending ? `${pending} ${pending === 1 ? "alteração pendente" : "alterações pendentes"}` : "Nenhuma alteração pendente";
  if (saveAll) saveAll.disabled = pending === 0 || !adminEditMode;
}

function getCardChange(card, divisao) {
  const status = card.querySelector("[data-match-status]").value;
  const scores = [...card.querySelectorAll("[data-match-score]")].map((item) => item.value);
  const validation = validateMatchState(status, scores[0], scores[1]);
  if (validation.error) return { error: validation.error };
  return { divisao, rodada: card.dataset.round, numero1: card.dataset.player1, numero2: card.dataset.player2, ...validation };
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
      card.classList.remove("is-dirty", "has-error");
      scores.forEach((score) => { score.disabled = result.status === "A"; });
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
      return `<li><strong>Rodada ${card.dataset.round}:</strong> ${escapeHtml(names[0])} ${scores[0]} × ${scores[1]} ${escapeHtml(names[1])} — ${escapeHtml(status)}</li>`;
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
  event.currentTarget.disabled = true;

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
