import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";
import { withBasePath } from "../config.js";
import { navigate, resetPageScroll } from "../router.js";
import { ScoreboardRoom, roomRequest, roomStorageKey, normalizeRoomCode } from "../scoreboardRooms.js";
import { openingPlayer, applyOpening } from "../scoreboardOpening.js";

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
let tvKeyboardHandler = null;
let tvRouteHandler = null;
let tvUndoStack = [];
let room = null;
let roomTv = false;
let localUndoStack = [];
let lastLocalState = structuredClone(state);
const blankState = () => ({ names: ["", ""], points: [0, 0], wins: [0, 0], history: [], breakPlayer: 0, strokeScore: 0, firstStarter: null });
const roomEndpoint = () => withBasePath("/api/placar.php");
window.addEventListener("app:route-rendered", () => {
  if (!document.querySelector("[data-room-bar]")) { room?.stop(); room = null; }
});

function prepareRoom(tv) {
  if (roomTv !== tv) localUndoStack = [];
  room?.stop(); room = null; roomTv = tv;
  const code = normalizeRoomCode(new URLSearchParams(location.search).get("sala") || "");
  state = code ? blankState() : loadState();
  if (!code) {
    if (JSON.stringify(state) !== JSON.stringify(lastLocalState)) localUndoStack = [];
    lastLocalState = structuredClone(state);
  }
  if (!code) return;
  room = new ScoreboardRoom({
    code, viewer: tv, storage: sessionStorage,
    request: (payload) => roomRequest(roomEndpoint(), payload),
    onChange: (current) => {
      if (room !== current) return;
      const app = document.getElementById("app");
      if (current.state) state = structuredClone(current.state);
      renderState(app); renderRoomBar(app);
    },
  });
}

