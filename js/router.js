import { renderHome } from "./pages/home.js";
import { renderSerieA } from "./pages/serieA.js";
import { renderSerieB } from "./pages/serieB.js";

const routes = {
  "/": renderHome,
  "/serie-a": renderSerieA,
  "/serie-b": renderSerieB,
};

export function router() {
  const path = window.location.pathname;

  const page = routes[path] || renderHome;

  page();
}

export function navigate(path) {
  window.history.pushState({}, "", path);

  router();
}

// permite voltar/avançar do navegador
window.addEventListener("popstate", router);

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-route]");

  if (button) {
    const route = button.dataset.route;

    navigate(route);
  }
});
