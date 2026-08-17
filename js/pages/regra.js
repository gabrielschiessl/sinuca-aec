import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";
import { tabs } from "../components/tabs.js";
import { getTemporadas } from "../api.js";
import { withBasePath } from "../config.js";
import { resetPageScroll } from "../utils/pageScroll.js";

export function renderRegra() {
  const app = document.getElementById("app");

  app.innerHTML = `
    ${renderNavbar({ title: "Regra" })}
    ${tabs([
      { id: "regra", label: "Regra", icon: "bi bi-journal-text" },
      { id: "bolas", label: "Bolas", icon: "bi bi-circle-fill" },
      { id: "regulamento", label: "Regulamento", icon: "bi bi-clipboard-check" },
    ], "rules-tabs")}

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
    if (content.isConnected) {
      content.innerHTML = html;
      if (contentName === "regulamento") hydrateCurrentRegistrationFee(content);
    }
  } catch (error) {
    if (!content.isConnected) return;

    content.innerHTML = `
      <div class="error-state" role="alert">
        <i class="bi bi-exclamation-circle" aria-hidden="true"></i>
        <p>Não foi possível carregar o ${contentName}.</p>
      </div>`;
  }
}

async function hydrateCurrentRegistrationFee(content) {
  try {
    const data = await getTemporadas();
    if (data.taxa_inscricao === null || data.taxa_inscricao === undefined || data.taxa_inscricao === "") return;
    const fee = Number(data.taxa_inscricao);
    if (!Number.isFinite(fee) || fee < 0 || !content.isConnected) return;
    const formatted = fee.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
    });
    content.querySelectorAll("[data-current-registration-fee]")
      .forEach((element) => (element.textContent = formatted));
    content.querySelectorAll("[data-current-registration-fee-words]")
      .forEach((element) => (element.textContent = currencyInPortuguese(fee)));
    content.querySelectorAll("[data-current-registration-fee-details]")
      .forEach((element) => (element.hidden = false));
  } catch (error) {
    // Mantém o valor de referência do documento se a configuração estiver indisponível.
  }
}

function currencyInPortuguese(value) {
  const totalCents = Math.round(value * 100);
  const reais = Math.floor(totalCents / 100);
  const centavos = totalCents % 100;
  const parts = [
    `${numberInPortuguese(reais)} ${reais === 1 ? "real" : "reais"}`,
  ];
  if (centavos) {
    parts.push(`${numberInPortuguese(centavos)} ${centavos === 1 ? "centavo" : "centavos"}`);
  }
  return parts.join(" e ");
}

function numberInPortuguese(value) {
  const units = ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
  const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
  const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
  const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
  const number = Math.max(0, Math.trunc(value));
  if (number < 10) return units[number];
  if (number < 20) return teens[number - 10];
  if (number < 100) {
    const remainder = number % 10;
    return tens[Math.floor(number / 10)] + (remainder ? ` e ${units[remainder]}` : "");
  }
  if (number === 100) return "cem";
  if (number < 1000) {
    const remainder = number % 100;
    return hundreds[Math.floor(number / 100)] + (remainder ? ` e ${numberInPortuguese(remainder)}` : "");
  }
  if (number < 1000000) {
    const thousands = Math.floor(number / 1000);
    const remainder = number % 1000;
    const prefix = thousands === 1 ? "mil" : `${numberInPortuguese(thousands)} mil`;
    return prefix + (remainder ? ` e ${numberInPortuguese(remainder)}` : "");
  }
  return number.toLocaleString("pt-BR");
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
      resetPageScroll();
    });
  });
}