function mountRoom(app) {
  renderRoomBar(app);
  // Capture blocks all editing while viewing/offline/awaiting acknowledgement.
  const shell = app.querySelector(".scorekeeper-shell, .scorekeeper-tv-shell");
  shell.addEventListener("click", (event) => {
    if (room && !room.editable && event.target.closest("[data-score-points], [data-score-penalty], [data-switch-turn], [data-edit-names], [data-reset-frame], [data-finish-frame], [data-finish-match]")) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  room?.start();
}

function renderRoomBar(app) {
  const bar = app.querySelector("[data-room-bar]");
  if (!bar) return;
  const signature = JSON.stringify(room ? [room.code, room.message, !!room.token, room.closed, !!room.pending, room.editable] : null);
  if (bar.dataset.state === signature) return;
  bar.dataset.state = signature;
  bar.innerHTML = room
    ? `<strong>Sala ${escapeHtml(room.code)}</strong><span role="status">${escapeHtml(room.message)}</span>
      <div><button type="button" data-room-share>Link da TV</button>
      ${!roomTv && !room.token && !room.closed ? '<button type="button" data-room-take>Assumir controle</button>' : ""}
      <button type="button" data-room-leave ${room.pending ? "disabled" : ""}>Sair da sala</button></div>`
    : `<span>Placar local · somente neste aparelho</span><div>${!roomTv ? '<button type="button" data-room-create>Criar sala</button>' : ""}<button type="button" data-room-join>Entrar em sala</button></div>`;
  bar.querySelector("[data-room-create]")?.addEventListener("click", () => roomDialog(app, "criar"));
  bar.querySelector("[data-room-join]")?.addEventListener("click", () => roomDialog(app, "entrar"));
  bar.querySelector("[data-room-take]")?.addEventListener("click", () => roomDialog(app, "assumir_controle"));
  bar.querySelector("[data-room-leave]")?.addEventListener("click", () => enterRoom(""));
  bar.querySelector("[data-room-share]")?.addEventListener("click", () => {
    const url = new URL(withBasePath("/placar/tv"), location.origin);
    url.searchParams.set("sala", room.code);
    openModal(app, `<h2>Acompanhar na TV</h2><p>Abra este link na TV ou entre pelo código. Não compartilhe a senha com espectadores.</p>
      <div class="scorekeeper-name-fields"><label>Código<input readonly value="${escapeHtml(room.code)}"></label>
      <label>Link da TV<input readonly value="${escapeHtml(url.href)}" data-room-link></label></div>
      <div class="scorekeeper-modal-actions"><button class="btn btn-primary" data-modal-close>Fechar</button></div>`, (modal) => {
        modal.querySelectorAll("input").forEach((input) => input.addEventListener("click", () => input.select()));
      });
  });
  app.querySelectorAll("[data-score-points], [data-score-penalty], [data-switch-turn], [data-edit-names], [data-reset-frame], [data-finish-frame], [data-finish-match], [data-tv-mode]")
    .forEach((button) => { button.disabled = !!room && (button.hasAttribute("data-tv-mode") ? !!room.pending : !room.editable); });
}

function enterRoom(code) {
  const url = new URL(location.href);
  if (code) url.searchParams.set("sala", code); else url.searchParams.delete("sala");
  history.replaceState(history.state, "", url);
  if (roomTv) renderPlacarTv(); else renderPlacar();
  resetPageScroll();
}

function roomDialog(app, action) {
  const creating = action === "criar";
  const taking = action === "assumir_controle";
  const currentRoom = room;
  openModal(app, `<h2>${creating ? "Criar sala" : taking ? "Assumir controle" : "Entrar em sala"}</h2>
    <p>${creating ? "O placar local atual será copiado para uma sala independente. Guarde a senha para transferir a arbitragem." : taking ? "Ao confirmar, o outro aparelho deixa de controlar esta sala." : "Entre para acompanhar. No telefone, você poderá assumir o controle com a senha depois."}</p>
    <form data-room-form class="scorekeeper-name-fields">
      ${!creating && !taking ? '<label>Código da sala (6 números)<input name="codigo" type="text" inputmode="numeric" pattern="[0-9]{6}" required minlength="6" maxlength="6" autocomplete="off" placeholder="000001"></label>' : ""}
      ${creating || taking ? '<label>Senha da sala (4 números)<input name="senha" type="password" inputmode="numeric" pattern="[0-9]{4}" required minlength="4" maxlength="4" autocomplete="off"></label>' : ""}
      <p data-room-error role="alert"></p>
      <div class="scorekeeper-modal-actions"><button class="btn btn-outline" type="button" data-modal-close>Cancelar</button><button class="btn btn-primary" type="submit">Confirmar</button></div>
    </form>`, (modal) => {
    const form = modal.querySelector("form");
    form.querySelectorAll("input").forEach((input) => input.addEventListener("input", () => {
      input.value = input.value.replace(/[^0-9]/g, "");
    }));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('[type="submit"]');
      if (button.disabled) return;
      button.disabled = true;
      try {
        let code = taking ? currentRoom.code : normalizeRoomCode(form.elements.codigo?.value || "");
        if (creating || taking) {
          const initial = structuredClone(state);
          initial.names = initial.names.map((name, index) => name || `Jogador ${index + 1}`);
          const result = await roomRequest(roomEndpoint(), { acao: action, codigo: code, senha: form.elements.senha.value, ...(creating ? { estado: initial } : {}) });
          code = result.codigo;
          sessionStorage.setItem(roomStorageKey(code), JSON.stringify({ token: result.controller_token }));
        } else {
          await roomRequest(roomEndpoint(), { acao: "consultar", codigo: code });
        }
        if (form.isConnected && room === currentRoom) enterRoom(code);
      } catch (error) {
        form.querySelector("[data-room-error]").textContent = error.message || "Não foi possível conectar. Tente novamente.";
        button.disabled = false;
      }
    });
  });
}

