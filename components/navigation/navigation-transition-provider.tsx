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

async function waitForPageReady() {
  const deadline = Date.now() + PAGE_READY_TIMEOUT_MS;
  let lastMutationAt = performance.now();

  const observer = new MutationObserver(() => {
    lastMutationAt = performance.now();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "data-page-readiness"],
  });

  try {
    await waitForFrame();
    await waitForFrame();

    while (Date.now() < deadline) {
      await waitForFrame();

      const hasRouteFallback = Boolean(document.querySelector('[data-route-loading="true"]'));
      const hasPendingClientWidget = Boolean(
        document.querySelector('[data-page-readiness="pending"]'),
      );
      const isDomQuiet = performance.now() - lastMutationAt >= PAGE_READY_QUIET_MS;

      // 이미지와 영상은 각자의 자리에서 점진적으로 표시한다. 페이지 전환은
      // 라우트 데이터와 명시적인 클라이언트 위젯만 준비되면 끝낸다.
      if (!hasRouteFallback && !hasPendingClientWidget && isDomQuiet) {
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

function currentDocumentRouteKey() {
  return `${window.location.pathname}?${window.location.search}`;
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
  const [isNavigating, setIsNavigating] = useState(false);
  const navigatingRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);
  const readinessRunRef = useRef(0);
  const documentRouteKeyRef = useRef<string | null>(null);

  const completeNavigation = useCallback(() => {
    readinessRunRef.current += 1;
    navigatingRef.current = false;
    documentRouteKeyRef.current = currentDocumentRouteKey();
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
    documentRouteKeyRef.current = currentDocumentRouteKey();

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
      const nextRouteKey = currentDocumentRouteKey();
      if (documentRouteKeyRef.current === nextRouteKey) return;

      documentRouteKeyRef.current = nextRouteKey;
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
