"use client";

import { useEffect } from "react";

/**
 * 일정 페이지 진입 시 오늘 날짜 그룹이 곧바로 보이도록 즉시 스크롤한다(애니메이션 없음).
 * 상단 고정 헤더/필터 바 높이 오프셋은 대상 섹션의 `scroll-mt-40`(scroll-margin-top)이 처리한다.
 */
export function ScheduleTodayScroll({ targetId }: { targetId: string }) {
  useEffect(() => {
    // 레이아웃 커밋 및 Next.js 기본 스크롤 복원 이후에 실행되도록 한 프레임 미룬다.
    const raf = requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ behavior: "instant", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [targetId]);

  return null;
}
