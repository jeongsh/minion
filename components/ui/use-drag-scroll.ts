"use client";

import { useEffect, useRef, useState } from "react";

const DRAG_THRESHOLD = 10;
const MOMENTUM_FRICTION = 0.95;
const MOMENTUM_MIN_VELOCITY = 0.05;

/**
 * 가로 스크롤 레일에 마우스 드래그 스크롤을 붙인다. 터치는 브라우저 기본 스와이프가
 * 이미 잘 동작하므로 건드리지 않고, 포인터가 마우스/펜일 때만 개입한다.
 *
 * 스크롤바를 숨긴 레일(.tab-scroll, .scrollbar-none)은 마우스 사용자에게 스크롤 수단이
 * 아예 없어서 "안 움직인다"로 보인다. canScrollLeft/Right를 함께 돌려주니 화살표 버튼이나
 * 페이드 같은 어피던스에 쓰면 된다.
 */
export function useDragScroll<T extends HTMLElement>() {
  const scrollRef = useRef<T>(null);
  const dragState = useRef({
    isDown: false,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
    lastX: 0,
    lastTime: 0,
    velocity: 0,
  });
  const momentumFrame = useRef<number | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function stopMomentum() {
    if (momentumFrame.current !== null) {
      cancelAnimationFrame(momentumFrame.current);
      momentumFrame.current = null;
    }
  }

  useEffect(() => stopMomentum, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function updateScrollState() {
      if (!el) return;
      setCanScrollLeft(el.scrollLeft > 1);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    }

    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);

    return () => {
      el.removeEventListener("scroll", updateScrollState);
      observer.disconnect();
    };
  }, []);

  function runMomentum() {
    const el = scrollRef.current;
    const state = dragState.current;
    if (!el) return;
    state.velocity *= MOMENTUM_FRICTION;
    if (Math.abs(state.velocity) < MOMENTUM_MIN_VELOCITY) {
      momentumFrame.current = null;
      return;
    }
    el.scrollLeft -= state.velocity;
    momentumFrame.current = requestAnimationFrame(runMomentum);
  }

  function slide(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    stopMomentum();
    el.scrollBy({ left: el.clientWidth * 0.8 * direction, behavior: "smooth" });
  }

  function onPointerDown(e: React.PointerEvent<T>) {
    const el = scrollRef.current;
    if (!el || e.pointerType === "touch") return;
    stopMomentum();
    const now = performance.now();
    dragState.current = {
      isDown: true,
      startX: e.clientX,
      startScrollLeft: el.scrollLeft,
      moved: false,
      lastX: e.clientX,
      lastTime: now,
      velocity: 0,
    };
    // 여기서 바로 포인터를 캡처하면(드래그가 아니라 단순 클릭이어도) 이후 pointerup/click이
    // 전부 이 스크롤러로만 향하게 되어, 안쪽 링크가 클릭되지 않는다. 그래서 실제로 드래그
    // 임계값을 넘은 뒤(onPointerMove)에만 캡처해서, 일반 클릭은 원래 타겟(링크)에 그대로
    // 도달하게 한다.
  }

  function onPointerMove(e: React.PointerEvent<T>) {
    const el = scrollRef.current;
    const state = dragState.current;
    if (!el || !state.isDown) return;
    const delta = e.clientX - state.startX;
    if (Math.abs(delta) > DRAG_THRESHOLD && !state.moved) {
      state.moved = true;
      el.setPointerCapture(e.pointerId);
    }
    el.scrollLeft = state.startScrollLeft - delta;

    const now = performance.now();
    const dt = now - state.lastTime;
    if (dt > 0) {
      state.velocity = ((e.clientX - state.lastX) / dt) * 16.6667;
    }
    state.lastX = e.clientX;
    state.lastTime = now;
  }

  function endDrag(e: React.PointerEvent<T>) {
    const el = scrollRef.current;
    if (el && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (dragState.current.isDown && Math.abs(dragState.current.velocity) > MOMENTUM_MIN_VELOCITY) {
      stopMomentum();
      momentumFrame.current = requestAnimationFrame(runMomentum);
    }
    dragState.current.isDown = false;
  }

  function onClickCapture(e: React.MouseEvent<T>) {
    if (dragState.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      dragState.current.moved = false;
    }
  }

  return {
    scrollRef,
    canScrollLeft,
    canScrollRight,
    slide,
    dragHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerLeave: endDrag,
      onPointerCancel: endDrag,
      onClickCapture,
    },
  };
}