export function renderPlacar() {
  prepareRoom(false);
  cleanupTvKeyboard();
  const app = document.getElementById("app");
  app.innerHTML = `
    ${renderNavbar({ title: "Placar", hideAdmin: true })}
    <main class="scorekeeper-page">
      <section class="scorekeeper-shell" aria-labelledby="scorekeeper-title">
        <div class="scorekeeper-room-bar" data-room-bar></div>
        <label class="scorekeeper-opening-select">Quem saiu primeiro?
          <select data-first-starter aria-label="Quem saiu primeiro?">
            <option value="">Não definido</option>
            <option value="0">Jogador 1</option><option value="1">Jogador 2</option>
          </select>
        </label>
        ${scorekeeperPlayer(0)}

        <section class="scorekeeper-summary" aria-label="Resumo do jogo">
          <div class="scorekeeper-stroke">
            <span>Tacada</span>
            <strong data-tv-stroke>${state.strokeScore}</strong>
          </div>
          <div class="scorekeeper-difference">
            <span>Diferença</span>
            <strong data-difference></strong>
          </div>
          <div class="scorekeeper-match-score">
            <span>Partidas</span>
            <strong data-wins="0">${state.wins[0]}</strong>
            <i>×</i>
            <strong data-wins="1">${state.wins[1]}</strong>
          </div>
        </section>

        ${scorekeeperPlayer(1)}

        <section class="scorekeeper-scoring" aria-label="Pontuação da tacada">
          ${pointButtons()}
          <button class="scorekeeper-switch-turn" type="button" data-switch-turn>
            <i class="bi bi-arrow-left-right"></i>
            <span>Trocar tacada</span>
          </button>
          <button class="scorekeeper-switch-turn" type="button" data-undo-action>
            <i class="bi bi-arrow-counterclockwise"></i><span>Desfazer última ação</span>
          </button>
        </section>

        <nav class="scorekeeper-tools" aria-label="Ferramentas do placar">
          <button class="scorekeeper-tool" type="button" data-show-balls><i class="bi bi-circle-fill"></i><span>Bolas e mesa</span></button>
          <button class="scorekeeper-tool" type="button" data-edit-names><i class="bi bi-person-gear"></i><span>Editar nomes</span></button>
          <button class="scorekeeper-tool" type="button" data-reset-frame><i class="bi bi-arrow-counterclockwise"></i><span>Reiniciar pontos</span></button>
          <button class="scorekeeper-tool" type="button" data-finish-frame><i class="bi bi-flag-fill"></i><span>Finalizar partida</span></button>
          <button class="scorekeeper-tool" type="button" data-finish-match><i class="bi bi-trophy-fill"></i><span>Finalizar jogo</span></button>
          <button class="scorekeeper-tool" type="button" data-tv-mode><i class="bi bi-tv-fill"></i><span>Modo TV</span></button>
        </nav>
      </section>
      ${renderFooter("footer-light")}
    </main>
    <div data-scorekeeper-modal></div>`;

  bindEvents(app);
  renderState(app);
  setupScreenWakeLock(app);
  mountRoom(app);
  if (!room && (!state.names[0] || !state.names[1])) openNamesModal(app, renderPlacar, true);
}

export function renderPlacarTv() {
  prepareRoom(true);
  cleanupTvKeyboard();
  tvUndoStack = [];
  const app = document.getElementById("app");
  app.innerHTML = `
    ${renderNavbar({ title: "Placar", hideAdmin: true })}
    <main class="scorekeeper-tv-page${room ? " is-room-viewer" : ""}">
      <section class="scorekeeper-tv-shell" aria-label="Placar para televisão">
        <div class="scorekeeper-room-bar" data-room-bar></div>
        <div class="scorekeeper-tv-board">
          ${tvPlayer(0)}

          <section class="scorekeeper-tv-summary" aria-label="Resumo do jogo">
            <div class="scorekeeper-tv-opening" data-tv-opening hidden>
              <i class="bi bi-caret-left-fill" data-opening-arrow="0" aria-hidden="true"></i>
              <span>Saída</span>
              <i class="bi bi-caret-right-fill" data-opening-arrow="1" aria-hidden="true"></i>
            </div>
            <div class="scorekeeper-tv-stroke-score">
              <span>Tacada</span>
              <strong data-tv-stroke>${state.strokeScore}</strong>
            </div>
            <div class="scorekeeper-tv-difference">
              <span>Diferença</span>
              <strong data-difference></strong>
            </div>
            <div class="scorekeeper-tv-match-score">
              <span>Partidas</span>
              <div><strong data-wins="0">${state.wins[0]}</strong><i>×</i><strong data-wins="1">${state.wins[1]}</strong></div>
            </div>
          </section>

          ${tvPlayer(1)}
        </div>

        ${room ? "" : '<p class="scorekeeper-tv-help-hint"><kbd>/</kbd> Ver botões e ações</p>'}
      </section>
      <small class="scorekeeper-tv-copyright">© 2026 Gabriel Schiessl</small>
    </main>
    <div data-scorekeeper-modal></div>`;

  renderState(app);
  if (room) {
    const logo = app.querySelector(".header .logo");
    logo?.removeAttribute("data-route");
    if (logo) logo.style.cursor = "default";
  }
  bindTvKeyboard(app);
  setupScreenWakeLock(app);
  mountRoom(app);
}

