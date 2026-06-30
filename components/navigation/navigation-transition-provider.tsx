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

function isSameDocumentDestination(destination: string) {
  const current = new URL(window.location.href);
  const next = new URL(destination, current);

  return next.pathname === current.pathname && next.search === current.search;
}

function NavigationCompletion({ onComplete }: { onComplete: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;

  useEffect(() => {
    onComplete();
  }, [onComplete, routeKey]);

  return null;
}

export function NavigationTransitionProvider({ children }: { children: React.ReactNode }) {
  const [isNavigating, setIsNavigating] = useState(false);
  const navigatingRef = useRef(false);
  const fallbackTimerRef = useRef<number | null>(null);

  const completeNavigation = useCallback(() => {
    navigatingRef.current = false;
    setIsNavigating(false);
    document.documentElement.removeAttribute("data-navigation-pending");
    document.documentElement.removeAttribute("aria-busy");

    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const startNavigation = useCallback(
    (destination?: string) => {
      if (destination && isSameDocumentDestination(destination)) {
        return false;
      }

      if (navigatingRef.current) {
        return false;
      }

      navigatingRef.current = true;
      document.documentElement.setAttribute("data-navigation-pending", "true");
      document.documentElement.setAttribute("aria-busy", "true");
      setIsNavigating(true);

      fallbackTimerRef.current = window.setTimeout(completeNavigation, 15_000);
      return true;
    },
    [completeNavigation],
  );

  useEffect(() => {
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
  }, [completeNavigation, startNavigation]);

  return (
    <NavigationTransitionContext.Provider value={{ isNavigating, startNavigation }}>
      {children}
      <Suspense fallback={null}>
        <NavigationCompletion onComplete={completeNavigation} />
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
