export function tabs(items, className = "") {
  return `

<nav class="tabs${className ? ` ${className}` : ""}">


${items
  .map(
    (tab, index) => `


<button

class="tab-button ${index === 0 ? "active" : ""}"

data-tab="${tab.id}"

>

<i class="${tab.icon}"></i>
  <span>${tab.label}</span>

</button>


`,
  )
  .join("")}


</nav>


`;
}