function tvPlayer(index) {
  return `<article class="scorekeeper-tv-player" data-tv-player="${index}">
    <span class="scorekeeper-tv-break"><i class="bi bi-play-fill"></i> Tacada</span>
    <h1 data-player-name="${index}">${escapeHtml(state.names[index] || `Jogador ${index + 1}`)}</h1>
    <strong class="scorekeeper-tv-points" data-tv-points="${index}">${state.points[index]}</strong>
  </article>`;
}

function bindTvKeyboard(app) {
  const routeSession = Symbol("placar-tv");
  tvKeyboardHandler = (event) => handleTvKey(event, app);
  tvRouteHandler = () => {
    if (!document.querySelector(".scorekeeper-tv-page")) cleanupTvKeyboard(routeSession);
  };
  tvKeyboardHandler.routeSession = routeSession;
  document.addEventListener("keydown", tvKeyboardHandler);
  window.addEventListener("app:route-rendered", tvRouteHandler);
}

function cleanupTvKeyboard(routeSession = null) {
  if (routeSession && tvKeyboardHandler?.routeSession !== routeSession) return;
  if (tvKeyboardHandler) document.removeEventListener("keydown", tvKeyboardHandler);
  if (tvRouteHandler) window.removeEventListener("app:route-rendered", tvRouteHandler);
  tvKeyboardHandler = null;
  tvRouteHandler = null;
}

