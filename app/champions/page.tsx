import type { Metadata } from "next";

import { ChampionDirectoryFilters, ChampionDirectoryTable, ChampionDirectoryToolbar } from "@/components/champions/champion-directory";
import { ChampionScopeFilter } from "@/components/champions/champion-scope-filter";
import { buildChampionDirectory } from "@/lib/champion-analysis";
import { championSearchText } from "@/lib/champions";
import { getChampionDirectoryData, getChampionPageReferenceData, resolveChampionScope } from "@/lib/data/champion-page";
import type { PlayerPosition } from "@/lib/types";

export const metadata: Metadata = {
  title: "챔피언 통계 | MINION",
  description: "챔피언 픽·밴, 포지션별 승률과 빌드를 확인하세요.",
};

type DirectorySearchParams = {
  season?: string;
  tournament?: string;
  patch?: string;
  position?: string;
  q?: string;
  sort?: string;
};

const POSITIONS = new Set<PlayerPosition>(["TOP", "JGL", "MID", "BOT", "SUP"]);

export default async function ChampionsPage({ searchParams }: { searchParams: Promise<DirectorySearchParams> }) {
  const query = await searchParams;
  const references = await getChampionPageReferenceData();
  const scope = resolveChampionScope(references, query);
  const data = await getChampionDirectoryData(scope.setIds);
  const position = POSITIONS.has(query.position as PlayerPosition) ? query.position as PlayerPosition : "all";
  const search = (query.q ?? "").trim();
  const allowedSorts = new Set(["presence", "picks", "bans", "winRate", "name"]);
  const sort = allowedSorts.has(query.sort ?? "") ? query.sort! : "presence";

  let rows = buildChampionDirectory(data, position === "all" ? {} : { position })
    .filter((row) => row.draft.picks > 0 || row.draft.bans > 0)
    .filter((row) => position === "all" || row.record.picks > 0)
    .filter((row) => !search || championSearchText(row.champion).includes(search.toLowerCase()));

  rows = [...rows].sort((left, right) => {
    if (sort === "name") return left.champion.name.localeCompare(right.champion.name, "ko");
    if (sort === "picks") return right.record.picks - left.record.picks || right.draft.bans - left.draft.bans;
    if (sort === "bans") return right.draft.bans - left.draft.bans || right.draft.picks - left.draft.picks;
    if (sort === "winRate") return (right.record.winRate ?? -1) - (left.record.winRate ?? -1) || right.record.games - left.record.games;
    return (right.draft.presenceRate ?? -1) - (left.draft.presenceRate ?? -1) || right.draft.picks - left.draft.picks;
  });

  const baseParams = new URLSearchParams();
  baseParams.set("season", String(scope.season));
  if (scope.tournament !== "all") baseParams.set("tournament", scope.tournament);
  if (scope.patch !== "all") baseParams.set("patch", scope.patch);
  if (position !== "all") baseParams.set("position", position);
  if (search) baseParams.set("q", search);
  if (sort !== "presence") baseParams.set("sort", sort);

  const detailParams = new URLSearchParams(baseParams);
  detailParams.delete("q");
  detailParams.delete("sort");

  return (
    <main className="layout-wide min-h-screen pb-16 pt-6 text-[var(--ui-text)] sm:pt-8">
      <section className="md:grid md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[200px_minmax(0,1fr)]" aria-label="챔피언 탐색">
        <ChampionDirectoryFilters
          params={baseParams}
          position={position}
          resultCount={rows.length}
          scope={(
            <ChampionScopeFilter
              action="/champions"
              seasons={scope.options.seasons}
              season={scope.season}
              tournaments={scope.options.tournaments.map((option) => ({ value: option.key, label: option.name }))}
              tournament={scope.tournament}
              patches={scope.options.patches}
              patch={scope.patch}
              hidden={{ position: position === "all" ? undefined : position, q: search || undefined, sort: sort === "presence" ? undefined : sort }}
              setCount={scope.counts.sets}
              showSetCount={false}
              layout="sidebar"
            />
          )}
        />
        <div className="min-w-0">
          <ChampionDirectoryToolbar
            params={baseParams}
            query={search}
            sort={sort}
          />
          <div className="mt-3 sm:mt-4">
            <ChampionDirectoryTable rows={rows} detailQuery={detailParams.toString()} />
          </div>
        </div>
      </section>
    </main>
  );
}
