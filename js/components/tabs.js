export function tabs(items) {
  return `

<nav class="tabs">


${items
  .map(
    (tab) => `


<button

class="tab-button ${tab.id === "rodadas" ? "active" : ""}"

data-tab="${tab.id}"

>

${tab.label}

</button>


`,
  )
  .join("")}


</nav>


`;
}