function handleTvKey(event, app) {
  const key = event.key;
  // Room TV only accepts native navigation/typing for its room controls.
  if (room) {
    if (key === "Escape") closeModal(app);
    return;
  }
  const helpOpen = Boolean(app.querySelector("[data-tv-help]"));
  const modalOpen = Boolean(app.querySelector(".scorekeeper-modal-backdrop"));

  if (key === "/" || event.code === "NumpadDivide") {
    event.preventDefault();
    if (helpOpen) closeModal(app);
    else openTvHelp(app);
    return;
  }
  if (helpOpen) {
    if (key === "Escape") closeModal(app);
    return;
  }
  if (modalOpen) {
    if (key === "Escape") closeModal(app);
    return;
  }
  if (event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;

  if (/^[1-7]$/.test(key)) {
    event.preventDefault();
    mutateTvState(app, () => {
      state.points[state.breakPlayer] += Number(key);
      state.strokeScore += Number(key);
    });
    return;
  }
  if (key === "8") {
    event.preventDefault();
    mutateTvState(app, () => {
      const beneficiary = state.breakPlayer === 0 ? 1 : 0;
      state.points[beneficiary] += 7;
      state.breakPlayer = beneficiary;
      state.strokeScore = 0;
    });
    return;
  }
  if (key === "9") {
    event.preventDefault();
    mutateTvState(app, () => {
      state.points = [0, 0];
      state.strokeScore = 0;
    });
    return;
  }
  if (key === "." || event.code === "NumpadDecimal") {
    event.preventDefault();
    mutateTvState(app, () => {
      state.points = [0, 0];
      state.wins = [0, 0];
      state.history = [];
      state.breakPlayer = 0;
      state.strokeScore = 0;
      applyOpening(state);
    });
    return;
  }
  if (key === "*" || event.code === "NumpadMultiply") {
    event.preventDefault();
    openNamesModal(app, renderPlacarTv);
    return;
  }
  if (key === "0") {
    event.preventDefault();
    mutateTvState(app, () => {
      state.breakPlayer = state.breakPlayer === 0 ? 1 : 0;
      state.strokeScore = 0;
    });
    return;
  }
  if (key === "+" || event.code === "NumpadAdd") {
    event.preventDefault();
    mutateTvState(app, () => {
      state.points[state.breakPlayer] += 1;
      state.strokeScore += 1;
    });
    return;
  }
  if (key === "-" || event.code === "NumpadSubtract") {
    event.preventDefault();
    if (state.points[state.breakPlayer] > 0) {
      mutateTvState(app, () => {
        state.points[state.breakPlayer] -= 1;
        state.strokeScore = Math.max(0, state.strokeScore - 1);
      });
    }
    return;
  }
  if (key === "Backspace") {
    event.preventDefault();
    undoTvAction(app);
    return;
  }
  if (key === "Enter" || event.code === "NumpadEnter") {
    event.preventDefault();
    finishTvFrame(app);
  }
}

function mutateTvState(app, action) {
  tvUndoStack.push(snapshotTvState());
  if (tvUndoStack.length > 100) tvUndoStack.shift();
  action();
  saveState();
  renderState(app);
}

function snapshotTvState() {
  return {
    points: [...state.points],
    wins: [...state.wins],
    history: state.history.map((frame) => ({ ...frame, points: [...frame.points] })),
    breakPlayer: state.breakPlayer,
    strokeScore: state.strokeScore,
  };
}

function undoTvAction(app) {
  const previous = tvUndoStack.pop();
  if (!previous) return;
  state.points = previous.points;
  state.wins = previous.wins;
  state.history = previous.history;
  state.breakPlayer = previous.breakPlayer;
  state.strokeScore = previous.strokeScore;
  saveState();
  renderState(app);
}

function finishTvFrame(app) {
  const [first, second] = state.points;
  if (first === 0 && second === 0) {
    showNotice(app, "Partida não iniciada", "Marque os pontos antes de finalizar a partida.");
    return;
  }
  if (first === second) {
    showNotice(app, "Placar empatado", "Defina o vencedor da partida antes de finalizá-la.");
    return;
  }

  mutateTvState(app, () => {
    const winner = first > second ? 0 : 1;
    state.wins[winner] += 1;
    state.history.push({ date: new Date().toISOString(), points: [first, second], winner });
    state.points = [0, 0];
    state.strokeScore = 0;
    applyOpening(state);
  });
}

function openTvHelp(app) {
  if (room) return showNotice(app, "TV conectada à sala", "Os pontos são controlados pelo telefone. Nesta TV, o teclado não altera a partida.");
  openModal(app, `<div data-tv-help>
    <div class="scorekeeper-modal-icon"><i class="bi bi-keyboard-fill"></i></div>
    <h2>Controles do placar</h2>
    <dl class="scorekeeper-tv-key-list">
      <div><dt><kbd>0</kbd></dt><dd>Troca a tacada</dd></div>
      <div><dt><kbd>1–7</kbd></dt><dd>Adiciona pontos ao jogador na tacada</dd></div>
      <div><dt><kbd>8</kbd></dt><dd>Falta: soma 7 ao adversário e passa a tacada</dd></div>
      <div><dt><kbd>9</kbd></dt><dd>Zera os pontos sem finalizar a partida</dd></div>
      <div><dt><kbd>.</kbd></dt><dd>Reinicia pontos, partidas e histórico</dd></div>
      <div><dt><kbd>*</kbd></dt><dd>Altera os nomes dos jogadores</dd></div>
      <div><dt><kbd>+</kbd> <kbd>−</kbd></dt><dd>Corrige um ponto do jogador na tacada</dd></div>
      <div><dt><kbd>Backspace</kbd></dt><dd>Desfaz a última ação</dd></div>
      <div><dt><kbd>Enter</kbd></dt><dd>Finaliza a partida</dd></div>
    </dl>
    <p class="scorekeeper-tv-help-close">Pressione <kbd>/</kbd> ou <kbd>Esc</kbd> para fechar.</p>
  </div>`);
}

function setupScreenWakeLock(app) {
  cleanupScreenWakeLock();
  if (!("wakeLock" in navigator)) return;

  const session = ++wakeLockSession;
  wakeLockVisibilityHandler = () => {
    if (document.visibilityState === "visible") requestScreenWakeLock(app, session);
  };
  wakeLockRouteHandler = () => {
    if (!document.querySelector(".scorekeeper-page, .scorekeeper-tv-page")) cleanupScreenWakeLock();
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
    !app.querySelector(".scorekeeper-page, .scorekeeper-tv-page")
  ) return;

  try {
    const sentinel = await navigator.wakeLock.request("screen");
    if (session !== wakeLockSession || !app.querySelector(".scorekeeper-page, .scorekeeper-tv-page")) {
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

function scorekeeperPlayer(index) {
  return `<article class="scorekeeper-player" data-player="${index}">
    <div class="scorekeeper-player-score">
      <div class="scorekeeper-player-identity">
        <span class="scorekeeper-player-turn" aria-hidden="true"><i class="bi bi-play-fill"></i></span>
        <h2 data-player-name="${index}">${escapeHtml(state.names[index] || `Jogador ${index + 1}`)}</h2>
        <span class="scorekeeper-opening-badge" data-opening-player="${index}" hidden><img src="${ballAsset("BallIcon.svg")}" alt=""> SAÍDA</span>
      </div>
      <strong data-player-points="${index}">${state.points[index]}</strong>
    </div>
  </article>`;
}

function pointButtons() {
  return `<div class="scorekeeper-balls">
    ${BALLS.map((ball) => `<button type="button" class="scorekeeper-ball-button" data-score-points="${ball.points}" aria-label="Adicionar ${ball.points} ${ball.points === 1 ? "ponto" : "pontos"} pela bola ${ball.name.toLowerCase()}">
      <span>+${ball.points}</span><img src="${ballAsset(ball.image)}" alt="">
    </button>`).join("")}
    <button type="button" class="scorekeeper-ball-button scorekeeper-penalty-button" data-score-penalty aria-label="Marcar falta de sete pontos">
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
  app.querySelector("[data-first-starter]")?.addEventListener("change", (event) => {
    if (room && !room.editable) { renderState(app); return; }
    state.firstStarter = event.target.value === "" ? null : Number(event.target.value);
    // Correção da configuração durante uma partida não interrompe a tacada em curso.
    if (state.points.every((points) => points === 0) && state.strokeScore === 0) applyOpening(state);
    saveState();
    renderState(app);
  });
  app.querySelector("[data-undo-action]")?.addEventListener("click", () => {
    if (room) { room.undo(); return; }
    const previous = localUndoStack.pop();
    if (!previous) return;
    state = structuredClone(previous);
    lastLocalState = structuredClone(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderState(app);
  });
  app.querySelectorAll("[data-score-points]").forEach((button) => button.addEventListener("click", () => {
    addStrokePoints(Number(button.dataset.scorePoints), app);
  }));
  app.querySelector("[data-score-penalty]")?.addEventListener("click", () => {
    const beneficiary = state.breakPlayer === 0 ? 1 : 0;
    state.points[beneficiary] += 7;
    state.breakPlayer = beneficiary;
    state.strokeScore = 0;
    saveState();
    renderState(app);
  });
  app.querySelector("[data-switch-turn]")?.addEventListener("click", () => switchTurn(app));
  app.querySelector("[data-edit-names]")?.addEventListener("click", () => openNamesModal(app));
  app.querySelector("[data-show-balls]")?.addEventListener("click", () => openBallsModal(app));
  app.querySelector("[data-tv-mode]")?.addEventListener("click", () => navigate("/placar/tv"));
  app.querySelector("[data-reset-frame]")?.addEventListener("click", () => confirmAction(app, "Reiniciar os pontos?", "Os pontos da partida atual voltarão para zero.", () => {
    state.points = [0, 0];
    state.strokeScore = 0;
    saveState();
    renderState(app);
  }));
  app.querySelector("[data-finish-frame]")?.addEventListener("click", () => finishFrame(app));
  app.querySelector("[data-finish-match]")?.addEventListener("click", () => openResultModal(app));
}

function addStrokePoints(amount, app) {
  state.points[state.breakPlayer] += amount;
  state.strokeScore += amount;
  saveState();
  renderState(app);
}

function switchTurn(app) {
  state.breakPlayer = state.breakPlayer === 0 ? 1 : 0;
  state.strokeScore = 0;
  saveState();
  renderState(app);
}

function renderState(app) {
  const starter = openingPlayer(state);
  const select = app.querySelector("[data-first-starter]");
  if (select) {
    [0, 1].forEach((index) => {
      select.options[index + 1].textContent = state.names[index] || `Jogador ${index + 1}`;
    });
    select.value = state.firstStarter === 0 || state.firstStarter === 1 ? String(state.firstStarter) : "";
    select.disabled = !!room && !room.editable;
  }
  app.querySelectorAll("[data-opening-player]").forEach((element) => {
    element.hidden = Number(element.dataset.openingPlayer) !== starter;
  });
  const tvOpening = app.querySelector("[data-tv-opening]");
  if (tvOpening) {
    tvOpening.hidden = starter === null;
    tvOpening.setAttribute("aria-label", starter === null ? "Saída não definida" : `Saída: ${state.names[starter] || `Jogador ${starter + 1}`}`);
    tvOpening.querySelectorAll("[data-opening-arrow]").forEach((arrow) => {
      arrow.style.visibility = Number(arrow.dataset.openingArrow) === starter ? "visible" : "hidden";
    });
  }
  const undo = app.querySelector("[data-undo-action]");
  if (undo) undo.disabled = room ? !room.editable || !room.undoStack.length : !localUndoStack.length;
  app.querySelectorAll("[data-player-points]").forEach((element) => {
    element.textContent = state.points[Number(element.dataset.playerPoints)];
  });
  app.querySelectorAll("[data-wins]").forEach((element) => {
    element.textContent = state.wins[Number(element.dataset.wins)];
  });
  app.querySelectorAll("[data-tv-points]").forEach((element) => {
    element.textContent = state.points[Number(element.dataset.tvPoints)];
  });
  app.querySelectorAll("[data-tv-player]").forEach((element) => {
    element.classList.toggle("is-active", Number(element.dataset.tvPlayer) === state.breakPlayer);
  });
  const strokeOutput = app.querySelector("[data-tv-stroke]");
  if (strokeOutput) strokeOutput.textContent = state.strokeScore;
  app.querySelectorAll("[data-player-name]").forEach((element) => {
    element.textContent = state.names[Number(element.dataset.playerName)] || `Jogador ${Number(element.dataset.playerName) + 1}`;
  });
  app.querySelectorAll("[data-player]").forEach((element) => {
    element.classList.toggle("is-active", Number(element.dataset.player) === state.breakPlayer);
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
    state.strokeScore = 0;
    applyOpening(state);
    saveState();
    renderState(app);
  });
}

function openNamesModal(app, renderAfterSave = renderPlacar, resetOnClose = false) {
  const version = room?.version;
  openModal(app, `<div class="scorekeeper-modal-icon"><i class="bi bi-people-fill"></i></div>
    <h2>Nome dos jogadores</h2>
    <p>${room ? "Os nomes serão atualizados para todos os espectadores da sala." : "Os nomes ficam salvos somente neste dispositivo."}</p>
    <div class="scorekeeper-name-fields">
      <label>Jogador 1<input type="text" maxlength="40" value="${escapeHtml(state.names[0])}" data-name-input="0" placeholder="Jogador 1"></label>
      <label>Jogador 2<input type="text" maxlength="40" value="${escapeHtml(state.names[1])}" data-name-input="1" placeholder="Jogador 2"></label>
    </div>
    <div class="scorekeeper-modal-actions"><button class="btn btn-outline" type="button" data-modal-close>Cancelar</button><button class="btn btn-primary" type="button" data-save-names>Confirmar</button></div>`, (modal) => {
    if (resetOnClose) {
      modal.querySelector("[data-modal-close]")?.addEventListener("click", resetPageScroll);
    }
    modal.querySelector("[data-save-names]").addEventListener("click", () => {
      if (room && (!room.editable || version !== room.version)) { closeModal(app); return; }
      state.names = [0, 1].map((index) => modal.querySelector(`[data-name-input="${index}"]`).value.trim() || `Jogador ${index + 1}`);
      saveState();
      closeModal(app);
      if (!room) renderAfterSave();
      if (resetOnClose) resetPageScroll();
    });
  }, Boolean(state.names[0] && state.names[1]));
}

function openBallsModal(app) {
  openModal(app, `<div class="scorekeeper-modal-icon"><i class="bi bi-circle-fill"></i></div><h2>Bolas e mesa</h2>
    <p>As bolas valem de 1 a 7 pontos. Use a penalidade para creditar 7 pontos ao adversário e transferir a tacada.</p>
    <div class="scorekeeper-ball-legend">${[{ points: 0, name: "Tacadeira", image: "branca.svg" }, ...BALLS].map((ball) => `<div><img src="${ballAsset(ball.image)}" alt=""><span>${ball.name}</span><strong>${ball.points ? `${ball.points} ${ball.points === 1 ? "ponto" : "pontos"}` : "Branca"}</strong></div>`).join("")}</div>
    <img class="scorekeeper-table-map" src="${ballAsset("mapa-regra-brasileira.svg")}" alt="Mapa da mesa da Regra Brasileira">
    <p class="scorekeeper-table-size">Medidas da mesa nacional: 3,10 m × 1,70 m</p>
    <div class="scorekeeper-reference scorekeeper-rule-reference">
      <h3>Diferenças máximas</h3>
      ${maximumDifference("azul.svg", "Azul", "46 pontos", "Preta (N) → Azul (V) → Preta (L) → Preta (N) → Rosa (V) → Preta (L) → Preta (V)")}
      ${maximumDifference("rosa.svg", "Rosa", "27 pontos", "Preta (N) → Rosa (V) → Preta (L) → Preta (V)")}
      ${maximumDifference("preta.svg", "Preta", "7 pontos", "Preta (V)")}
    </div>
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
      state.breakPlayer = 0; state.strokeScore = 0;
      applyOpening(state);
      saveState(); closeModal(app); if (!room) renderPlacar();
    }));
  });
}

