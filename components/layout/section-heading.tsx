import type { ReactNode } from "react";

/**
 * 서비스 공통 섹션 헤딩: Pretendard 굵은 제목 + 우측 12px 보조 설명/범례
 * + 하단 2px 잉크 라인. 선수 상세·커뮤니티 등 서브페이지 공용.
 */
export function SectionHeading({
  title,
  caption,
  aside,
  className = "",
}: {
  title: string;
  /** 우측 정렬 12px 보조 설명 텍스트 */
  caption?: ReactNode;
  /** 우측 정렬 커스텀 노드(범례·버튼 등). caption 대신 사용 */
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`section-rule flex items-end justify-between gap-4 pb-2 ${className}`}>
      <h2 className="home-section-title text-[length:var(--ui-title-size)] leading-tight tracking-[-0.02em] text-[var(--ink)]">
        {title}
      </h2>
      {aside ?? (caption ? <span className="pb-[2px] text-[13px] text-[var(--ink-3)]">{caption}</span> : null)}
    </div>
  );
}
