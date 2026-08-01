export function statusBadge(status) {
  return `

    <span class="status-badge ${status.classe}">

    ${status.codigo === "V" ? '<span class="live-dot"></span>' : ""}

      ${status.descricao}

    </span>

  `;
}
