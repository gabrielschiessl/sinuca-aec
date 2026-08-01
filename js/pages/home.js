import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";
import { navigate } from "../router.js";
import { menuButton } from "../components/menuButton.js";
import { withBasePath } from "../config.js";

export function renderHome() {
  const app = document.getElementById("app");

  app.innerHTML = `
${renderNavbar()}

<main>
  <section class="hero">
    <img src="${withBasePath("/assets/images/esporte_page-bg.png")}" class="hero-logo" alt="Sinuca" />

    <p class="hero-subtitle">Clube AEC • Temporada 2026</p>

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

</div>
  </section>

  ${renderFooter()}
</main>`;
}
