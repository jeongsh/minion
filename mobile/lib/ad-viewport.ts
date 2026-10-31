// Only pending, focused placements subscribe. Scroll events share one trailing
// check instead of creating a polling timer or re-rendering the whole screen.
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | undefined;

export function notifyAdViewportChanged() {
  if (!listeners.size || timer !== undefined) return;
  timer = setTimeout(() => {
    timer = undefined;
    listeners.forEach((listener) => listener());
  }, 100);
}

export function subscribeAdViewport(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  };
}
