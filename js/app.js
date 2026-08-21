import { resetPageScroll, router } from "./router.js";
import { BASE_PATH } from "./config.js";

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

router();
resetPageScroll();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const scope = `${BASE_PATH || ""}/`;
    navigator.serviceWorker.register(`${scope}service-worker.js`, { scope })
      .catch((error) => {
        console.warn("Não foi possível registrar o service worker.", error);
      });
  });
}
