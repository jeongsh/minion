"use client";

export type FanOwnerTab = { key: string; label: string; count: number };

/**
 * 게시물/영상 목록에서 소유자(구단 + 개별 선수)별 탭을 만든다.
 * key 는 ownerName 으로 두어 필터링 시 `item.ownerName === key` 로 비교한다.
 * (구단의 ownerName 은 팀 약칭이라 선수 이름과 겹치지 않는다.)
 */
export function buildOwnerTabs(
  items: { ownerType: "team" | "player"; ownerName: string }[],
  teamName: string,
): FanOwnerTab[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.ownerName, (counts.get(item.ownerName) ?? 0) + 1);
  }

  const tabs: FanOwnerTab[] = [{ key: "all", label: "전체", count: items.length }];

  // 구단 계정 먼저
  if (counts.has(teamName)) {
    tabs.push({ key: teamName, label: "구단", count: counts.get(teamName) ?? 0 });
  }

  // 선수는 이름순
  const playerNames = [...counts.keys()]
    .filter((name) => name !== teamName)
    .sort((a, b) => a.localeCompare(b, "ko"));
  for (const name of playerNames) {
    tabs.push({ key: name, label: name, count: counts.get(name) ?? 0 });
  }

  return tabs;
}

export function FanFeedTabs({
  tabs,
  activeKey,
  onChange,
  isPending = false,
}: {
  tabs: FanOwnerTab[];
  activeKey: string;
  onChange: (key: string) => void;
  isPending?: boolean;
}) {
  // 전체 + 소유자 1명뿐이면 필터가 의미 없으므로 숨긴다.
  if (tabs.length <= 2) return null;

  return (
    <div
      className="fan-nav-scroll mb-5 flex min-h-10 max-w-full items-center gap-2 overflow-x-auto pb-1"
      aria-busy={isPending}
    >
      {tabs.map((tab) => {
        const isActive = activeKey === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            disabled={isPending || isActive}
            onClick={() => onChange(tab.key)}
            aria-pressed={isActive}
            className={`shrink-0 rounded-full px-3 py-2 text-[13px] font-bold transition disabled:cursor-default sm:px-4 sm:text-sm ${
              isActive
                ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]"
                : "border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-text)] hover:border-[var(--ui-ink)] hover:text-[var(--ui-ink)]"
            }`}
          >
            {tab.label}
            <span className={`ml-1 text-[12px] sm:ml-1.5 sm:text-[13px] ${isActive ? "opacity-70" : "text-[var(--ui-muted)]"}`}>
              {tab.count}
            </span>
          </button>
        );
      })}
      {isPending ? (
        <span className="inline-flex shrink-0 items-center gap-2 px-2 text-[13px] font-bold text-[var(--ui-muted)]" role="status">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--ui-border)] border-t-[var(--ui-ink)]" />
          전환 중
        </span>
      ) : null}
    </div>
  );
}
