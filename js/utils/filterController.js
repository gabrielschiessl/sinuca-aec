export function initFilters() {
  const roundFilter =
    document.getElementById("filter-round");

  const playerFilter =
    document.getElementById("filter-player");

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

      const shouldShow =
        matchesRound && matchesPlayer;

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
}
