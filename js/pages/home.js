import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";

export function renderHome() {
  const app = document.getElementById("app");

  app.innerHTML = `
${renderNavbar()}

<main>
  <section class="hero">
    <img src="assets/images/esporte_grena.png" class="hero-logo" alt="Sinuca" />

    <p class="hero-subtitle">Clube AEC • Temporada 2026</p>

    <div class="buttons">

    <button class="menu-button">

        <i class="bi bi-trophy-fill"></i>

        <span>Série A</span>

    </button>

    <button class="menu-button">

        <i class="bi bi-award-fill"></i>

        <span>Série B</span>

    </button>

</div>
  </section>

  ${renderFooter()}
</main>`;
}
