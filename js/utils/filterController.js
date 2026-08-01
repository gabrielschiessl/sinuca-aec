export function initFilters() {
  const roundFilter =
    document.getElementById("filter-round");

  const playerFilter =
    document.getElementById("filter-player");

  if (!roundFilter || !playerFilter) {
    return;
  }

  roundFilter.addEventListener(
    "change",
    applyFilters
  );

  playerFilter.addEventListener(
    "change",
    applyFilters
  );
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