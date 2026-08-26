import { withoutBasePath } from "../config.js";

const SHOW_AFTER_PX = 320;

export function initBackToTopButton() {
  const button = document.createElement("button");
  button.className = "back-to-top";
  button.type = "button";
  button.hidden = true;
  button.setAttribute("aria-label", "Voltar ao topo da página");
  button.setAttribute("title", "Voltar ao topo");
  button.innerHTML = '<i class="bi bi-arrow-up" aria-hidden="true"></i>';
  document.body.appendChild(button);

  const updateVisibility = () => {
    const isHome = withoutBasePath() === "/";
    button.hidden = isHome || window.scrollY <= SHOW_AFTER_PX;
  };

  button.addEventListener("click", () => {
    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    window.scrollTo({ top: 0, left: 0, behavior });
  });

  window.addEventListener("scroll", updateVisibility, { passive: true });
  window.addEventListener("app:route-rendered", updateVisibility);
  updateVisibility();
}
