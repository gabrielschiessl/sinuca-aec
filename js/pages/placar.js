import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";
import { withBasePath } from "../config.js";

const STORAGE_KEY = "aec_sinuca_placar";
const BALLS = [
  { points: 1, name: "Vermelha", image: "vermelha.svg" },
  { points: 2, name: "Amarela", image: "amarela.svg" },
  { points: 3, name: "Verde", image: "verde.svg" },
  { points: 4, name: "Marrom", image: "marrom.svg" },
  { points: 5, name: "Azul", image: "azul.svg" },
  { points: 6, name: "Rosa", image: "rosa.svg" },
  { points: 7, name: "Preta", image: "preta.svg" },
];

let state = loadState();
let wakeLockSentinel = null;
let wakeLockSession = 0;
let wakeLockVisibilityHandler = null;
let wakeLockRouteHandler = null;

export function renderPlacar() {
  const app = document.getElementById("app");
  app.innerHTML = `
    ${renderNavbar({ title: "Placar" })}
    <main class="scorekeeper-page">
      <section class="scorekeeper-shell" aria-labelledby="scorekeeper-title">
        <header class="scorekeeper-heading">
          <span class="scorekeeper-kicker"><i class="bi bi-calculator"></i> Regra Brasileira</span>
          <h1 id="scorekeeper-title">Placar de mesa</h1>
          <p>Marque os pontos de cada partida e acompanhe o resultado do jogo.</p>
        </header>

        <div class="scorekeeper-player" data-player="0">
          ${playerHeader(0)}
          ${pointButtons(0)}
        </div>

        <section class="scorekeeper-summary" aria-label="Resumo do jogo">
          <div class="scorekeeper-difference">
            <span>Diferença</span>
            <strong data-difference></strong>
          </div>
          <div class="scorekeeper-actions">
            <button class="btn btn-outline" type="button" data-reset-frame>
              <i class="bi bi-arrow-counterclockwise"></i> Reiniciar pontos
            </button>
            <button class="btn btn-primary" type="button" data-finish-frame>
              <i class="bi bi-flag-fill"></i> Finalizar partida
            </button>
          </div>
          <div class="scorekeeper-match-score">
            <span>Partidas</span>
            <strong data-wins="0">${state.wins[0]}</strong>
            <i>×</i>
            <strong data-wins="1">${state.wins[1]}</strong>
          </div>
        </section>

        <div class="scorekeeper-player" data-player="1">
          ${playerHeader(1)}
          ${pointButtons(1)}
        </div>

        <section class="scorekeeper-reference">
          <h2>Diferenças máximas</h2>
          ${maximumDifference("azul.svg", "Azul", "46 pontos", "Preta (N) → Azul (V) → Preta (L) → Preta (N) → Rosa (V) → Preta (L) → Preta (V)")}
          ${maximumDifference("rosa.svg", "Rosa", "27 pontos", "Preta (N) → Rosa (V) → Preta (L) → Preta (V)")}
          ${maximumDifference("preta.svg", "Preta", "7 pontos", "Preta (V)")}
        </section>

        <nav class="scorekeeper-tools" aria-label="Ferramentas do placar">
          <button class="scorekeeper-tool" type="button" data-show-balls><i class="bi bi-circle-fill"></i><span>Bolas e mesa</span></button>
          <button class="scorekeeper-tool" type="button" data-route="/regra"><i class="bi bi-journal-text"></i><span>Regra</span></button>
          <button class="scorekeeper-tool" type="button" data-edit-names><i class="bi bi-person-gear"></i><span>Editar nomes</span></button>
          <button class="scorekeeper-tool" type="button" data-finish-match><i class="bi bi-trophy-fill"></i><span>Finalizar jogo</span></button>
        </nav>
      </section>
      ${renderFooter("footer-light")}
    </main>
    <div data-scorekeeper-modal></div>`;

  bindEvents(app);
  renderState(app);
  setupScreenWakeLock(app);
  if (!state.names[0] || !state.names[1]) openNamesModal(app);
}

function setupScreenWakeLock(app) {
  cleanupScreenWakeLock();
  if (!("wakeLock" in navigator)) return;

  const session = ++wakeLockSession;
  wakeLockVisibilityHandler = () => {
    if (document.visibilityState === "visible") requestScreenWakeLock(app, session);
  };
  wakeLockRouteHandler = () => {
    if (!document.querySelector(".scorekeeper-page")) cleanupScreenWakeLock();
  };

  document.addEventListener("visibilitychange", wakeLockVisibilityHandler);
  window.addEventListener("app:route-rendered", wakeLockRouteHandler);
  requestScreenWakeLock(app, session);
}

