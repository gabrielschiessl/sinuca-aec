import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";
import { tabs } from "../components/tabs.js";
import { withBasePath } from "../config.js";

export function renderRegra() {
  const app = document.getElementById("app");

  app.innerHTML = `
    ${renderNavbar({ title: "Regra" })}
    ${tabs([
      { id: "regra", label: "Regra", icon: "bi bi-journal-text" },
      { id: "bolas", label: "Bolas", icon: "bi bi-circle-fill" },
      { id: "regulamento", label: "Regulamento", icon: "bi bi-clipboard-check" },
    ])}

    <main class="rules-page">
      <section id="regra" class="rules-section">
        <div class="rules-intro">
          <i class="bi bi-journal-check" aria-hidden="true"></i>
          <div>
            <h1>Regra Brasileira de Sinuca</h1>
            <p>Consulte os artigos e procedimentos utilizados nas partidas.</p>
          </div>
        </div>
        <div class="rules-articles" id="rules-articles">
          <div class="loading-state" role="status">
            <div class="loading-spinner" aria-hidden="true"></div>
            <p>Carregando regra...</p>
          </div>
        </div>
      </section>

      <section id="regulamento" class="rules-section" style="display: none">
        <div class="rules-intro">
          <i class="bi bi-clipboard-check" aria-hidden="true"></i>
          <div>
            <h1>Regulamento dos Campeonatos</h1>
            <p>Consulte as normas de organização e disputa das Séries A e B.</p>
          </div>
        </div>
        <div class="rules-articles" id="championship-regulations">
          <div class="loading-state" role="status">
            <div class="loading-spinner" aria-hidden="true"></div>
            <p>Carregando regulamento...</p>
          </div>
        </div>
      </section>

      <section id="bolas" class="rules-section" style="display: none">
        <div class="balls-panel">
          <h1>Bolas e pontuação</h1>
          <div class="balls-grid">
            ${renderBola("branca.svg", "Tacadeira", "Bola branca")}
            ${renderBola("vermelha.svg", "1 ponto", "Bola vermelha")}
            ${renderBola("amarela.svg", "2 pontos", "Bola amarela")}
            ${renderBola("verde.svg", "3 pontos", "Bola verde")}
            ${renderBola("marrom.svg", "4 pontos", "Bola marrom")}
            ${renderBola("azul.svg", "5 pontos", "Bola azul")}
            ${renderBola("rosa.svg", "6 pontos", "Bola rosa")}
            ${renderBola("preta.svg", "7 pontos", "Bola preta")}
          </div>

          <figure class="rules-map">
            <img
              src="${withBasePath("/assets/images/regulamento/mapa-regra-brasileira.svg")}"
              alt="Mapa da disposição das bolas na mesa de sinuca brasileira"
            >
            <figcaption>Mesa nacional: 3,10 m × 1,70 m</figcaption>
          </figure>

          <div class="max-breaks">
            <div class="max-breaks-heading">
              <div>
                <h2>Maiores tacadas no fim da partida</h2>
                <p>Sequências máximas possíveis a partir das bolas 5, 6 e 7.</p>
              </div>
              <div class="sequence-legend" aria-label="Legenda das sequências">
                <span><strong>N</strong> Numerada</span>
                <span><strong>V</strong> Da vez</span>
                <span><strong>L</strong> Livre</span>
              </div>
            </div>

            ${renderSequence(
              "Bola 5 da vez",
              46,
              [
                ["preta.svg", "N"],
                ["azul.svg", "V"],
                ["preta.svg", "L"],
                ["preta.svg", "N"],
                ["rosa.svg", "V"],
                ["preta.svg", "L"],
                ["preta.svg", "V"],
              ],
            )}
            ${renderSequence("Bola 6 da vez", 27, [
              ["preta.svg", "N"],
              ["rosa.svg", "V"],
              ["preta.svg", "L"],
              ["preta.svg", "V"],
            ])}
            ${renderSequence("Bola 7 da vez", 7, [["preta.svg", "V"]])}
          </div>
        </div>
      </section>

      ${renderFooter("footer-light")}
    </main>
  `;

  initRulesTabs();
  loadRulesContent("rules-articles", "/assets/content/regra.html", "regra");
  loadRulesContent("championship-regulations", "/assets/content/regulamento.html", "regulamento");
}

async function loadRulesContent(elementId, path, contentName) {
  const content = document.getElementById(elementId);
  if (!content) return;

  try {
    const response = await fetch(
      withBasePath(path),
    );

    if (!response.ok) throw new Error(`${contentName} indisponível.`);

    const html = await response.text();
    if (content.isConnected) content.innerHTML = html;
  } catch (error) {
    if (!content.isConnected) return;

    content.innerHTML = `
      <div class="error-state" role="alert">
        <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
        <p>Não foi possível carregar o ${contentName}.</p>
      </div>`;
  }
}

function renderBola(arquivo, valor, nome) {
  return `
    <div class="ball-item">
      <img
        src="${withBasePath(`/assets/images/regulamento/${arquivo}`)}"
        alt="${nome}"
      >
      <span>${valor}</span>
    </div>`;
}

function renderSequence(titulo, total, passos) {
  return `
    <div class="sequence-card">
      <div class="sequence-summary">
        <strong>${titulo}</strong>
        <span>${total} pontos</span>
      </div>
      <div class="sequence-flow">
        ${passos
          .map(
            ([arquivo, tipo], index) => `
              ${index ? '<span class="sequence-arrow" aria-hidden="true">→</span>' : ""}
              <div class="sequence-step" title="${sequenceTypeName(tipo)}">
                <img
                  src="${withBasePath(`/assets/images/regulamento/${arquivo}`)}"
                  alt=""
                >
                <span>${tipo}</span>
              </div>`,
          )
          .join("")}
      </div>
    </div>`;
}

function sequenceTypeName(tipo) {
  return { N: "Numerada", V: "Da vez", L: "Livre" }[tipo];
}

function initRulesTabs() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      document
        .querySelectorAll(".tab-button")
        .forEach((item) => item.classList.remove("active"));

      button.classList.add("active");

      document
        .querySelectorAll("#regra, #bolas, #regulamento")
        .forEach((section) => (section.style.display = "none"));

      document.getElementById(button.dataset.tab).style.display = "block";
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}
