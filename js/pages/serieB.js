import { renderNavbar } from "../components/navbar.js";
import { renderFooter } from "../components/footer.js";

export function renderSerieB() {
  const app = document.getElementById("app");

  app.innerHTML = `${renderNavbar({ title: "Série B" })}
    <main class="serie-page">
      <section>
        <h1 class="section-heading-title">Campeonato Série B</h1>
      </section>

      ${renderFooter("footer-light")}
    </main>`;
}
