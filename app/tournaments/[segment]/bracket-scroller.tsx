"use client";

import { useEffect, useRef } from "react";

const DRAG_THRESHOLD = 5;
const MOMENTUM_FRICTION = 0.95;
const MOMENTUM_MIN_VELOCITY = 0.05;

function SlideArrow({ direction }: { direction: "left" | "right" }) {
  const d = direction === "left" ? "M12.5 15L7.5 10L12.5 5" : "M7.5 5L12.5 10L7.5 15";

  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
      <path d={d} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BracketScroller({ children }: { children: React.ReactNode }) {
  const scrollRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => stopMomentum, []);

  function stopMomentum() {
    if (momentumFrame.current !== null) {
      cancelAnimationFrame(momentumFrame.current);
      momentumFrame.current = null;
    }
  }

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

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
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
    el.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    const state = dragState.current;
    if (!el || !state.isDown) return;
    const delta = e.clientX - state.startX;
    if (Math.abs(delta) > DRAG_THRESHOLD) state.moved = true;
    el.scrollLeft = state.startScrollLeft - delta;

    const now = performance.now();
    const dt = now - state.lastTime;
    if (dt > 0) {
      state.velocity = ((e.clientX - state.lastX) / dt) * 16.6667;
    }
    state.lastX = e.clientX;
    state.lastTime = now;
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (el && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    if (dragState.current.isDown && Math.abs(dragState.current.velocity) > MOMENTUM_MIN_VELOCITY) {
      stopMomentum();
      momentumFrame.current = requestAnimationFrame(runMomentum);
    }
    dragState.current.isDown = false;
  }

  function onClickCapture(e: React.MouseEvent<HTMLDivElement>) {
    if (dragState.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      dragState.current.moved = false;
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="이전 라운드"
        onClick={() => slide(-1)}
        className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface p-2 text-foreground shadow-md transition-colors hover:bg-surface-muted md:flex"
      >
        <SlideArrow direction="left" />
      </button>

      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        className="scrollbar-none flex cursor-grab snap-x snap-proximity items-stretch gap-4 overflow-x-auto scroll-smooth pb-2 active:cursor-grabbing active:select-none"
      >
        {children}
      </div>

      <button
        type="button"
        aria-label="다음 라운드"
        onClick={() => slide(1)}
        className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface p-2 text-foreground shadow-md transition-colors hover:bg-surface-muted md:flex"
      >
        <SlideArrow direction="right" />
      </button>
    </div>
  );
}
