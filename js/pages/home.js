import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";
import { navigate } from "../router.js";
import { menuButton } from "../components/menuButton.js";
import { getKnownCurrentSeason, setKnownCurrentSeason, withBasePath } from "../config.js";
import { getTemporadas } from "../api.js";

export function renderHome() {
  const app = document.getElementById("app");
  const knownSeason = getKnownCurrentSeason();

  app.innerHTML = `
${renderNavbar()}

<main>
  <section class="hero">
    <img src="${withBasePath("/assets/images/esporte_page-bg.svg")}" class="hero-logo" alt="Sinuca" />

    <p class="hero-subtitle" data-home-season>Clube AEC • Temporada ${knownSeason}</p>

    <div class="buttons">

    ${menuButton({
      route: "/serie-a",
      icon: "bi bi-trophy-fill",
      text: "Série A",
    })}


    ${menuButton({
      route: "/serie-b",
      icon: "bi bi-award-fill",
      text: "Série B",
    })}

    ${menuButton({
      route: "/regra",
      icon: "bi bi-journal-text",
      text: "Regra",
    })}

    ${menuButton({
      route: "/historico",
      icon: "bi bi-clock-history",
      text: "Histórico",
    })}

    ${menuButton({
      route: "/ranking",
      icon: "bi bi-list-ol",
      text: "Ranking",
    })}

</div>
  </section>

  ${renderFooter()}
</main>`;

  loadHomeMetadata(app.querySelector(".hero"));
}

async function loadHomeMetadata(page) {
  try {
    const data = await getTemporadas();
    if (!page?.isConnected) return;
    const currentSeason = Number(data.temporada_atual);
    if (currentSeason) setKnownCurrentSeason(currentSeason);
    const subtitle = page.querySelector("[data-home-season]");
    if (subtitle && currentSeason) {
      subtitle.textContent = `Clube AEC • Temporada ${currentSeason}`;
    }
  } catch (error) {
    // A navegação principal continua disponível durante indisponibilidades da API.
  }
}
