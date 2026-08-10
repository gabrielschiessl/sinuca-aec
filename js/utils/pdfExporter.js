export function initPdfExportButtons(container, getContext) {
  container?.querySelectorAll("[data-pdf-export]").forEach((button) => {
    button.addEventListener("click", () => exportSectionToPdf(button, getContext()));
  });
}

function exportSectionToPdf(button, context = {}) {
  const source = document.querySelector(button.dataset.pdfSource);
  if (!source) return;
  const mode = button.dataset.pdfExport;
  const content = buildPrintableContent(source, mode);
  if (!content.childElementCount) return;

  document.querySelector(".pdf-export-root")?.remove();
  document.getElementById("pdf-page-orientation")?.remove();
  const root = document.createElement("main");
  root.className = `pdf-export-root pdf-export-${mode} is-preparing`;
  root.style.padding = mode === "rounds" ? "10mm" : "12px";
  if (mode === "rounds") root.style.width = "210mm";
  const filterRound = document.getElementById("filter-round");
  const filterPlayer = document.getElementById("filter-player");
  const details = [
    context.division ? `Série ${context.division}` : "",
    context.season ? `Temporada ${context.season}` : "",
    mode === "rounds" && filterRound?.selectedOptions[0]?.textContent.trim() !== "Todas as rodadas"
      ? filterRound.selectedOptions[0].textContent.trim()
      : "",
    mode === "rounds" && filterPlayer?.selectedOptions[0]?.textContent.trim() !== "Todos os jogadores"
      ? filterPlayer.selectedOptions[0].textContent.trim()
      : "",
  ].filter(Boolean);
  root.innerHTML = `<header class="pdf-export-header"><h1>AEC Sinuca — ${sectionTitle(mode)}</h1><p>${details.join(" · ")}</p></header>`;
  root.appendChild(content);
  document.body.appendChild(root);

  const pageStyle = document.createElement("style");
  pageStyle.id = "pdf-page-orientation";
  if (mode === "rounds") {
    pageStyle.textContent = "@page { size: A4 portrait; margin: 0; }";
  } else {
    const pageWidth = Math.ceil(root.scrollWidth) + 2;
    const pageHeight = Math.ceil(root.scrollHeight) + 2;
    root.style.width = `${pageWidth}px`;
    pageStyle.textContent = `@page { size: ${pageWidth}px ${pageHeight}px; margin: 0; }`;
  }
  document.head.appendChild(pageStyle);
  root.classList.remove("is-preparing");

  const cleanup = () => {
    root.remove();
    pageStyle.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  requestAnimationFrame(() => window.print());
}

function buildPrintableContent(source, mode) {
  const content = document.createElement("div");
  content.className = "pdf-export-content";
  if (mode === "rounds") {
    source.querySelectorAll(".round-group").forEach((group) => {
      if (!isVisible(group)) return;
      const clone = group.cloneNode(true);
      const originalCards = [...group.querySelectorAll(".match-card")];
      [...clone.querySelectorAll(".match-card")].forEach((card, index) => {
        if (!isVisible(originalCards[index])) card.remove();
      });
      if (clone.querySelector(".match-card")) content.appendChild(clone);
    });
    return content;
  }
  const table = source.querySelector("table");
  if (table) content.appendChild(table.cloneNode(true));
  return content;
}

function isVisible(element) {
  return Boolean(element) && getComputedStyle(element).display !== "none";
}

function sectionTitle(mode) {
  if (mode === "classification") return "Classificação";
  if (mode === "results") return "Resultados";
  return "Rodadas";
}
