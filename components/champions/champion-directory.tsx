import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { ChampionUrlDropdown } from "@/components/champions/champion-url-dropdown";
import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";
import type { ChampionDirectoryRow } from "@/lib/champion-analysis";
import { championImage } from "@/lib/champions";
import type { PlayerPosition } from "@/lib/types";

const POSITION_OPTIONS: Array<{ value: PlayerPosition | "all"; label: string }> = [
  { value: "all", label: "전체" },
  { value: "TOP", label: "TOP" },
  { value: "JGL", label: "JGL" },
  { value: "MID", label: "MID" },
  { value: "BOT", label: "BOT" },
  { value: "SUP", label: "SUP" },
];

function withParams(params: URLSearchParams, changes: Record<string, string | null>) {
  const next = new URLSearchParams(params);
  for (const [key, value] of Object.entries(changes)) {
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
  }
  const query = next.toString();
  return query ? `/champions?${query}` : "/champions";
}

function PositionFilters({
  params,
  position,
}: {
  params: URLSearchParams;
  position: PlayerPosition | "all";
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[13px] font-medium uppercase tracking-[0.1em] text-[var(--ui-muted)]">포지션</legend>
      <nav aria-label="포지션 필터" className="grid grid-cols-3 gap-2 md:grid-cols-2">
        {POSITION_OPTIONS.map((item) => {
          const active = item.value === position;
          return (
            <Link
              key={item.value}
              href={withParams(params, { position: item.value })}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 items-center justify-center rounded-xl px-2 text-[14px] font-medium transition-colors ${active ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "bg-[var(--ui-card-bg)] text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)] hover:text-[var(--ui-ink)]"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </fieldset>
  );
}

export function ChampionDirectoryFilters({
  params,
  position,
  scope,
  resultCount,
}: {
  params: URLSearchParams;
  position: PlayerPosition | "all";
  scope: ReactNode;
  resultCount: number;
}) {
  const filters = (
    <div className="space-y-5">
      <PositionFilters params={params} position={position} />
      {scope}
    </div>
  );

  return (
    <>
      <div className="mb-4 flex items-center justify-between md:hidden">
        <p className="text-[14px] font-medium tabular-nums text-[var(--ui-muted)]">{resultCount}개</p>
        <AdaptiveDialog
          title="챔피언 필터"
          trigger={<span className="flex items-center gap-2"><SlidersHorizontal size={18} />필터</span>}
          triggerClassName="flex min-h-11 items-center rounded-xl border border-[var(--ui-border)] px-3 text-[14px] font-medium"
        >
          {filters}
        </AdaptiveDialog>
      </div>
      <aside className="sticky top-20 hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 md:block">
        {filters}
      </aside>
    </>
  );
}

export function ChampionDirectoryToolbar({
  params,
  query,
  sort,
}: {
  params: URLSearchParams;
  query: string;
  sort: string;
}) {
  return (
    <div className="flex min-w-0 justify-end">
      <form method="get" action="/champions" className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_8rem] gap-2 self-stretch sm:w-[25rem] sm:grid-cols-[minmax(0,1fr)_8.5rem] sm:self-auto">
        {Array.from(params.entries()).flatMap(([key, value]) =>
          key !== "q" && key !== "sort" ? [<input key={key} type="hidden" name={key} value={value} />] : [],
        )}
        {sort !== "presence" ? <input type="hidden" name="sort" value={sort} /> : null}
        <label className="flex h-10 min-w-0 items-center gap-2.5 rounded-xl bg-[var(--ui-card-bg)] px-3.5 focus-within:ring-2 focus-within:ring-[var(--accent)]">
          <Search size={17} className="shrink-0 text-[var(--ui-muted)]" />
          <span className="sr-only">챔피언 검색</span>
          <input
            name="q"
            defaultValue={query}
            placeholder="챔피언 검색"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-normal text-[var(--ui-ink)] outline-none placeholder:text-[var(--ui-muted)]"
          />
        </label>
        <div className="flex h-10 min-w-0 items-center [&>div]:w-full">
          <ChampionUrlDropdown
            ariaLabel="정렬 선택"
            options={[
              { value: "presence", label: "픽밴률순" },
              { value: "picks", label: "픽순" },
              { value: "bans", label: "밴순" },
              { value: "winRate", label: "승률순" },
              { value: "name", label: "이름순" },
            ]}
            selected={sort}
            paramName="sort"
            resetKeys={["page"]}
            omitValues={["presence"]}
            triggerClassName="h-10 w-full justify-between rounded-xl bg-[var(--ui-card-bg)] px-3 !font-medium transition-colors hover:bg-[var(--ui-card-hover)]"
          />
        </div>
        <button type="submit" className="sr-only">검색</button>
      </form>
    </div>
  );
}

export function ChampionDirectoryTable({
  rows,
  detailQuery,
}: {
  rows: ChampionDirectoryRow[];
  detailQuery: string;
}) {
  if (!rows.length) {
    return (
      <section className="rounded-xl bg-[var(--ui-surface)]" role="status">
        <div className="grid min-h-64 place-items-center px-5 text-center">
          <div>
            <p className="text-[18px] font-bold text-[var(--ui-ink)]">챔피언을 찾지 못했습니다.</p>
            <p className="mt-2 text-[16px] font-normal text-[var(--ui-muted)]">필터나 검색어를 바꿔보세요.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="grid content-start justify-items-center gap-x-2 gap-y-2 sm:gap-y-3"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(clamp(3.5rem, 15vw, 4rem), 1fr))" }}
      aria-label="챔피언 목록"
    >
      {rows.map((row) => {
        const href = `/champions/${row.champion.slug}${detailQuery ? `?${detailQuery}` : ""}`;
        return (
          <Link
            key={row.champion.id}
            href={href}
            aria-label={`${row.champion.name} 상세 보기`}
            className="group flex w-14 min-w-0 flex-col items-center gap-1 rounded-xl py-1 text-center transition-colors hover:bg-[var(--ui-card-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] sm:w-16 sm:gap-1.5 sm:py-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={championImage(row.champion)} alt="" className="h-12 w-12 rounded-lg object-cover sm:h-14 sm:w-14" loading="lazy" />
            <span className="w-full truncate text-[13px] font-medium text-[var(--ui-ink)]">{row.champion.name}</span>
          </Link>
        );
      })}
    </section>
  );
}

export { ChampionDirectoryTable as ChampionDirectoryGrid };
