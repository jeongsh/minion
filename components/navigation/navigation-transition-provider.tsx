"use client";

import { usePathname, useSearchParams } from "next/navigation";
import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { NavigationLoadingOverlay } from "@/components/navigation/navigation-loading-overlay";

type NavigationTransitionContextValue = {
  isNavigating: boolean;
  startNavigation: (destination?: string) => boolean;
};

const NavigationTransitionContext = createContext<NavigationTransitionContextValue | null>(null);
const PAGE_READY_TIMEOUT_MS = 15_000;
const PAGE_READY_QUIET_MS = 120;
const PAGE_READY_POLL_MS = 50;

function waitForDelay(milliseconds: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds));
}

function waitForFrame() {
  return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
}

function waitUntilDeadline(promise: Promise<unknown>, deadline: number) {
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, Math.max(0, deadline - Date.now()));

    promise
      .catch(() => undefined)
      .then(() => {
        window.clearTimeout(timer);
        resolve();
      });
  });
}

function imageSource(image: HTMLImageElement) {
  if (!image.currentSrc && !image.src && !image.srcset) return "";
  return `${image.currentSrc}|${image.src}|${image.srcset}`;
}

function shouldWaitForImage(image: HTMLImageElement) {
  return image.loading !== "lazy" || image.complete;
}

async function waitForImage(
  image: HTMLImageElement,
  settledSources: WeakMap<HTMLImageElement, string>,
  deadline: number,
) {
  const source = imageSource(image);
  if (!source || settledSources.get(image) === source) return;

  if (!image.complete) {
    await new Promise<void>((resolve) => {
      const remaining = Math.max(0, deadline - Date.now());
      let timer = 0;

      const cleanup = () => {
        image.removeEventListener("load", settle);
        image.removeEventListener("error", settle);
        window.clearTimeout(timer);
      };
      const settle = () => {
        cleanup();
        resolve();
      };

      image.addEventListener("load", settle, { once: true });
      image.addEventListener("error", settle, { once: true });
      timer = window.setTimeout(settle, remaining);

      if (image.complete) {
        settle();
      }
    });
  }

  const remaining = Math.max(0, deadline - Date.now());
  if (image.complete && image.naturalWidth > 0 && typeof image.decode === "function" && remaining > 0) {
    await waitUntilDeadline(image.decode(), deadline);
  }

  settledSources.set(image, imageSource(image));
}

async function waitForPageReady() {
  const deadline = Date.now() + PAGE_READY_TIMEOUT_MS;
  const settledSources = new WeakMap<HTMLImageElement, string>();
  let lastMutationAt = performance.now();

  const observer = new MutationObserver(() => {
    lastMutationAt = performance.now();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "srcset", "class", "data-page-readiness"],
  });

  try {
    await waitForFrame();
    await waitForFrame();

    if (document.fonts) {
      await waitUntilDeadline(document.fonts.ready, deadline);
    }

    while (Date.now() < deadline) {
      const images = Array.from(document.images).filter(shouldWaitForImage);
      await Promise.all(images.map((image) => waitForImage(image, settledSources, deadline)));
      await waitForFrame();

      const hasRouteFallback = Boolean(document.querySelector('[data-route-loading="true"]'));
      const hasPendingClientWidget = Boolean(
        document.querySelector(
          '[data-page-readiness="pending"], main .swiper:not(.swiper-initialized)',
        ),
      );
      const hasUnsettledImage = Array.from(document.images)
        .filter(shouldWaitForImage)
        .some((image) => settledSources.get(image) !== imageSource(image));
      const isDomQuiet = performance.now() - lastMutationAt >= PAGE_READY_QUIET_MS;

      if (!hasRouteFallback && !hasPendingClientWidget && !hasUnsettledImage && isDomQuiet) {
        return;
      }

      await waitForDelay(Math.min(PAGE_READY_POLL_MS, Math.max(0, deadline - Date.now())));
    }
  } finally {
    observer.disconnect();
  }
}

function isSameDocumentDestination(destination: string) {
  const current = new URL(window.location.href);
  const next = new URL(destination, current);

  return next.pathname === current.pathname && next.search === current.search;
}

function NavigationCompletion({ onRouteCommitted }: { onRouteCommitted: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    onRouteCommitted();
  }, [onRouteCommitted, routeKey]);

  return null;
}

export function NavigationTransitionProvider({ children }: { children: React.ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(true);
  const navigatingRef = useRef(true);
  const fallbackTimerRef = useRef<number | null>(null);
  const readinessRunRef = useRef(0);

  const completeNavigation = useCallback(() => {
    readinessRunRef.current += 1;
    navigatingRef.current = false;
    setIsNavigating(false);
    document.documentElement.removeAttribute("data-navigation-pending");
    document.documentElement.removeAttribute("aria-busy");

    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const scheduleFallback = useCallback(() => {
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
    }

    fallbackTimerRef.current = window.setTimeout(completeNavigation, PAGE_READY_TIMEOUT_MS);
  }, [completeNavigation]);

  const completeNavigationWhenReady = useCallback(async () => {
    const runId = readinessRunRef.current + 1;
    readinessRunRef.current = runId;
    await waitForPageReady();

    if (readinessRunRef.current === runId) {
      completeNavigation();
    }
  }, [completeNavigation]);

  const startNavigation = useCallback(
    (destination?: string) => {
      if (destination && isSameDocumentDestination(destination)) {
        return false;
      }

      if (navigatingRef.current) {
        return false;
      }

      readinessRunRef.current += 1;
      navigatingRef.current = true;
      document.documentElement.setAttribute("data-navigation-pending", "true");
      document.documentElement.setAttribute("aria-busy", "true");
      setIsNavigating(true);

      scheduleFallback();
      return true;
    },
    [scheduleFallback],
  );

  useEffect(() => {
    if (navigatingRef.current) {
      document.documentElement.setAttribute("data-navigation-pending", "true");
      document.documentElement.setAttribute("aria-busy", "true");
      scheduleFallback();
    }

    function handleClick(event: MouseEvent) {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        (anchor.target && anchor.target !== "_self") ||
        anchor.closest("[data-navigation-ignore]")
      ) {
        return;
      }

      const destination = new URL(anchor.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (isSameDocumentDestination(destination.href)) return;

      if (navigatingRef.current) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      startNavigation(destination.href);
    }

    function handlePopState() {
      startNavigation();
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      navigatingRef.current = false;
      document.documentElement.removeAttribute("data-navigation-pending");
      document.documentElement.removeAttribute("aria-busy");
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
    };
  }, [scheduleFallback, startNavigation]);

  return (
    <NavigationTransitionContext.Provider value={{ isNavigating, startNavigation }}>
      {children}
      <Suspense fallback={null}>
        <NavigationCompletion onRouteCommitted={completeNavigationWhenReady} />
      </Suspense>
      {isNavigating ? <NavigationLoadingOverlay /> : null}
    </NavigationTransitionContext.Provider>
  );
}

export function useNavigationTransition() {
  const context = useContext(NavigationTransitionContext);

  if (!context) {
    throw new Error("useNavigationTransition must be used inside NavigationTransitionProvider");
  }

  return context;
}
