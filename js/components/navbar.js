import { BASE_PATH } from "../config.js";

export function renderNavbar({ title = "" } = {}) {
  const alternateDivision =
    title === "Série A"
      ? { title: "Série B", route: "/serie-b" }
      : title === "Série B"
        ? { title: "Série A", route: "/serie-a" }
        : null;

  return `

<header class="header">

    <div class="header-left">

        <img
            src="${BASE_PATH}/assets/images/logo_branca.png"
            alt="AEC"
            data-route="/"
            class="logo"
        >

    </div>

    <div class="header-center ${alternateDivision ? "has-division-selector" : ""}">
        ${
          title
            ? `
        ${
          alternateDivision
            ? `
        <div class="division-selector">
          <button
            type="button"
            class="division-selector-toggle"
            data-division-toggle
            aria-expanded="false"
            aria-haspopup="menu"
          >
            <i class="bi bi-chevron-down division-selector-arrow"></i>
            <img
              src="${BASE_PATH}/assets/images/esporte_icone_branco.png"
              class="header-center-icon"
              alt=""
            >
            <span class="header-title">${title}</span>
          </button>

          <div class="division-dropdown" role="menu">
            <button
              type="button"
              class="division-dropdown-item"
              data-route="${alternateDivision.route}"
              role="menuitem"
            >
              <img
                src="${BASE_PATH}/assets/images/esporte_icone_branco.png"
                class="division-dropdown-icon"
                alt=""
              >
              <span>${alternateDivision.title}</span>
            </button>
          </div>
        </div>`
            : `
        <img
          src="${BASE_PATH}/assets/images/esporte_icone_branco.png"
          class="header-center-icon"
          alt=""
        >
        <span class="header-title">${title}</span>`
        }
    `
            : ""
        }
    </div>

    <div class="header-right">

        <div class="admin-desktop">
    <button class="btn btn-outline">
        Administrador
    </button>
</div>

<div class="admin-mobile">
    <button class="icon-button">
        <i class="bi bi-person-fill"></i>
    </button>
</div>

    </div>

</header>

`;
}

document.addEventListener("click", (event) => {
  const toggle = event.target.closest("[data-division-toggle]");
  const openSelector = document.querySelector(".division-selector.is-open");

  if (toggle) {
    const selector = toggle.closest(".division-selector");
    const isOpen = selector.classList.toggle("is-open");

    toggle.setAttribute("aria-expanded", String(isOpen));
    return;
  }

  if (openSelector && !event.target.closest(".division-selector")) {
    openSelector.classList.remove("is-open");
    openSelector
      .querySelector("[data-division-toggle]")
      ?.setAttribute("aria-expanded", "false");
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;

  const openSelector = document.querySelector(".division-selector.is-open");
  const toggle = openSelector?.querySelector("[data-division-toggle]");

  openSelector?.classList.remove("is-open");
  toggle?.setAttribute("aria-expanded", "false");
  toggle?.focus();
});
