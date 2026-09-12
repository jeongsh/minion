export type EmbedLoadState = "loading" | "ready" | "error";

/** Observe each widget independently; DOM insertion is not a load-complete signal. */
export function observeEmbedLoading(root: HTMLElement, onState: (state: EmbedLoadState) => void) {
  let frame: HTMLIFrameElement | null = null;
  let src = "";
  let loaded = false;
  let ready = false;
  let size = "";
  let stableTimer: ReturnType<typeof setTimeout> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const selectFrame = () => root.querySelector<HTMLIFrameElement>('iframe.instagram-media,iframe[id^="twitter-widget-"]');
  const reset = () => {
    clearTimeout(stableTimer);
    clearTimeout(timeout);
    loaded = false;
    ready = false;
    size = "";
    root.classList.remove("embed-measured");
    onState("loading");
    timeout = setTimeout(() => onState("error"), 30_000);
  };
  const report = () => {
    const next = selectFrame();
    const nextSrc = next?.getAttribute("src") ?? "";
    if (next !== frame || nextSrc !== src) {
      frame = next;
      src = nextSrc;
      reset();
    }
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    root.classList.toggle("embed-measured", rect.width > 0 && rect.height > 0);
    if (!loaded || rect.width <= 0 || rect.height <= 0) {
      clearTimeout(stableTimer);
      size = "";
      return;
    }
    const nextSize = `${rect.width}:${rect.height}`;
    if (size === nextSize) return;
    size = nextSize;
    clearTimeout(stableTimer);
    const current = frame;
    const currentSrc = src;
    stableTimer = setTimeout(() => {
      if (current !== selectFrame() || currentSrc !== current.getAttribute("src")) return;
      if (!ready) {
        ready = true;
        clearTimeout(timeout);
        onState("ready");
      }
    }, 600);
  };
  const onLoad = (event: Event) => {
    if (event.target !== selectFrame()) return;
    report();
    if (!src || src === "about:blank") return;
    loaded = true;
    size = "";
    report();
  };
  root.addEventListener("load", onLoad, true);
  const mutations = new MutationObserver(report);
  mutations.observe(root, { attributes: true, childList: true, subtree: true });
  const resize = new ResizeObserver(report);
  resize.observe(root);
  // A provider may resize an iframe inside a fixed-height wrapper.
  const poll = setInterval(report, 100);
  reset();
  report();
  return () => {
    root.removeEventListener("load", onLoad, true);
    mutations.disconnect();
    resize.disconnect();
    clearInterval(poll);
    clearTimeout(stableTimer);
    clearTimeout(timeout);
  };
}
