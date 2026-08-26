export function initFilters() {
  const roundFilter =
    document.getElementById("filter-round");

  const playerFilter =
    document.getElementById("filter-player");

  const pendingFilter =
    document.getElementById("filter-pending");

  if (!roundFilter || !playerFilter) {
    return;
  }

  const filters = document.querySelector(".filters");

  roundFilter.addEventListener(
    "change",
    applyFilters
  );

  playerFilter.addEventListener(
    "change",
    applyFilters
  );

  pendingFilter?.addEventListener(
    "change",
    applyFilters,
  );

  if (filters) {
    const updateStickyState = () => {
      if (!filters.isConnected) {
        window.removeEventListener("scroll", updateStickyState);
        window.removeEventListener("resize", updateStickyState);
        return;
      }

      const headerHeight = Number.parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--header-height",
        ),
      );
      const stickyTop = headerHeight + 48;

      filters.classList.toggle(
        "is-stuck",
        filters.getBoundingClientRect().top <= stickyTop,
      );
    };

    window.addEventListener("scroll", updateStickyState, { passive: true });
    window.addEventListener("resize", updateStickyState);
    updateStickyState();
  }
}

function applyFilters() {
  const selectedRound =
    document.getElementById("filter-round").value;

  const selectedPlayer =
    document.getElementById("filter-player").value;

  const onlyPending =
    document.getElementById("filter-pending")?.checked || false;

  const groups =
    document.querySelectorAll(".round-group");

  groups.forEach((group) => {
    const matchesRound =
      selectedRound === "" ||
      group.dataset.round === selectedRound;

    const cards =
      group.querySelectorAll(".match-card");

    let visibleCards = 0;

    cards.forEach((card) => {
      const matchesPlayer =
        selectedPlayer === "" ||
        card.dataset.player1 === selectedPlayer ||
        card.dataset.player2 === selectedPlayer;

      const matchesPending =
        !onlyPending || card.dataset.status === "A";

      const shouldShow =
        matchesRound && matchesPlayer && matchesPending;

      card.style.display =
        shouldShow ? "" : "none";

      if (shouldShow) {
        visibleCards += 1;
      }
    });

    group.style.display =
      matchesRound && visibleCards > 0
        ? ""
        : "none";
  });

  const hasVisibleGroups = [...groups].some(
    (group) => group.style.display !== "none",
  );
  const emptyState = document.querySelector("[data-round-filter-empty]");
  if (emptyState) {
    emptyState.hidden = hasVisibleGroups;
    const message = emptyState.querySelector("p");
    if (message) {
      message.textContent = onlyPending
        ? "Nenhuma partida pendente encontrada com os filtros selecionados."
        : "Nenhuma partida encontrada com os filtros selecionados.";
    }
  }
}
