import { resetPageScroll, router } from "./router.js";

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

router();
resetPageScroll();
