import Link from "next/link";
import { ImageIcon } from "lucide-react";

import { notFound } from "next/navigation";

import { PredictionMatchBar } from "@/components/domain/prediction-match-bar";
import { SetVodPlayer } from "@/components/domain/set-vod-player";
import { SegmentedControl, type TabItem } from "@/components/ui/tabs";
import { AdSlot } from "@/components/ui/ad-slot";
import { TeamLogo } from "@/components/ui/team-logo";
import {
  getAllPlayers,
  getAllTeams,
  getChampions,
  getFanRatingsByMatchId,
  getFanRatingReactionStates,
  getMatchById,
  getMatches,
  getPlayerStatLines,
  getSets,
  getMatchVodsByMatchId,
  getSetsByMatchId,
  getStages,
  getTournaments,
} from "@/lib/data/lck";
import { championImage } from "@/lib/champions";
import type { Champion, FanRating, Match, Player, PlayerStatLine, SetResult, Team } from "@/lib/types";
import { isMatchLive, matchStatusLabel } from "@/lib/match-display";
import {
  getSetRatingStartedAt,
  isSetRatingOpen,
  isSetRatingSnapshotReady,
} from "@/lib/set-status";
import {
  fanRatingLeader,
  formatDateTime,
  teamLabel,
} from "@/lib/view-data";
import { getPredictionMarketData } from "@/lib/predictions";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMatchAiPreview } from "@/lib/match-preview-ai";

import { LiveMatchFeed } from "./live-match-feed";
import { MatchPreview } from "./match-preview";
import { SetDetailContent } from "./set-detail-content";
import { SetRatingForm } from "./set-rating-form";
import { RatingCommentList } from "./rating-comment-list";

type MatchTab = "preview" | "data" | "rating" | "video" | "live";

const TAB_LABELS: Record<MatchTab, string> = {
  preview: "프리뷰",
  data: "세트",
  rating: "평가",
  video: "영상",
  live: "실시간",
};

function setLabel(set: SetResult) {
  return `${set.setNumber}세트`;
}

function scoreLabel(score: number | null | undefined) {
  return score ?? "-";
}

function CompactTeamBlock({
  align = "left",
  team,
  teamName,
  result,
}: {
  align?: "left" | "right";
  team?: Team;
  teamName: string;
  result: "WIN" | "LOSS" | null;
}) {
  const isRight = align === "right";
  const resultLabel = result === "WIN" ? "승리" : result === "LOSS" ? "패배" : null;
  const nameBlock = (
    <div className={`min-w-0 ${isRight ? "text-left" : "text-right"}`}>
      <p className="truncate text-[16px] font-black leading-tight text-[var(--ui-ink)] sm:text-[20px]">
        {teamName}
      </p>
      {resultLabel ? (
        <p className={`mt-0.5 text-[10px] font-bold tracking-[0.08em] ${result === "WIN" ? "text-[var(--accent)]" : "text-[var(--ui-muted)]"}`}>
          {resultLabel}
        </p>
      ) : null}
    </div>
  );
  const logo = <TeamLogo team={team} size="h-9 w-9 sm:h-12 sm:w-12" plain themeAware />;

  return (
    <div
      className={`grid min-w-0 items-center gap-2 px-0.5 sm:gap-3 sm:px-1 ${
        isRight
          ? "justify-self-stretch grid-cols-[auto_minmax(0,1fr)]"
          : "justify-self-stretch grid-cols-[minmax(0,1fr)_auto]"
      }`}
    >
      {isRight ? (
        <>
          {logo}
          {nameBlock}
        </>
      ) : (
        <>
          {nameBlock}
          {logo}
        </>
      )}
    </div>
  );
}

function PlayerHighlight({
  label,
  player,
}: {
  label: string;
  player?: Player;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 rounded-full bg-[var(--ui-surface)] py-1 pl-1 pr-2 shadow-sm">
      <span className="grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
        {player?.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.profileImageUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <span className="text-xs font-medium text-[var(--ui-muted)]">{player?.name?.slice(0, 2) ?? "-"}</span>
        )}
      </span>
      <span className="text-[10px] font-bold tracking-[0.08em] text-[var(--ui-muted)]">{label}</span>
      <span className="truncate text-[11px] font-bold text-[var(--ui-ink)]">{player?.name ?? "집계 전"}</span>
    </span>
  );
}

function tabHref(tab: MatchTab, setId?: string) {
  const params = new URLSearchParams({ tab });

  if (setId) {
    params.set("set", setId);
  }

  return `?${params.toString()}`;
}