async function requestScreenWakeLock(app, session) {
  if (
    wakeLockSentinel ||
    session !== wakeLockSession ||
    document.visibilityState !== "visible" ||
    !app.querySelector(".scorekeeper-page")
  ) return;

  try {
    const sentinel = await navigator.wakeLock.request("screen");
    if (session !== wakeLockSession || !app.querySelector(".scorekeeper-page")) {
      await sentinel.release();
      return;
    }

    wakeLockSentinel = sentinel;
    sentinel.addEventListener("release", () => {
      if (wakeLockSentinel === sentinel) wakeLockSentinel = null;
    }, { once: true });
  } catch {
    wakeLockSentinel = null;
  }
}

function cleanupScreenWakeLock() {
  wakeLockSession += 1;
  if (wakeLockVisibilityHandler) {
    document.removeEventListener("visibilitychange", wakeLockVisibilityHandler);
  }
  if (wakeLockRouteHandler) {
    window.removeEventListener("app:route-rendered", wakeLockRouteHandler);
  }
  wakeLockVisibilityHandler = null;
  wakeLockRouteHandler = null;

  const sentinel = wakeLockSentinel;
  wakeLockSentinel = null;
  if (sentinel) sentinel.release().catch(() => {});
}

function playerHeader(index) {
  return `<div class="scorekeeper-player-header">
    <label for="scorekeeper-points-${index}" data-player-name="${index}">${escapeHtml(state.names[index] || `Jogador ${index + 1}`)}</label>
    <div class="scorekeeper-points-field">
      <button type="button" data-subtract-point="${index}" aria-label="Retirar um ponto de ${escapeHtml(state.names[index] || `Jogador ${index + 1}`)}"><i class="bi bi-dash-lg"></i></button>
      <input id="scorekeeper-points-${index}" type="number" inputmode="numeric" min="0" value="${state.points[index]}" data-points="${index}" aria-label="Pontos de ${escapeHtml(state.names[index] || `Jogador ${index + 1}`)}">
      <button type="button" data-add-point="${index}" aria-label="Adicionar um ponto a ${escapeHtml(state.names[index] || `Jogador ${index + 1}`)}"><i class="bi bi-plus-lg"></i></button>
    </div>
  </div>`;
}

function pointButtons(player) {
  return `<div class="scorekeeper-balls">
    ${BALLS.map((ball) => `<button type="button" class="scorekeeper-ball-button" data-score-player="${player}" data-score-points="${ball.points}" aria-label="Adicionar ${ball.points} ${ball.points === 1 ? "ponto" : "pontos"} pela bola ${ball.name.toLowerCase()}">
      <span>+${ball.points}</span><img src="${ballAsset(ball.image)}" alt="">
    </button>`).join("")}
    <button type="button" class="scorekeeper-ball-button scorekeeper-penalty-button" data-score-player="${player}" data-score-points="7" aria-label="Adicionar sete pontos de penalidade">
      <span>+7</span><i class="bi bi-x-lg"></i>
    </button>
  </div>`;
}

function maximumDifference(image, name, points, sequence) {
  return `<article class="scorekeeper-reference-row">
    <img src="${ballAsset(image)}" alt="Bola ${name.toLowerCase()}">
    <div><strong>${points}</strong><span>${sequence}</span></div>
  </article>`;
}

function bindEvents(app) {
  app.querySelectorAll("[data-score-player]").forEach((button) => button.addEventListener("click", () => {
    changePoints(Number(button.dataset.scorePlayer), Number(button.dataset.scorePoints), app);
  }));
  app.querySelectorAll("[data-add-point]").forEach((button) => button.addEventListener("click", () => changePoints(Number(button.dataset.addPoint), 1, app)));
  app.querySelectorAll("[data-subtract-point]").forEach((button) => button.addEventListener("click", () => changePoints(Number(button.dataset.subtractPoint), -1, app)));
  app.querySelectorAll("[data-points]").forEach((input) => input.addEventListener("input", () => {
    state.points[Number(input.dataset.points)] = Math.max(0, Number.parseInt(input.value, 10) || 0);
    saveState();
    renderState(app);
  }));
  app.querySelector("[data-reset-frame]")?.addEventListener("click", () => confirmAction(app, "Reiniciar os pontos?", "Os pontos da partida atual voltarão para zero.", () => {
    state.points = [0, 0];
    saveState();
    renderState(app);
  }));
  app.querySelector("[data-finish-frame]")?.addEventListener("click", () => finishFrame(app));
  app.querySelector("[data-edit-names]")?.addEventListener("click", () => openNamesModal(app));
  app.querySelector("[data-show-balls]")?.addEventListener("click", () => openBallsModal(app));
  app.querySelector("[data-finish-match]")?.addEventListener("click", () => openResultModal(app));
}

