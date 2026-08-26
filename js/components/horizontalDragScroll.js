export function setupHorizontalDragScroll(root = document) {
  root.querySelectorAll("[data-horizontal-drag]").forEach(setupDragContainer);
}

function setupDragContainer(container) {
  if (container.dataset.horizontalDragReady === "true") return;
  container.dataset.horizontalDragReady = "true";

  let pointerId = null;
  let startX = 0;
  let startScrollLeft = 0;
  let dragged = false;

  const updateAvailability = () => {
    container.classList.toggle(
      "is-horizontally-draggable",
      container.scrollWidth > container.clientWidth + 1,
    );
  };

  container.addEventListener("pointerdown", (event) => {
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      !container.classList.contains("is-horizontally-draggable")
    ) {
      return;
    }

    pointerId = event.pointerId;
    startX = event.clientX;
    startScrollLeft = container.scrollLeft;
    dragged = false;
    container.setPointerCapture(pointerId);
    container.classList.add("is-dragging");
  });

  container.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    const distance = event.clientX - startX;
    if (Math.abs(distance) > 3) dragged = true;
    container.scrollLeft = startScrollLeft - distance;
    if (dragged) event.preventDefault();
  });

  const finishDrag = (event) => {
    if (event.pointerId !== pointerId) return;
    if (container.hasPointerCapture(pointerId)) {
      container.releasePointerCapture(pointerId);
    }
    pointerId = null;
    container.classList.remove("is-dragging");
  };

  container.addEventListener("pointerup", finishDrag);
  container.addEventListener("pointercancel", finishDrag);
  container.addEventListener("lostpointercapture", () => {
    pointerId = null;
    container.classList.remove("is-dragging");
  });
  container.addEventListener("click", (event) => {
    if (!dragged) return;
    event.preventDefault();
    event.stopPropagation();
    dragged = false;
  }, true);
  container.addEventListener("dragstart", (event) => event.preventDefault());

  if (typeof ResizeObserver === "function") {
    new ResizeObserver(updateAvailability).observe(container);
  }
  updateAvailability();
}
