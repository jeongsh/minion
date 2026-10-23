"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * 차트가 화면에 들어올 때 한 번만 data-revealed를 켠다. 실제 움직임은 globals.css의
 * .preview-reveal 규칙이 맡고, 동작 줄이기 설정에서는 최종 상태로 바로 보여준다.
 * 렌더를 다시 일으키지 않도록 상태 대신 DOM 속성을 직접 바꾼다.
 */
export function ChartReveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      element.dataset.instant = "true";
      element.dataset.revealed = "true";
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      element.dataset.revealed = "true";
      observer.disconnect();
    }, { threshold: 0.2 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`preview-reveal ${className}`} data-revealed="false">{children}</div>;
}