function confirmAction(app, title, message, action) {
  const version = room?.version;
  openModal(app, `<div class="scorekeeper-modal-icon is-warning"><i class="bi bi-exclamation-triangle"></i></div><h2>${title}</h2><p>${message}</p><div class="scorekeeper-modal-actions"><button class="btn btn-outline" type="button" data-modal-close>Cancelar</button><button class="btn btn-primary" type="button" data-modal-confirm>Confirmar</button></div>`, (modal) => modal.querySelector("[data-modal-confirm]").addEventListener("click", () => { closeModal(app); if (room && (!room.editable || version !== room.version)) return; action(); }));
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
  modal.querySelector("input, button")?.focus({ preventScroll: true });
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
        breakPlayer: Number(saved.breakPlayer) === 1 ? 1 : 0,
        strokeScore: validNumber(saved.strokeScore),
        firstStarter: saved.firstStarter === 0 || saved.firstStarter === 1 ? saved.firstStarter : null,
      };
    }
  } catch {}
  return { names: ["", ""], points: [0, 0], wins: [0, 0], history: [], breakPlayer: 0, strokeScore: 0, firstStarter: null };
}

function saveState() {
  if (!room) {
    if (!roomTv && JSON.stringify(lastLocalState) !== JSON.stringify(state)) {
      localUndoStack.push(structuredClone(lastLocalState));
      if (localUndoStack.length > 100) localUndoStack.shift();
    }
    lastLocalState = structuredClone(state);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return;
  }
  const candidate = structuredClone(state);
  state = room.state ? structuredClone(room.state) : blankState();
  room.submit(candidate);
}
function validNumber(value) { return Math.max(0, Number.parseInt(value, 10) || 0); }
function ballAsset(file) { return withBasePath(`/assets/images/regulamento/${file}`); }
function formatDate(value) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
function escapeHtml(value = "") { const span = document.createElement("span"); span.textContent = String(value); return span.innerHTML; }