function changePoints(player, amount, app) {
  state.points[player] = Math.max(0, state.points[player] + amount);
  saveState();
  renderState(app);
}

function renderState(app) {
  app.querySelectorAll("[data-points]").forEach((input) => {
    input.value = state.points[Number(input.dataset.points)];
  });
  app.querySelectorAll("[data-wins]").forEach((element) => {
    element.textContent = state.wins[Number(element.dataset.wins)];
  });
  app.querySelectorAll("[data-player-name]").forEach((element) => {
    element.textContent = state.names[Number(element.dataset.playerName)] || `Jogador ${Number(element.dataset.playerName) + 1}`;
  });
  const difference = Math.abs(state.points[0] - state.points[1]);
  const leader = state.points[0] === state.points[1]
    ? "Empate"
    : state.names[state.points[0] > state.points[1] ? 0 : 1] || `Jogador ${state.points[0] > state.points[1] ? 1 : 2}`;
  const output = app.querySelector("[data-difference]");
  if (output) output.textContent = `${difference} · ${leader}`;
}

function finishFrame(app) {
  const [first, second] = state.points;
  if (first === 0 && second === 0) {
    return showNotice(app, "Partida não iniciada", "Marque os pontos antes de finalizar a partida.");
  }
  if (first === second) {
    return showNotice(app, "Placar empatado", "Defina o vencedor da partida antes de finalizá-la.");
  }
  const winner = first > second ? 0 : 1;
  confirmAction(app, "Finalizar esta partida?", `${escapeHtml(state.names[winner] || `Jogador ${winner + 1}`)} vencerá por ${first} × ${second}.`, () => {
    state.wins[winner] += 1;
    state.history.push({ date: new Date().toISOString(), points: [first, second], winner });
    state.points = [0, 0];
    saveState();
    renderState(app);
  });
}

function openNamesModal(app) {
  openModal(app, `<div class="scorekeeper-modal-icon"><i class="bi bi-people-fill"></i></div>
    <h2>Nome dos jogadores</h2>
    <p>Os nomes ficam salvos somente neste dispositivo.</p>
    <div class="scorekeeper-name-fields">
      <label>Jogador 1<input type="text" maxlength="40" value="${escapeHtml(state.names[0])}" data-name-input="0" placeholder="Jogador 1"></label>
      <label>Jogador 2<input type="text" maxlength="40" value="${escapeHtml(state.names[1])}" data-name-input="1" placeholder="Jogador 2"></label>
    </div>
    <div class="scorekeeper-modal-actions"><button class="btn btn-outline" type="button" data-modal-close>Cancelar</button><button class="btn btn-primary" type="button" data-save-names>Confirmar</button></div>`, (modal) => {
    modal.querySelector("[data-save-names]").addEventListener("click", () => {
      state.names = [0, 1].map((index) => modal.querySelector(`[data-name-input="${index}"]`).value.trim() || `Jogador ${index + 1}`);
      saveState();
      closeModal(app);
      renderPlacar();
    });
  }, Boolean(state.names[0] && state.names[1]));
}

function openBallsModal(app) {
  openModal(app, `<div class="scorekeeper-modal-icon"><i class="bi bi-circle-fill"></i></div><h2>Bolas e mesa</h2>
    <div class="scorekeeper-ball-legend">${[{ points: 0, name: "Tacadeira", image: "branca.svg" }, ...BALLS].map((ball) => `<div><img src="${ballAsset(ball.image)}" alt=""><span>${ball.name}</span><strong>${ball.points ? `${ball.points} ${ball.points === 1 ? "ponto" : "pontos"}` : "Branca"}</strong></div>`).join("")}</div>
    <img class="scorekeeper-table-map" src="${ballAsset("mapa-regra-brasileira.svg")}" alt="Mapa da mesa da Regra Brasileira">
    <p class="scorekeeper-table-size">Medidas da mesa nacional: 3,10 m × 1,70 m</p>
    <div class="scorekeeper-modal-actions"><button class="btn btn-primary" type="button" data-modal-close>Entendi</button></div>`);
}

