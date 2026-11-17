import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AutoAdContent } from "@/components/ads/auto-ad-content";

import ChampionDetailLoading from "./loading";

import { ChampionDetail, type ChampionCatalogs } from "@/components/champions/champion-detail";
import type { ChampionDetailTab } from "@/components/champions/champion-navigation";
import { ChampionScopeFilter } from "@/components/champions/champion-scope-filter";
import { buildChampionAnalysis, buildChampionDirectoryFromAggregates } from "@/lib/champion-analysis";
import { championImage, championSearchText, fetchChampionAbilityIcons, normalizedDdragonId } from "@/lib/champions";
import { getChampionBySlug, getChampionDetailData, getChampionGamesPage, getChampionDirectoryStats, getChampionPageReferenceData, resolveChampionScope } from "@/lib/data/champion-page";
import { DEFAULT_DDRAGON_VERSION, ddragonVersionFromPatch, uniqueDdragonVersionsForPatches } from "@/lib/ddragon";
import { fetchDetailedItemCatalog, type DetailedGameItem, type GameItem } from "@/lib/items";
import { fetchFullRuneTrees, fetchRuneCatalog } from "@/lib/runes";
import { fetchSpellCatalog } from "@/lib/spells";
import type { PlayerPosition } from "@/lib/types";

type ChampionDetailSearchParams = {
  season?: string;
  tournament?: string;
  patch?: string;
  position?: string;
  tab?: string;
  page?: string;
};

const POSITIONS = new Set<PlayerPosition>(["TOP", "JGL", "MID", "BOT", "SUP"]);
const TABS = new Set<ChampionDetailTab>(["overview", "matchups", "duos", "pros", "games", "stats"]);

async function readCatalog<T>(read: () => Promise<T>, fallback: T) {
  try {
    return { data: await read(), failed: false };
  } catch {
    return { data: fallback, failed: true };
  }
}

async function loadItemCatalogs(versions: string[]) {
  const reads = await Promise.all(
    [...new Set(versions)].map(async (version) => ({
      version,
      ...await readCatalog(() => fetchDetailedItemCatalog(version), [] as DetailedGameItem[]),
    })),
  );
  const detailedItemsByVersion = Object.fromEntries(
    reads.filter((read) => !read.failed).map((read) => [read.version, read.data]),
  );
  const itemById = new Map<number, GameItem>();
  const itemImageVersionById: Record<string, string> = {};

  for (const read of reads) {
    if (read.failed) continue;
    for (const item of read.data) {
      if (!itemById.has(item.id)) itemById.set(item.id, { id: item.id, name: item.name });
      itemImageVersionById[String(item.id)] ??= read.version;
    }
  }

  return {
    detailedItems: [...new Map(reads.flatMap((read) => read.data.map((item) => [item.id, item] as const))).values()],
    detailedItemsByVersion,
    items: [...itemById.values()],
    itemImageVersionById,
    failedVersions: reads.filter((read) => read.failed).map((read) => read.version),
  };
}

export async function generateMetadata({ params }: { params: Promise<{ championSlug: string }> }): Promise<Metadata> {
  const { championSlug } = await params;
  const champion = await getChampionBySlug(championSlug);
  if (!champion) return { title: "챔피언을 찾을 수 없습니다 | MINION" };
  const title = `${champion.name} 통계 | MINION`;
  const description = `${champion.name}의 픽·밴, 포지션별 승률, 상대 전적, 바텀 조합과 선수 빌드를 확인하세요.`;
  const image = championImage(champion);
  return {
    title,
    description,
    alternates: { canonical: `/champions/${champion.slug}` },
    openGraph: { title, description, images: image ? [{ url: image }] : [] },
  };
}