function normalizeTab(value: string | undefined, fallback: MatchTab): MatchTab {
  return value === "preview" ||
    value === "data" ||
    value === "rating" ||
    value === "video" ||
    value === "live"
    ? value
    : fallback;
}

function youtubeEmbedUrl(value: string | null | undefined) {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }

    if (url.hostname.includes("youtube.com")) {
      const id =
        url.searchParams.get("v") ??
        url.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  } catch {
    return null;
  }

  return null;
}

function TabNav({
  activeTab,
  sets,
  showLive,
}: {
  activeTab: MatchTab;
  sets: SetResult[];
  showLive: boolean;
}) {
  const firstSetId = sets[0]?.id;
  const items: TabItem[] = [
    { key: "preview", label: TAB_LABELS.preview, href: tabHref("preview") },
    ...(showLive ? [{ key: "live", label: TAB_LABELS.live, href: tabHref("live") }] : []),
    ...(sets.length > 0
      ? [{ key: "data", label: TAB_LABELS.data, href: tabHref("data", firstSetId) }]
      : []),
    { key: "rating", label: TAB_LABELS.rating, href: tabHref("rating", firstSetId) },
    { key: "video", label: TAB_LABELS.video, href: tabHref("video") },
  ];

  return (
    <nav
      aria-label="매치 상세 탭"
      className="tab-scroll grid max-w-full grid-flow-col auto-cols-fr gap-0.5 overflow-x-auto rounded-[10px] bg-[var(--ui-card-bg)] p-[3px]"
    >
      {items.map((item) => {
        const isActive = item.key === activeTab;

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex h-8 min-w-[4.25rem] shrink-0 items-center justify-center whitespace-nowrap rounded-lg px-2 text-[14px] transition-colors ${
              isActive
                ? "border border-[var(--ui-border)] bg-[var(--ui-surface)] font-extrabold text-[var(--ui-ink)] dark:bg-[var(--ui-border)]"
                : "font-semibold text-[var(--ui-muted)] hover:text-[var(--ui-ink)]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * 탭 안에서 세트를 좁히는 2차 컨트롤이라 세그먼티드 컨트롤 언어를 쓴다.
 * 세트가 하나뿐이어도 현재 세트를 명확히 보여주기 위해 그린다.
 */
function SetSelector({
  sets,
  activeSet,
  tab = "data",
  snapshotHref,
}: {
  sets: SetResult[];
  activeSet?: SetResult;
  tab?: Extract<MatchTab, "data" | "rating">;
  snapshotHref?: string;
}) {
  if (sets.length === 0 && !snapshotHref) return null;

  return (
    <div className="schedule-mobile-sticky sticky z-20 -mx-[var(--layout-gutter)] flex items-center justify-between gap-2 border-b border-[var(--ui-border)] bg-[var(--page-background)] px-[var(--layout-gutter)] py-1 md:mx-0 md:border-b-0 md:px-0 md:py-1.5">
      {sets.length > 0 ? (
        <SegmentedControl
          items={sets.map((set) => ({
            key: set.id,
            label: setLabel(set),
            href: tabHref(tab, set.id),
          }))}
          activeKey={activeSet?.id ?? ""}
          ariaLabel="세트 선택"
          className="tab-scroll min-w-0 max-w-full overflow-x-auto"
        />
      ) : <span />}
      {snapshotHref ? (
        <Link
          href={snapshotHref}
          title="공유 스냅샷 보기"
          aria-label="공유 스냅샷 보기"
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg bg-[var(--ui-ink)] px-2 text-[13px] font-normal text-[var(--ui-surface)] shadow-sm transition-opacity hover:opacity-85 sm:px-2.5"
        >
          <ImageIcon aria-hidden="true" className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">공유 스냅샷</span>
        </Link>
      ) : null}
    </div>
  );
}

const positionOrder = new Map<Player["position"], number>(
  ["TOP", "JGL", "MID", "BOT", "SUP"].map((position, index) => [
    position as Player["position"],
    index,
  ]),
);

function MatchRatingPanel({
  matchId,
  set,
  sets,
  teams,
  players,
  playerStatLines,
  fanRatings,
  champions,
  isLoggedIn,
  currentUserId,
  reactionStates,
}: {
  matchId: string;
  set?: SetResult;
  sets: SetResult[];
  teams: Team[];
  players: Player[];
  playerStatLines: PlayerStatLine[];
  fanRatings: FanRating[];
  champions: Champion[];
  isLoggedIn: boolean;
  currentUserId?: string;
  reactionStates: Record<string, "honor" | "dislike">;
}) {
  if (!set) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface)] p-4 text-[15px] text-[var(--ui-muted)]">
        투표할 세트가 없습니다.
      </div>
    );
  }

  const setLines = playerStatLines.filter((line) => line.setId === set.id);
  const setRatings = fanRatings.filter((rating) => rating.setId === set.id);
  const ratingStartedAt = getSetRatingStartedAt(set);
  const ratingOpen = isSetRatingOpen(set);
  const snapshotReady = isSetRatingSnapshotReady(set);
  const snapshotHref = `/matches/${matchId}/sets/${set.id}/snapshot`;
  const leader = fanRatingLeader(setRatings);
  const reviewRows = setRatings
    .filter((rating) => rating.review)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 100);
  const selectableLines = [...setLines].sort((a, b) => {
    if (a.teamId !== b.teamId) return a.teamId === set.blueTeamId ? -1 : 1;
    return (
      (positionOrder.get(a.position) ?? 99) -
      (positionOrder.get(b.position) ?? 99)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <SetSelector
        sets={sets}
        activeSet={set}
        tab="rating"
        snapshotHref={snapshotReady ? snapshotHref : undefined}
      />

      <section>
        <div>
          <SetRatingForm
            matchId={matchId}
            setId={set.id}
            blueTeamId={set.blueTeamId}
            ratingOpen={ratingOpen}
            isLoggedIn={isLoggedIn}
            loginHref={`/login?next=${encodeURIComponent(`/matches/${matchId}?tab=rating&set=${set.id}`)}`}
            ratingStatusNote={
              ratingOpen && ratingStartedAt !== null
                ? "평점 입력이 열렸습니다. 종료 기한은 없습니다."
                : "세트 상태가 경기종료 또는 상세데이터 동기화일 때 투표가 열립니다."
            }
            playerOptions={selectableLines.map((line) => {
              const player = players.find((item) => item.id === line.playerId);
              const champion = champions.find((item) => item.id === line.championId);
              const team = teams.find((item) => item.id === line.teamId);
              const playerRatings = setRatings.filter((rating) => rating.playerId === line.playerId);
              const ratingTotal = playerRatings.reduce((sum, rating) => sum + rating.rating, 0);
              const myRating = currentUserId
                ? playerRatings.find((rating) => rating.authorId === currentUserId)?.rating
                : undefined;
              return {
                value: line.playerId,
                name: player?.name ?? "-",
                position: line.position,
                teamId: line.teamId,
                teamName: team?.shortName ?? team?.name ?? "-",
                teamLogoUrl: team?.logoUrl || undefined,
                teamPrimaryColor: team?.primaryColor,
                profileImageUrl: player?.profileImageUrl || undefined,
                championImageUrl: championImage(champion) || undefined,
                championName: champion?.name,
                averageRating: playerRatings.length > 0 ? ratingTotal / playerRatings.length : undefined,
                ratingCount: playerRatings.length,
                myRating,
                isPog: leader?.playerId === line.playerId,
              };
            })}
          />
        </div>
      </section>

      <section className="mt-3 sm:mt-5">
        <RatingCommentList
          viewerId={currentUserId}
          items={reviewRows.map((rating) => {
            const player = players.find((item) => item.id === rating.playerId);
            return {
              id: rating.id,
              matchId: rating.matchId,
              playerId: rating.playerId,
              playerName: player?.name ?? "-",
              playerImageUrl: player?.profileImageUrl ?? null,
              rating: rating.rating,
              review: rating.review,
              authorId: rating.authorId,
              authorName: rating.authorNickname ?? "익명",
              authorImageUrl: rating.authorProfileImageUrl,
              authorTier: rating.authorTier,
              honorCount: rating.honorCount,
              dislikeCount: rating.dislikeCount,
              initialReaction: reactionStates[rating.id] ?? null,
            };
          })}
        />
      </section>
    </div>
  );
}

export default async function MatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<{ tab?: string; set?: string }>;
}) {
  const [{ matchId }, query] = await Promise.all([params, searchParams]);
  const match = await getMatchById(matchId);

  if (!match) {
    notFound();
  }

  const currentUser = await getCurrentUser();

  const [
    teams,
    players,
    matchSets,
    fanRatings,
    predictionMarket,
    tournaments,
    stages,
    setVods,
  ] = await Promise.all([
    getAllTeams(),
    getAllPlayers(),
    getSetsByMatchId(match.id),
    getFanRatingsByMatchId(match.id),
    getPredictionMarketData(currentUser?.id),
    getTournaments(),
    getStages(),
    getMatchVodsByMatchId(match.id),
  ]);

  const requestedSet = matchSets.find((set) => set.id === query.set);
  const defaultSet =
    requestedSet ??
    matchSets.find((set) => set.setNumber === 1) ??
    matchSets[0];
  const matchPlayerStatLines =
    matchSets.length > 0
      ? await getPlayerStatLines(matchSets.map((set) => set.id))
      : [];
  const defaultTab: MatchTab = defaultSet ? "data" : "preview";
  const activeTab = normalizeTab(query.tab, defaultTab);
  const activeSet = requestedSet ?? defaultSet;
  const fanRatingReactionStates = currentUser
    ? await getFanRatingReactionStates(fanRatings.map((rating) => rating.id), currentUser.id)
    : {};
  const tournament = tournaments.find((item) => item.id === match.tournamentId);
  const stage = stages.find((item) => item.id === match.stageId);
  const teamA = teams.find((team) => team.id === match.teamAId);
  const teamB = teams.find((team) => team.id === match.teamBId);
  const teamAName = teamLabel(teams, match.teamAId);
  const teamBName = teamLabel(teams, match.teamBId);
  const teamAResult: "WIN" | "LOSS" | null = match.winnerTeamId
    ? match.winnerTeamId === match.teamAId ? "WIN" : "LOSS"
    : null;
  const teamBResult: "WIN" | "LOSS" | null = match.winnerTeamId
    ? match.winnerTeamId === match.teamBId ? "WIN" : "LOSS"
    : null;
  const hasScore = match.teamAScore !== null || match.teamBScore !== null;
  const displayStatusLabel = matchStatusLabel(isMatchLive(match) ? "live" : match.status);
  const topFanLeader = fanRatingLeader(fanRatings);
  const pomPlayer = players.find((p) => p.id === match.officialPomPlayerId);
  const topFanPlayer = topFanLeader ? players.find((p) => p.id === topFanLeader.playerId) : undefined;
  // Snapshot once per dynamic request; the client receives the same cutoff as the predictions page.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  const activeSetCard = activeSet ? (
    <SetDetailContent matchId={matchId} setId={activeSet.id} embedded />
  ) : (
    <div className="rounded-lg border border-dashed border-[var(--ui-border)] p-4 text-sm text-[var(--ui-muted)]">
      세트 데이터가 아직 연결되지 않았습니다.
    </div>
  );

  const poll = (
    <section aria-label="LP 승부예측">
      <PredictionMatchBar match={match} teamA={teamA} teamB={teamB} bets={predictionMarket.bets.filter((bet) => bet.matchId === match.id)} currentUserId={currentUser?.id} balance={predictionMarket.balance} now={now} />
    </section>
  );
  // "preview" 탭에서만 필요한 전체 매치/세트 히스토리는 그 탭일 때만 조회한다.
  // "data" 탭이 기본인 완료된 경기가 대다수라 이 전체 스캔을 매 요청 무조건 돌리면 낭비다.
  let previewMatches: Match[] = [];
  let previewSets: SetResult[] = [];
  if (activeTab === "preview") {
    [previewMatches, previewSets] = await Promise.all([getMatches(), getSets()]);
  }
  // "rating" 탭 선수 카드에 세트에서 픽한 챔피언 아이콘을 보여주기 위함 — 다른 탭은 필요 없다.
  const ratingChampions: Champion[] = activeTab === "rating" ? await getChampions() : [];
  const aiPreview = activeTab === "preview"
    ? await getMatchAiPreview({
        match,
        tournament,
        teams,
        matches: previewMatches,
        sets: previewSets,
        tournaments,
      })
    : null;
  const embedUrl = youtubeEmbedUrl(match.vodUrl);
  return (
    <main className="layout-wide match-detail-page flex flex-col gap-5 pb-12 pt-5 text-[var(--ui-text)]">
      {/*
        페이지 제목 역할까지 이 카드가 겸한다. 별도 PageHeader를 두면 팀명이 카드와 그대로
        겹치고, 남는 건 400 weight 한 줄뿐이라 아래 스코어에 눌려 헤더가 없느니만 못했다.
      */}
      <div className="flex flex-col gap-2">
        <section className="mobile-full-bleed overflow-hidden rounded-md border border-[var(--ui-border)] md:mx-0" aria-label="매치 요약">
          <h1 className="sr-only">{`${teamAName} vs ${teamBName}`}</h1>

          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-2 text-[11px] font-medium text-[var(--ui-muted)] sm:px-6">
            <span className="min-w-0 truncate text-left font-bold text-[var(--ui-ink)]">{tournament?.name ?? "대회 미지정"}</span>
            {pomPlayer ? (
              <PlayerHighlight label="POM" player={pomPlayer} />
            ) : (
              <span className="rounded-full bg-[var(--ui-ink)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ui-surface)]">
                {displayStatusLabel}
              </span>
            )}
            <span className="min-w-0 truncate text-right">
              {stage?.name ?? "스테이지 미지정"} · BO{match.bestOf ?? "-"}
            </span>
          </div>

          <div className="mx-auto grid w-full max-w-[720px] min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-3 sm:gap-5 sm:px-6 sm:py-4">
            <CompactTeamBlock team={teamA} teamName={teamAName} result={teamAResult} />

            <div className="flex min-w-[5.5rem] shrink-0 flex-col items-center px-1 sm:min-w-[7rem]">
              {hasScore ? (
                <>
                  <div className="flex items-center gap-2 rounded-xl bg-[var(--ui-ink)] px-3.5 py-2 text-[25px] font-black leading-none text-[var(--ui-surface)] shadow-sm tabular-nums sm:text-[30px]">
                    <span className={teamAResult === "LOSS" ? "opacity-45" : ""}>{scoreLabel(match.teamAScore)}</span>
                    <span className="text-xs font-medium opacity-40">:</span>
                    <span className={teamBResult === "LOSS" ? "opacity-45" : ""}>{scoreLabel(match.teamBScore)}</span>
                  </div>
                  <span className="mt-1 text-[10px] font-medium text-[var(--ui-muted)] sm:text-[11px]">{formatDateTime(match.matchDate)}</span>
                </>
              ) : (
                <>
                  <span className="rounded-xl bg-[var(--ui-ink)] px-4 py-2 text-xl font-black leading-none text-[var(--ui-surface)] shadow-sm sm:text-[28px]">VS</span>
                  <span className="mt-1 text-[10px] font-medium text-[var(--ui-muted)] sm:text-[11px]">{formatDateTime(match.matchDate)}</span>
                </>
              )}
            </div>

            <CompactTeamBlock align="right" team={teamB} teamName={teamBName} result={teamBResult} />
          </div>
        </section>

        <TabNav activeTab={activeTab} sets={matchSets} showLive={match.status !== "completed"} />
      </div>

      {activeTab === "preview" ? (
        <MatchPreview
          match={match}
          teams={teams}
          matches={previewMatches}
          sets={previewSets}
          poll={poll}
          aiPreview={aiPreview!}
        />
      ) : null}

      {activeTab === "live" ? (
        <LiveMatchFeed matchId={match.id} teamA={teamA} teamB={teamB} />
      ) : null}

      {activeTab === "data" ? (
        <section className="flex flex-col gap-3" aria-label="세트 데이터">
          <SetSelector sets={matchSets} activeSet={activeSet} />
          {activeSetCard}
        </section>
      ) : null}

      {activeTab === "rating" ? (
        <div className="flex flex-col gap-2.5">
          <MatchRatingPanel
            matchId={matchId}
            set={activeSet}
            sets={matchSets}
            teams={teams}
            players={players}
            playerStatLines={matchPlayerStatLines}
            fanRatings={fanRatings}
            champions={ratingChampions}
            isLoggedIn={Boolean(currentUser)}
            currentUserId={currentUser?.id}
            reactionStates={fanRatingReactionStates}
          />
        </div>
      ) : null}

      {activeTab === "video" ? (
        <section
          className="mobile-full-bleed mobile-surface-media rounded-md border border-border bg-surface p-3 md:mx-0"
          aria-labelledby="match-video"
        >
          <h2 id="match-video" className="home-section-title text-[length:var(--ui-title-size)]">
            영상
          </h2>
          {match.vodUrl || setVods.length > 0 ? (
            <div className="mt-3 flex flex-col gap-2.5">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={`${match.name} VOD`}
                  className="aspect-video w-full rounded-md border border-border"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : null}
              {match.vodUrl ? (
                <Link
                  href={match.vodUrl}
                  className="text-[15px] font-semibold text-accent"
                  target="_blank"
                >
                  원본 영상 열기
                </Link>
              ) : null}
              {setVods.length > 0 ? <SetVodPlayer vods={setVods} matchName={match.name} /> : null}
            </div>
          ) : (
            <p className="mt-3 rounded-md border border-dashed border-border p-3 text-sm text-muted">
              아직 연결된 영상 URL이 없습니다.
            </p>
          )}
        </section>
      ) : null}

      <AdSlot placement="horizontal" className="hidden h-[60px] md:block xl:h-[90px]" />
    </main>
  );
}
