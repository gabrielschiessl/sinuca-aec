import { renderHome } from "./pages/home.js";
import { renderSerieA } from "./pages/serieA.js";
import { renderSerieB } from "./pages/serieB.js";
import { renderAdministrador } from "./pages/administrador.js";
import { renderRegulamento } from "./pages/regulamento.js";
import { renderHistorico } from "./pages/historico.js";
import { withBasePath, withoutBasePath } from "./config.js";

const routes = {
  "/": renderHome,
  "/serie-a": renderSerieA,
  "/serie-b": renderSerieB,
  "/administrador": renderAdministrador,
  "/regulamento": renderRegulamento,
  "/historico": renderHistorico,
};

export function router() {
  const path = withoutBasePath();

  const page = routes[path] || renderHome;

  page();
}

export function navigate(path) {
  window.history.pushState({}, "", withBasePath(path));

  router();
  resetPageScroll();
}

// permite voltar/avançar do navegador
window.addEventListener("popstate", () => {
  router();
  resetPageScroll();
});

export function resetPageScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-route]");

  if (button) {
    const route = button.dataset.route;

    navigate(route);
  }
});
