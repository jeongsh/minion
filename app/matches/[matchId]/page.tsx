import Link from "next/link";
import { Star } from "lucide-react";

import { notFound } from "next/navigation";

import { HomeUpcomingPredictionCard } from "@/components/domain/home-upcoming-prediction-card";
import { SetVodPlayer } from "@/components/domain/set-vod-player";
import { SegmentedControl, UnderlineNav, type TabItem } from "@/components/ui/tabs";
import { AdSlot } from "@/components/ui/ad-slot";
import { TeamLogo } from "@/components/ui/team-logo";
import {
  getAllPlayers,
  getAllTeams,
  getChampions,
  getFanRatingsByMatchId,
  getMatchById,
  getMatches,
  getPlayerStatLines,
  getSets,
  getMatchVodsByMatchId,
  getSetsByMatchId,
  getStages,
  getTournaments,
} from "@/lib/data/lck";
import { championImage, championLabel } from "@/lib/champions";
import type { Champion, FanRating, Match, Player, PlayerStatLine, SetResult, Team } from "@/lib/types";
import { isMatchLive, matchStatusLabel } from "@/lib/match-display";
import {
  SET_RATING_OPEN_WINDOW_MS,
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

import { MatchPreview } from "./match-preview";
import { SetDetailContent } from "./sets/[setId]/page";
import { SetRatingForm } from "./set-rating-form";

type MatchTab = "preview" | "data" | "rating" | "video";

const TAB_LABELS: Record<MatchTab, string> = {
  preview: "프리뷰",
  data: "세트",
  rating: "평가",
  video: "영상",
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
      <p className="truncate text-[18px] font-black leading-none text-[var(--ui-ink)] sm:text-[22px]">
        {teamName}
      </p>
      {resultLabel ? (
        <p className={`mt-1 text-xs font-semibold ${result === "WIN" ? "text-[var(--accent)]" : "text-[var(--ui-muted)]"}`}>
          {resultLabel}
        </p>
      ) : null}
    </div>
  );
  const logo = <TeamLogo team={team} size="h-10 w-10 sm:h-14 sm:w-14" plain themeAware />;

  return (
    <div
      className={`grid min-w-0 items-center gap-2 px-1 py-1 sm:gap-3 sm:px-2 ${
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
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="grid h-6 w-6 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
        {player?.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.profileImageUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <span className="text-xs font-medium text-[var(--ui-muted)]">{player?.name?.slice(0, 2) ?? "-"}</span>
        )}
      </span>
      <span className="text-xs font-medium text-[var(--ui-muted)]">{label}</span>
      <span className="truncate text-xs font-black text-[var(--ui-ink)]">{player?.name ?? "집계 전"}</span>
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
    value === "video"
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
}: {
  activeTab: MatchTab;
  sets: SetResult[];
}) {
  const firstSetId = sets[0]?.id;
  const items: TabItem[] = [
    { key: "preview", label: TAB_LABELS.preview, href: tabHref("preview") },
    ...(sets.length > 0
      ? [{ key: "data", label: TAB_LABELS.data, href: tabHref("data", firstSetId) }]
      : []),
    { key: "rating", label: TAB_LABELS.rating, href: tabHref("rating", firstSetId) },
    { key: "video", label: TAB_LABELS.video, href: tabHref("video") },
  ];

  return (
    <UnderlineNav
      items={items}
      activeKey={activeTab}
      ariaLabel="매치 상세 탭"
      bordered={false}
      className="border-t border-[var(--ui-border)] px-4 sm:px-6"
    />
  );
}

/**
 * 탭 안에서 세트를 좁히는 2차 컨트롤이라 세그먼티드 컨트롤 언어를 쓴다.
 * 세트가 하나뿐이면 고를 것이 없으므로 그리지 않는다.
 */
function SetSelector({
  sets,
  activeSet,
  tab = "data",
}: {
  sets: SetResult[];
  activeSet?: SetResult;
  tab?: Extract<MatchTab, "data" | "rating">;
}) {
  if (sets.length <= 1) return null;

  return (
    <div className="sticky top-[var(--ui-header-height)] z-20 -mx-1 bg-[var(--ui-surface)] px-1 py-1.5">
      <SegmentedControl
        items={sets.map((set) => ({
          key: set.id,
          label: setLabel(set),
          href: tabHref(tab, set.id),
        }))}
        activeKey={activeSet?.id ?? ""}
        ariaLabel="세트 선택"
        className="tab-scroll max-w-full overflow-x-auto"
      />
    </div>
  );
}

const positionOrder = new Map<Player["position"], number>(
  ["TOP", "JGL", "MID", "BOT", "SUP"].map((position, index) => [
    position as Player["position"],
    index,
  ]),
);

function playerInitial(name: string) {
  return name.slice(0, 2).toUpperCase();
}

/** 평균 평점(예: 4.3)을 별 5개로 시각화. 반쪽 단위가 아니라 실제 소수점 비율만큼 채운다. */
function StarRatingDisplay({ value, size = "h-5 w-5" }: { value: number; size?: string }) {
  return (
    <div className="flex" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const fillPercent = Math.round(Math.max(0, Math.min(1, value - i)) * 100);
        return (
          <span key={i} className={`relative ${size}`}>
            <Star className={`absolute inset-0 ${size} text-[var(--ui-border)]`} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fillPercent}%` }}>
              <Star fill="currentColor" className={`${size} text-amber-400`} />
            </span>
          </span>
        );
      })}
    </div>
  );
}

