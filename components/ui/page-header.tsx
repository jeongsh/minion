// 페이지 공통 상단 헤더 — 영문 eyebrow + 한글 타이틀 2줄.
// 일정 페이지 최상단 스타일을 디자인 토큰(--ui-*) 기반으로 추출해 전 페이지에서 재사용한다.
export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--ui-muted)]">{eyebrow}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="home-section-title text-[32px] text-[var(--ui-ink)]">{title}</h1>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
