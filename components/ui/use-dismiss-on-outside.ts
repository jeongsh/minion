"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * 열린 팝오버·패널을 바깥 탭/클릭과 Escape로 닫는다.
 * iOS Safari는 클릭 불가 영역 탭에서 mousedown을 보내지 않으므로 pointerdown을 쓴다.
 * `ignoreSelector`에 맞는 요소(포털로 띄운 하위 팝오버 등) 안쪽은 바깥으로 보지 않는다.
 */
export function useDismissOnOutside(
  open: boolean,
  refs: ReadonlyArray<RefObject<Element | null>>,
  onDismiss: () => void,
  ignoreSelector?: string,
) {
  const onDismissRef = useRef(onDismiss);
  const refsRef = useRef(refs);

  useEffect(() => {
    onDismissRef.current = onDismiss;
    refsRef.current = refs;
  });

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (refsRef.current.some((ref) => ref.current?.contains(target))) return;
      if (ignoreSelector && target instanceof Element && target.closest(ignoreSelector)) return;
      onDismissRef.current();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismissRef.current();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, ignoreSelector]);
}
