export function statusBadge(status) {
  return `

    <span class="status-badge ${status.classe}">

    ${status.codigo === "V" ? '<span class="live-dot"></span>' : ""}

      ${
        status.codigo === "V"
          ? '<span class="status-label full">Em andamento</span><span class="status-label compact">Ao vivo</span>'
          : status.descricao
      }

    </span>

  `;
}
