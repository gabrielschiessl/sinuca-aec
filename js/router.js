import { renderHome } from "./pages/home.js";
import { renderSerieA } from "./pages/serieA.js";
import { renderSerieB } from "./pages/serieB.js";
import { renderAdministrador } from "./pages/administrador.js";
import { renderRegra } from "./pages/regra.js";
import { renderHistorico } from "./pages/historico.js";
import { renderRanking } from "./pages/ranking.js";
import { renderPlacar } from "./pages/placar.js";
import { withBasePath, withoutBasePath } from "./config.js";
import { resetPageScroll } from "./utils/pageScroll.js";

export { resetPageScroll };

const routes = {
  "/": renderHome,
  "/serie-a": renderSerieA,
  "/serie-b": renderSerieB,
  "/administrador": renderAdministrador,
  "/regra": renderRegra,
  "/historico": renderHistorico,
  "/ranking": renderRanking,
  "/placar": renderPlacar,
};

export function router() {
  const path = withoutBasePath();

  const page = routes[path] || renderHome;

  page();
  window.dispatchEvent(new CustomEvent("app:route-rendered"));
}

export function navigate(path) {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }

  // Evita que a nova entrada do histórico herde a posição da página atual.
  resetPageScroll();

  const destination = `${withBasePath(path)}${window.location.search}`;

  // No mobile, trocar apenas o conteúdo da Home mantém o mesmo viewport e
  // alguns navegadores carregam a posição rolada no conteúdo seguinte.
  // Uma navegação real ao sair da Home cria um documento novo já no topo.
  if (withoutBasePath() === "/" && path !== "/") {
    window.location.assign(destination);
    return;
  }

  window.history.pushState(
    {},
    "",
    destination,
  );

  router();
  resetPageScroll();
}

// permite voltar/avançar do navegador
window.addEventListener("popstate", () => {
  resetPageScroll();
  router();
  resetPageScroll();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-route]");

  if (button) {
    event.preventDefault();
    button.blur();
    const route = button.dataset.route;

    navigate(route);
  }
});