function openResultModal(app) {
  const winner = state.wins[0] === state.wins[1] ? null : state.wins[0] > state.wins[1] ? 0 : 1;
  openModal(app, `<div class="scorekeeper-modal-icon"><i class="bi bi-trophy-fill"></i></div>
    <h2>${winner === null ? "Jogo empatado" : `Vitória de ${escapeHtml(state.names[winner] || `Jogador ${winner + 1}`)}`}</h2>
    <div class="scorekeeper-final-score">${state.wins[0]} <i>×</i> ${state.wins[1]}</div>
    <div class="scorekeeper-history"><h3>Histórico de partidas</h3>${state.history.length ? `<ol>${state.history.map((frame) => `<li><span>${escapeHtml(state.names[0] || "Jogador 1")} ${frame.points[0]} × ${frame.points[1]} ${escapeHtml(state.names[1] || "Jogador 2")}</span><small>${formatDate(frame.date)}</small></li>`).join("")}</ol>` : "<p>Nenhuma partida finalizada.</p>"}</div>
    <div class="scorekeeper-modal-actions"><button class="btn btn-outline" type="button" data-modal-close>Voltar</button><button class="btn btn-primary" type="button" data-clear-match>Encerrar jogo</button></div>`, (modal) => {
    modal.querySelector("[data-clear-match]").addEventListener("click", () => confirmAction(app, "Encerrar e limpar o jogo?", "O placar e todo o histórico de partidas serão apagados.", () => {
      state.points = [0, 0]; state.wins = [0, 0]; state.history = [];
      saveState(); closeModal(app); renderPlacar();
    }));
  });
}

function confirmAction(app, title, message, action) {
  openModal(app, `<div class="scorekeeper-modal-icon is-warning"><i class="bi bi-exclamation-triangle"></i></div><h2>${title}</h2><p>${message}</p><div class="scorekeeper-modal-actions"><button class="btn btn-outline" type="button" data-modal-close>Cancelar</button><button class="btn btn-primary" type="button" data-modal-confirm>Confirmar</button></div>`, (modal) => modal.querySelector("[data-modal-confirm]").addEventListener("click", () => { closeModal(app); action(); }));
}

function showNotice(app, title, message) {
  openModal(app, `<div class="scorekeeper-modal-icon is-warning"><i class="bi bi-exclamation-triangle"></i></div><h2>${title}</h2><p>${message}</p><div class="scorekeeper-modal-actions"><button class="btn btn-primary" type="button" data-modal-close>Entendi</button></div>`);
}

function openModal(app, content, setup, dismissible = true) {
  const host = app.querySelector("[data-scorekeeper-modal]");
  host.innerHTML = `<div class="scorekeeper-modal-backdrop" role="dialog" aria-modal="true"><div class="scorekeeper-modal">${content}</div></div>`;
  const backdrop = host.firstElementChild;
  const modal = backdrop.firstElementChild;
  modal.querySelectorAll("[data-modal-close]").forEach((button) => button.addEventListener("click", () => closeModal(app)));
  if (dismissible) backdrop.addEventListener("click", (event) => { if (event.target === backdrop) closeModal(app); });
  setup?.(modal);
  modal.querySelector("input, button")?.focus();
}

function closeModal(app) {
  const host = app.querySelector("[data-scorekeeper-modal]");
  if (host) host.innerHTML = "";
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.names) && Array.isArray(saved.points) && Array.isArray(saved.wins)) {
      return {
        names: [String(saved.names[0] || ""), String(saved.names[1] || "")],
        points: [validNumber(saved.points[0]), validNumber(saved.points[1])],
        wins: [validNumber(saved.wins[0]), validNumber(saved.wins[1])],
        history: Array.isArray(saved.history) ? saved.history : [],
      };
    }
  } catch {}
  return { names: ["", ""], points: [0, 0], wins: [0, 0], history: [] };
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function validNumber(value) { return Math.max(0, Number.parseInt(value, 10) || 0); }
function ballAsset(file) { return withBasePath(`/assets/images/regulamento/${file}`); }
function formatDate(value) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function escapeHtml(value = "") { const span = document.createElement("span"); span.textContent = String(value); return span.innerHTML; }
