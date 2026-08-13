let resetGeneration = 0;
let savedScrollBehavior;
let routeResetTimer;

export function resetPageScroll() {
  const root = document.documentElement;
  const generation = ++resetGeneration;

  if (savedScrollBehavior === undefined) {
    savedScrollBehavior = root.style.scrollBehavior;
  }

  root.style.setProperty("scroll-behavior", "auto", "important");
  root.classList.add("is-resetting-page-scroll");
  window.clearTimeout(routeResetTimer);

  const reset = () => {
    const scrollingElement = document.scrollingElement || root;
    scrollingElement.scrollTop = 0;
    scrollingElement.scrollLeft = 0;
    root.scrollTop = 0;
    root.scrollLeft = 0;
    document.body.scrollTop = 0;
    document.body.scrollLeft = 0;
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    } catch (error) {
      window.scrollTo(0, 0);
    }
  };

  reset();
  requestAnimationFrame(() => {
    reset();
    requestAnimationFrame(reset);
  });

  // O Safari pode restaurar a posição antiga após terminar o novo layout.
  // Mantemos o comportamento instantâneo até passar essa restauração tardia.
  [50, 150].forEach((delay, index, delays) => {
    setTimeout(() => {
      if (generation !== resetGeneration) return;
      reset();
      if (index === delays.length - 1) {
        if (savedScrollBehavior) {
          root.style.scrollBehavior = savedScrollBehavior;
        } else {
          root.style.removeProperty("scroll-behavior");
        }
        savedScrollBehavior = undefined;
        routeResetTimer = window.setTimeout(() => {
          if (generation === resetGeneration) {
            root.classList.remove("is-resetting-page-scroll");
          }
        }, 200);
      }
    }, delay);
  });
}
