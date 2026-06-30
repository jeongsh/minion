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
      className="mb-6 flex min-h-10 items-center gap-2 overflow-x-auto pb-1 scrollbar-none"
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
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition disabled:cursor-default ${
              isActive
                ? "bg-[#0f0f0f] text-white"
                : "border border-[#e5e5e5] bg-white text-[#606060] hover:border-[#0f0f0f] hover:text-[#0f0f0f]"
            }`}
          >
            {tab.label}
            <span className={`ml-1.5 text-xs ${isActive ? "text-white/70" : "text-[#9b9b9b]"}`}>
              {tab.count}
            </span>
          </button>
        );
      })}
      {isPending ? (
        <span className="inline-flex shrink-0 items-center gap-2 px-2 text-xs font-bold text-[#606060]" role="status">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d9d9d9] border-t-[#0f0f0f]" />
          전환 중
        </span>
      ) : null}
    </div>
  );
}