export default async function ChampionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ championSlug: string }>;
  searchParams: Promise<ChampionDetailSearchParams>;
}) {
  const [{ championSlug }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const contentKey = JSON.stringify([
    championSlug,
    query.season,
    query.tournament,
    query.patch,
    query.position,
    query.tab,
    query.page,
  ]);

  return (
    <Suspense key={contentKey} fallback={<ChampionDetailLoading />}>
      <ChampionDetailContent championSlug={championSlug} query={query} />
    </Suspense>
  );
}

async function ChampionDetailContent({ championSlug, query }: {
  championSlug: string;
  query: ChampionDetailSearchParams;
}) {
  const references = await getChampionPageReferenceData(query);
  const champion = await getChampionBySlug(championSlug, references.champions);
  if (!champion) notFound();

  const scope = resolveChampionScope(references, query);
  const requestedTab = TABS.has(query.tab as ChampionDetailTab)
    ? query.tab as ChampionDetailTab
    : "overview";
  const directoryStats = await getChampionDirectoryStats(scope.setIds);
  const directory = buildChampionDirectoryFromAggregates(references.champions, directoryStats);
  const summary = directory.find(row => row.champion.id === champion.id)!;
  const requestedPosition = POSITIONS.has(query.position as PlayerPosition) ? query.position as PlayerPosition : null;
  const position = requestedPosition && summary.positions.some(row => row.position === requestedPosition && row.picks > 0)
    ? requestedPosition : [...summary.positions].sort((a, b) => b.picks - a.picks)[0].position;
  const parsedPage = Number(query.page);
  const requestedPage = Number.isInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 2_000_000_000) : 1;
  const gamesPage = requestedTab === "games" ? await getChampionGamesPage(champion.id, scope.setIds, position, requestedPage) : null;
  const detailSetIds = gamesPage ? [...new Set(gamesPage.pairs.map(pair => pair.setId))] : scope.setIds;
  const data = await getChampionDetailData(champion.id, detailSetIds, requestedTab === "overview", references,
    requestedTab === "stats" || requestedTab === "duos");
  const analysis = buildChampionAnalysis(data, champion.id, position);
  analysis.overview.draft = summary.draft;
  if (gamesPage) {
    analysis.games = analysis.games.filter(game => gamesPage.pairs.some(pair => pair.setId === game.setId && pair.playerId === game.playerId));
    analysis.overview.overall = summary.record;
    analysis.overview.positions = summary.positions;
    analysis.overview.selected = summary.positions.find(row => row.position === position)!;
  }

  let activeTab = requestedTab;
  if (activeTab === "duos" && position !== "BOT" && position !== "SUP") activeTab = "stats";

  const paramsForLinks = new URLSearchParams();
  paramsForLinks.set("season", String(scope.season));
  if (scope.tournament !== "all") paramsForLinks.set("tournament", scope.tournament);
  if (scope.patch !== "all") paramsForLinks.set("patch", scope.patch);
  paramsForLinks.set("position", position);
  if (activeTab !== "overview") paramsForLinks.set("tab", activeTab);
  const gamePage = gamesPage?.page ?? 1;
  if (activeTab === "games" && gamePage > 1) paramsForLinks.set("page", String(gamePage));

  const pickerOptions = directory.filter((row) => row.draft.picks > 0 || row.draft.bans > 0).map((row) => ({
    id: row.champion.id,
    slug: row.champion.slug,
    name: row.champion.name,
    imageUrl: championImage(row.champion),
    searchText: championSearchText(row.champion),
    games: row.record.picks,
  }));

  const representativePatch = scope.patch !== "all"
    ? scope.patch
    : analysis.games[0]?.patch ?? data.sets.find((set) => set.patch)?.patch;
  const version = ddragonVersionFromPatch(representativePatch) || DEFAULT_DDRAGON_VERSION;
  let catalogs: ChampionCatalogs = {
    version,
    items: [],
    detailedItems: [],
    detailedItemsByVersion: {},
    itemImageVersionById: {},
    spells: [],
    runeCatalog: { keystones: [], trees: [] },
    runeTrees: [],
    abilityIcons: null,
    catalogFailures: { itemVersions: [], spells: false, runes: false },
  };

  if (activeTab === "overview") {
    const itemVersions = uniqueDdragonVersionsForPatches([
      representativePatch,
      ...analysis.games.map((game) => game.patch),
    ]);
    const [itemCatalogs, spells, runeCatalog, runeTrees, abilityIcons] = await Promise.all([
      loadItemCatalogs(itemVersions),
      readCatalog(() => fetchSpellCatalog(version), []),
      readCatalog(() => fetchRuneCatalog(version), { keystones: [], trees: [] }),
      readCatalog(() => fetchFullRuneTrees(version), []),
      readCatalog(() => fetchChampionAbilityIcons(normalizedDdragonId(champion), version), null),
    ]);
    catalogs = {
      version,
      ...itemCatalogs,
      spells: spells.data,
      runeCatalog: runeCatalog.data,
      runeTrees: runeTrees.data,
      abilityIcons: abilityIcons.data,
      catalogFailures: {
        itemVersions: itemCatalogs.failedVersions,
        spells: spells.failed,
        runes: runeCatalog.failed || runeTrees.failed,
      },
    };
  }

  return (
    <main className="min-h-screen bg-[var(--ui-surface)] text-[var(--ui-text)]">
      <AutoAdContent enabled={analysis.overview.overall.picks > 0 || analysis.overview.draft.bans > 0} />
      <div className="layout-wide pb-16 pt-6 sm:pt-8">
        <ChampionDetail
          champion={champion}
          analysis={analysis}
          pickerOptions={pickerOptions}
          activeTab={activeTab}
          params={paramsForLinks}
          catalogs={catalogs}
          gamePage={gamePage}
          gameTotal={gamesPage?.total ?? analysis.games.length}
          scopeControl={(
            <ChampionScopeFilter
              action={`/champions/${champion.slug}`}
              seasons={scope.options.seasons}
              season={scope.season}
              tournaments={scope.options.tournaments.map((option) => ({ value: option.key, label: option.name }))}
              tournament={scope.tournament}
              patches={scope.options.patches}
              patch={scope.patch}
              hidden={{
                position,
                tab: activeTab === "overview" ? undefined : activeTab,
              }}
              setCount={scope.counts.sets}
              showSetCount={false}
            />
          )}
        />
      </div>
    </main>
  );
}
