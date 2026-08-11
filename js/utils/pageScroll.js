export function resetPageScroll() {
  const root = document.documentElement;
  const previousBehavior = root.style.scrollBehavior;

  root.style.setProperty("scroll-behavior", "auto", "important");

  const reset = () => {
    const scrollingElement = document.scrollingElement || root;
    scrollingElement.scrollTop = 0;
    scrollingElement.scrollLeft = 0;
    root.scrollTop = 0;
    document.body.scrollTop = 0;
    window.scrollTo(0, 0);
  };

  reset();
  requestAnimationFrame(() => {
    reset();
    setTimeout(() => {
      reset();
      if (previousBehavior) {
        root.style.scrollBehavior = previousBehavior;
      } else {
        root.style.removeProperty("scroll-behavior");
      }
    }, 0);
  });
}
