export function horizontalSwipeHint(context = "ranking") {
  const allowedContexts = new Set(["ranking", "classification", "results"]);
  const normalizedContext = allowedContexts.has(context) ? context : "ranking";
  return `
    <div class="horizontal-swipe-hint horizontal-swipe-hint--${normalizedContext}" aria-hidden="true">
      ${swipeArrow()}
      <span>Arraste para os lados</span>
      ${swipeArrow(true)}
    </div>`;
}

function swipeArrow(pointsRight = false) {
  return `<svg class="horizontal-swipe-arrow ${pointsRight ? "is-right" : ""}" viewBox="0 0 28 18" aria-hidden="true">
    <path d="M25 9H3M8 4 3 9l5 5" />
  </svg>`;
}
