"use client";

import { useRef, type MouseEvent, type PointerEvent, type ReactNode, type RefObject } from "react";

/**
 * Swiper 안의 링크 카드를 마우스로 드래그해 넘기면, 놓는 순간 click이 발생해 링크로 이동해버린다.
 * Swiper의 preventClicks만으로는 loop 등에서 막히지 않는 경우가 있어,
 * 일정 거리 이상 움직였거나 Swiper가 onSliderMove를 알린 뒤의 click을 capture 단계에서 막는다.
 */
export function SwipeNavigationGuard({
  children,
  suppressClickRef,
}: {
  children: ReactNode;
  /** Swiper의 onSliderMove에서 true로 바꿔 터치 드래그도 막는다. */
  suppressClickRef: RefObject<boolean>;
}) {
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;

    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    suppressClickRef.current = false;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start || event.pointerType !== "mouse") return;

    if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 8) {
      suppressClickRef.current = true;
    }
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    pointerStartRef.current = null;
    if (!suppressClickRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  };

  return (
    <div
      onPointerDownCapture={handlePointerDown}
      onPointerMoveCapture={handlePointerMove}
      onClickCapture={handleClick}
    >
      {children}
    </div>
  );
}
