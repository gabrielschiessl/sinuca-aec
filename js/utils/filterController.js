export function initFilters() {
  const roundFilter = document.getElementById("filter-round");

  if (!roundFilter) return;

  roundFilter.addEventListener("change", filterRounds);
}

function filterRounds(event) {

    const selectedRound = event.target.value;

    const groups = document.querySelectorAll(".round-group");

    groups.forEach(group => {

        if (
            selectedRound === "" ||
            group.dataset.round === selectedRound
        ) {

            group.style.display = "";

        } else {

            group.style.display = "none";

        }

    });

}