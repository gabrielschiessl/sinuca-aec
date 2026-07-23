export function renderNavbar() {
  return `

<header class="header">

    <div class="header-left">

        <img
            src="assets/images/logo_branca.png"
            alt="AEC"
            class="logo"
        >

    </div>

    <div class="header-center">

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