function averageRating(ratings: FanRating[]) {
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length;
}

function RatingPlayerCard({
  line,
  player,
  champion,
  ratings,
}: {
  line: PlayerStatLine;
  player?: Player;
  champion?: Champion;
  ratings: FanRating[];
}) {
  const average = averageRating(ratings);
  const img = championImage(champion);

  return (
    // 선수 선택 카드(set-rating-form.tsx의 PlayerChip)와 같은 세로형 카드 언어 —
    // 챔피언 아이콘 위, 이름/포지션 아래, 배지형 평점을 그 아래에 둔다.
    <div className="flex flex-col items-center gap-1 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-1.5 text-center sm:gap-1.5 sm:p-2.5">
      <div className="aspect-square w-full max-w-20 overflow-hidden rounded-lg bg-[var(--ui-surface-muted)]">
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={championLabel(champion)} className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-lg font-black text-[var(--ui-muted)]">
            {player ? playerInitial(player.name) : "-"}
          </div>
        )}
      </div>
      <p className="w-full truncate text-[11px] font-black text-[var(--ui-ink)] sm:text-sm">
        {player?.name ?? "-"}
      </p>
      <p className="text-[10px] font-bold text-[var(--ui-muted)] sm:text-xs">{line.position}</p>
      <div
        className={`flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 sm:gap-1 sm:px-2 ${
          average == null ? "bg-[var(--ui-surface-muted)]" : "bg-amber-400/15"
        }`}
      >
        <Star
          aria-hidden="true"
          className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${average == null ? "text-[var(--ui-border)]" : "fill-amber-400 text-amber-400"}`}
        />
        <span
          className={`text-[10px] font-black tabular-nums sm:text-xs ${average == null ? "text-[var(--ui-muted)]" : "text-[var(--ui-ink)]"}`}
        >
          {average == null ? "-" : average.toFixed(1)}
        </span>
        <span className="text-[9px] font-semibold text-[var(--ui-muted)] sm:text-[10px]">{ratings.length}개</span>
      </div>
    </div>
  );
}

function TeamRatingColumn({
  title,
  teamId,
  rows,
  players,
  champions,
  ratings,
}: {
  title: string;
  teamId: string;
  rows: PlayerStatLine[];
  players: Player[];
  champions: Champion[];
  ratings: FanRating[];
}) {
  const teamRows = rows
    .filter((line) => line.teamId === teamId)
    .sort(
      (a, b) =>
        (positionOrder.get(a.position) ?? 99) -
        (positionOrder.get(b.position) ?? 99),
    );

  return (
    <section className="mobile-list-shell rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3">
      <h3 className="mb-3 text-sm font-black text-[var(--ui-ink)]">{title}</h3>
      {teamRows.length === 0 ? (
        <p className="text-sm text-[var(--ui-muted)]">평점 대상 선수가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {teamRows.map((line) => (
            <RatingPlayerCard
              key={`${line.setId}-${line.playerId}`}
              line={line}
              player={players.find((player) => player.id === line.playerId)}
              champion={champions.find((champion) => champion.id === line.championId)}
              ratings={ratings.filter((rating) => rating.playerId === line.playerId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

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
  // 입력이 시작됐지만(경기 종료) 3시간이 지나 마감된 상태
  const ratingClosed = ratingStartedAt !== null && !ratingOpen;
  const ratingDeadline =
    ratingStartedAt !== null
      ? new Date(ratingStartedAt + SET_RATING_OPEN_WINDOW_MS)
      : null;
  const snapshotHref = `/matches/${matchId}/sets/${set.id}/snapshot`;
  const leader = fanRatingLeader(setRatings);
  const leaderPlayer = leader
    ? players.find((player) => player.id === leader.playerId)
    : undefined;
  const reviewRows = setRatings
    .filter((rating) => rating.review)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, 20);
  const selectableLines = [...setLines].sort((a, b) => {
    if (a.teamId !== b.teamId) return a.teamId === set.blueTeamId ? -1 : 1;
    return (
      (positionOrder.get(a.position) ?? 99) -
      (positionOrder.get(b.position) ?? 99)
    );
  });

  return (
    <div className="flex flex-col gap-4">
      <SetSelector sets={sets} activeSet={set} tab="rating" />

      <section className="grid gap-3 min-[1200px]:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="flex flex-col overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)]">
          <p className="px-4 pt-4 text-xs font-medium uppercase tracking-[0.16em] text-[var(--ui-muted)]">SET POG</p>
          {leader ? (
            // 오른쪽 선수 카드 그리드와 같은 그리드 행에 있어 높이가 stretch로 맞춰지는데,
            // 사진을 고정 크기(aspect-square)로 두면 늘어난 높이만큼 아래에 빈 공간만 남는다.
            // flex-1로 사진이 남는 세로 공간을 그대로 채우게 한다.
            <div className="mt-3 flex flex-1 min-h-0 flex-col items-center gap-2 px-4 pb-4 text-center">
              <div className="w-full min-h-0 flex-1 overflow-hidden rounded-2xl bg-[var(--ui-surface-muted)]">
                {leaderPlayer?.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={leaderPlayer.profileImageUrl}
                    alt=""
                    className="h-full w-full object-cover object-top"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-5xl font-black text-[var(--ui-muted)]">
                    {leaderPlayer ? playerInitial(leaderPlayer.name) : "-"}
                  </div>
                )}
              </div>
              <p className="truncate text-lg font-black text-[var(--ui-ink)]">{leaderPlayer?.name ?? "-"}</p>
              <p className="truncate text-xs font-semibold text-[var(--ui-muted)]">
                {teamLabel(teams, leaderPlayer?.teamId)} · {leader.count}개 평점
              </p>
              <div className="flex items-center gap-1.5">
                <StarRatingDisplay value={leader.average} />
                <span className="text-sm font-black tabular-nums text-[var(--ui-ink)]">
                  {leader.average.toFixed(1)}
                </span>
              </div>
            </div>
          ) : (
            <p className="p-4 pt-3 text-sm text-[var(--ui-muted)]">아직 집계된 평점이 없습니다.</p>
          )}
        </div>

        <div className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
          <SetRatingForm
            matchId={matchId}
            setId={set.id}
            blueTeamId={set.blueTeamId}
            ratingOpen={ratingOpen}
            isLoggedIn={isLoggedIn}
            loginHref={`/login?next=${encodeURIComponent(`/matches/${matchId}?tab=rating&set=${set.id}`)}`}
            ratingStatusNote={
              ratingOpen && ratingDeadline
                ? `평점 입력 마감: ${formatDateTime(ratingDeadline.toISOString())} (경기 종료 후 3시간)`
                : ratingClosed
                  ? "평점 입력이 마감되었습니다. (경기 종료 후 3시간)"
                  : "세트 상태가 경기종료 또는 상세데이터 동기화일 때 투표가 열립니다."
            }
            playerOptions={selectableLines.map((line) => {
              const player = players.find((item) => item.id === line.playerId);
              const champion = champions.find((item) => item.id === line.championId);
              return {
                value: line.playerId,
                name: player?.name ?? "-",
                position: line.position,
                teamId: line.teamId,
                championImageUrl: championImage(champion) || undefined,
                championName: champion?.name,
              };
            })}
          />
        </div>
      </section>

      {snapshotReady ? (
        <Link
          href={snapshotHref}
          className="flex items-center justify-between gap-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 text-sm font-bold text-[var(--ui-ink)] transition-colors hover:bg-[var(--ui-surface-muted)]"
        >
          <span>커뮤니티 공유용 스냅샷 보기</span>
          <span aria-hidden="true" className="text-[var(--ui-muted)]">&gt;</span>
        </Link>
      ) : null}

      <section className="grid gap-3 min-[1200px]:grid-cols-2">
        <TeamRatingColumn
          title={teamLabel(teams, set.blueTeamId)}
          teamId={set.blueTeamId}
          rows={setLines}
          players={players}
          champions={champions}
          ratings={setRatings}
        />
        <TeamRatingColumn
          title={teamLabel(teams, set.redTeamId)}
          teamId={set.redTeamId}
          rows={setLines}
          players={players}
          champions={champions}
          ratings={setRatings}
        />
      </section>

      <section className="mobile-list-shell rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
        <h3 className="text-base font-black text-[var(--ui-ink)]">한줄평</h3>
        {reviewRows.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--ui-muted)]">아직 작성된 한줄평이 없습니다.</p>
        ) : (
          <div className="mt-3 grid gap-2.5">
            {reviewRows.map((rating) => {
              const player = players.find((item) => item.id === rating.playerId);
              const authorName = rating.authorNickname ?? "익명";
              return (
                <article
                  key={rating.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto]"
                >
                  {rating.authorProfileImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={rating.authorProfileImageUrl}
                      alt=""
                      className="hidden h-10 w-10 shrink-0 rounded-full object-cover object-top ring-2 ring-[var(--ui-surface)] sm:block"
                    />
                  ) : (
                    <span
                      className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--ui-surface)] text-xs font-black text-[var(--ui-muted)] ring-2 ring-[var(--ui-surface)] sm:grid"
                      aria-hidden="true"
                    >
                      {playerInitial(authorName)}
                    </span>
                  )}
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="shrink-0">
                      <p className="text-sm font-black leading-tight text-[var(--ui-ink)]">{player?.name ?? "-"}</p>
                      <p className="mt-0.5 text-xs font-semibold leading-tight text-[var(--ui-muted)]">{authorName}</p>
                    </div>
                    <p className="min-w-0 flex-1 truncate text-sm italic text-[var(--ui-text)]">
                      “{rating.review}”
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StarRatingDisplay value={rating.rating} size="h-3.5 w-3.5" />
                    <p className="text-sm font-black tabular-nums text-[var(--ui-ink)]">
                      {rating.rating.toFixed(1)}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}
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

  const activeSetCard = activeSet ? (
    <SetDetailContent matchId={matchId} setId={activeSet.id} embedded />
  ) : (
    <div className="rounded-lg border border-dashed border-[var(--ui-border)] p-4 text-sm text-[var(--ui-muted)]">
      세트 데이터가 아직 연결되지 않았습니다.
    </div>
  );

  const poll = (
    <section>
      <div className="mb-2.5 flex items-end justify-between gap-3"><h2 className="home-section-title text-lg text-[var(--ui-ink)]">LP 승부예측</h2><span className="text-sm font-semibold text-[var(--ui-muted)]">예상 배당은 마감 전까지 변동됩니다</span></div>
      <HomeUpcomingPredictionCard match={match} teamA={teamA} teamB={teamB} tournament={tournament?.name} bets={predictionMarket.bets.filter((bet) => bet.matchId === match.id)} currentUserId={currentUser?.id} balance={predictionMarket.balance}/>
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
    <main className="layout-wide match-detail-page flex flex-col gap-5 bg-[var(--ui-surface)] pb-12 pt-5 text-[var(--ui-text)]">
      {/*
        페이지 제목 역할까지 이 카드가 겸한다. 별도 PageHeader를 두면 팀명이 카드와 그대로
        겹치고, 남는 건 400 weight 한 줄뿐이라 아래 스코어에 눌려 헤더가 없느니만 못했다.
      */}
      <section className="mobile-full-bleed mobile-surface-section overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] md:mx-0" aria-label="매치 요약">
        <h1 className="sr-only">{`${teamAName} vs ${teamBName}`}</h1>

        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 border-b border-[var(--ui-border)] px-4 py-2.5 text-[12px] font-semibold text-[var(--ui-muted)] sm:px-6">
          <span className="min-w-0 truncate text-left">{tournament?.name ?? "대회 미지정"}</span>
          {pomPlayer ? (
            <PlayerHighlight label="POM" player={pomPlayer} />
          ) : (
            <span className="text-[11px] uppercase tracking-[0.08em]">{displayStatusLabel}</span>
          )}
          <span className="min-w-0 truncate text-right">
            {stage?.name ?? "스테이지 미지정"} · BO{match.bestOf ?? "-"}
          </span>
        </div>

        <div className="mx-auto grid w-full max-w-[720px] min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 py-4 sm:gap-5 sm:px-6 sm:py-5">
          <CompactTeamBlock team={teamA} teamName={teamAName} result={teamAResult} />

          <div className="flex min-w-[5.75rem] shrink-0 flex-col items-center px-1 sm:min-w-[7.5rem]">
            {hasScore ? (
              <>
                <div className="flex items-center gap-2 rounded-md bg-[var(--ui-surface-muted)] px-3 py-2 text-[26px] font-black leading-none tabular-nums sm:text-[32px]">
                  <span className={teamAResult === "LOSS" ? "text-[var(--ui-muted)]" : "text-[var(--ui-ink)]"}>{scoreLabel(match.teamAScore)}</span>
                  <span className="text-sm font-medium text-[var(--ui-muted)]">:</span>
                  <span className={teamBResult === "LOSS" ? "text-[var(--ui-muted)]" : "text-[var(--ui-ink)]"}>{scoreLabel(match.teamBScore)}</span>
                </div>
                <span className="mt-1.5 text-[11px] font-semibold text-[var(--ui-muted)]">{formatDateTime(match.matchDate)}</span>
              </>
            ) : (
              <>
                <span className="text-2xl font-black leading-none text-[var(--ui-ink)] sm:text-[34px]">VS</span>
                <span className="mt-1.5 text-[11px] font-semibold text-[var(--ui-muted)]">{formatDateTime(match.matchDate)}</span>
              </>
            )}
          </div>

          <CompactTeamBlock align="right" team={teamB} teamName={teamBName} result={teamBResult} />
        </div>

        <TabNav activeTab={activeTab} sets={matchSets} />
      </section>

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
          />
        </div>
      ) : null}

      {activeTab === "video" ? (
        <section
          className="mobile-full-bleed mobile-surface-media rounded-md border border-border bg-surface p-3 md:mx-0"
          aria-labelledby="match-video"
        >
          <h2 id="match-video" className="home-section-title text-lg">
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
