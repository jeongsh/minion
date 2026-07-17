import Link from "next/link";

import { notFound } from "next/navigation";

import { HomeUpcomingPredictionCard } from "@/components/domain/home-upcoming-prediction-card";
import { PageHeader } from "@/components/ui/page-header";
import { AdSlot } from "@/components/ui/ad-slot";
import { TeamLogo } from "@/components/ui/team-logo";
import {
  getAllPlayers,
  getAllTeams,
  getFanRatings,
  getMatchById,
  getMatches,
  getPlayerStatLines,
  getSets,
  getSetsByMatchId,
  getStages,
  getTournaments,
} from "@/lib/data/lck";
import type { FanRating, Player, PlayerStatLine, SetResult, Team } from "@/lib/types";
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
    <div className={`min-w-0 ${isRight ? "text-right" : "text-left"}`}>
      <p className="truncate text-sm font-black leading-tight text-[var(--ui-ink)] sm:text-lg">
        {teamName}
      </p>
      {resultLabel ? (
        <p className={`text-xs font-medium ${result === "WIN" ? "text-[var(--accent)]" : "text-[var(--ui-muted)]"}`}>
          {resultLabel}
        </p>
      ) : null}
    </div>
  );
  const logo = <TeamLogo team={team} size="h-9 w-9 sm:h-12 sm:w-12" plain themeAware />;

  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2 sm:gap-2.5 ${isRight ? "justify-start" : "justify-end"}`}>
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
  const linkClass = (active: boolean) =>
    `relative flex min-h-11 items-center justify-center px-1 text-[13px] font-bold transition-colors after:absolute after:inset-x-1 after:bottom-0 after:h-0.5 sm:min-h-12 sm:px-0 sm:text-base ${
      active
        ? "text-[var(--ui-ink)] after:bg-[var(--accent)]"
        : "text-[var(--ui-muted)] after:bg-transparent hover:text-[var(--ui-ink)]"
    }`;
  return (
    <nav className="mobile-full-bleed grid border-b border-[var(--ui-border)] sm:flex sm:items-center sm:gap-6 md:mx-0" style={{ gridTemplateColumns: `repeat(${sets.length > 0 ? 4 : 3}, minmax(0, 1fr))` }} aria-label="매치 상세 탭">
      <Link href={tabHref("preview")} className={linkClass(activeTab === "preview")}>
        {TAB_LABELS.preview}
      </Link>
      {sets.length > 0 ? (
        <Link href={tabHref("data", firstSetId)} className={linkClass(activeTab === "data")}>{TAB_LABELS.data}</Link>
      ) : null}
      <Link href={tabHref("rating", firstSetId)} className={linkClass(activeTab === "rating")}>
        {TAB_LABELS.rating}
      </Link>
      <Link href={tabHref("video")} className={linkClass(activeTab === "video")}>
        {TAB_LABELS.video}
      </Link>
    </nav>
  );
}

function SetSelector({
  sets,
  activeSet,
  tab = "data",
}: {
  sets: SetResult[];
  activeSet?: SetResult;
  tab?: Extract<MatchTab, "data" | "rating">;
}) {
  if (sets.length === 0) return null;

  return (
    <div className="mobile-full-bleed sticky top-[var(--ui-header-height)] z-20 flex gap-1 overflow-x-auto border-b border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-1.5 md:mx-0 md:px-0">
      {sets.map((set) => (
        <Link
          key={set.id}
          href={tabHref(tab, set.id)}
          className={`shrink-0 rounded-md px-3.5 py-2 text-sm font-bold transition-colors ${
            activeSet?.id === set.id
              ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]"
              : "bg-[var(--ui-surface)] text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)] hover:text-[var(--ui-ink)]"
          }`}
        >
          {setLabel(set)}
        </Link>
      ))}
    </div>
  );
}

const ratingOptions = [5, 4.5, 4, 3.5, 3, 2.5, 2, 1.5, 1];
const positionOrder = new Map<Player["position"], number>(
  ["TOP", "JGL", "MID", "BOT", "SUP"].map((position, index) => [
    position as Player["position"],
    index,
  ]),
);

function playerInitial(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function PlayerAvatar({
  player,
  size = "md",
}: {
  player?: Player;
  size?: "md" | "lg";
}) {
  const sizeClass = size === "lg" ? "h-16 w-16" : "h-9 w-9";

  if (player?.profileImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.profileImageUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-lg object-cover object-top`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} grid shrink-0 place-items-center rounded-lg bg-[var(--ui-surface-muted)] text-xs font-black text-[var(--ui-muted)]`}
      aria-hidden="true"
    >
      {player ? playerInitial(player.name) : "-"}
    </span>
  );
}

function averageRating(ratings: FanRating[]) {
  if (ratings.length === 0) return null;
  return ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length;
}

function RatingPlayerRow({
  line,
  player,
  ratings,
}: {
  line: PlayerStatLine;
  player?: Player;
  ratings: FanRating[];
}) {
  const average = averageRating(ratings);

  return (
    <div className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2.5 border-b border-[var(--ui-border)] px-3 py-2.5 last:border-b-0">
      <PlayerAvatar player={player} />
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-[var(--ui-ink)]">{player?.name ?? "-"}</p>
        <p className="text-xs font-bold text-[var(--ui-muted)]">{line.position}</p>
      </div>
      <div className="text-right">
        <p className="text-base font-black tabular-nums text-[var(--ui-ink)]">
          {average == null ? "-" : average.toFixed(1)}
        </p>
        <p className="text-xs font-semibold text-[var(--ui-muted)]">{ratings.length}개</p>
      </div>
    </div>
  );
}

function TeamRatingColumn({
  title,
  teamId,
  rows,
  players,
  ratings,
}: {
  title: string;
  teamId: string;
  rows: PlayerStatLine[];
  players: Player[];
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
    <section className="mobile-list-shell overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)]">
      <h3 className="border-b border-[var(--ui-border)] px-3 py-2.5 text-sm font-black text-[var(--ui-ink)]">
        {title}
      </h3>
      {teamRows.length === 0 ? (
        <p className="p-3 text-sm text-[var(--ui-muted)]">평점 대상 선수가 없습니다.</p>
      ) : (
        teamRows.map((line) => (
          <RatingPlayerRow
            key={`${line.setId}-${line.playerId}`}
            line={line}
            player={players.find((player) => player.id === line.playerId)}
            ratings={ratings.filter((rating) => rating.playerId === line.playerId)}
          />
        ))
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
}: {
  matchId: string;
  set?: SetResult;
  sets: SetResult[];
  teams: Team[];
  players: Player[];
  playerStatLines: PlayerStatLine[];
  fanRatings: FanRating[];
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
        <div className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--ui-muted)]">SET POG</p>
          {leader ? (
            <div className="mt-3 flex items-center gap-3">
              <PlayerAvatar player={leaderPlayer} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-[var(--ui-ink)]">
                  {leaderPlayer?.name ?? "-"}
                </p>
                <p className="mt-1 text-sm font-semibold text-[var(--ui-muted)]">
                  {teamLabel(teams, leaderPlayer?.teamId)} · {leader.count}개 평점
                </p>
                <p className="mt-2 text-2xl font-black leading-none tabular-nums text-[var(--ui-ink)]">
                  {leader.average.toFixed(1)}
                  <span className="text-sm font-bold text-[var(--ui-muted)]"> / 5</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-[var(--ui-muted)]">아직 집계된 평점이 없습니다.</p>
          )}
        </div>

        <div className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
          <SetRatingForm
            matchId={matchId}
            setId={set.id}
            ratingOpen={ratingOpen}
            playerOptions={selectableLines.map((line) => {
              const player = players.find((item) => item.id === line.playerId);
              return {
                value: line.playerId,
                label: `${teamLabel(teams, line.teamId)} · ${line.position} · ${player?.name ?? "-"}`,
              };
            })}
            ratingOptions={ratingOptions}
          />
          {ratingOpen && ratingDeadline ? (
            <p className="mt-2 text-sm font-semibold text-[var(--ui-muted)]">
              평점 입력 마감: {formatDateTime(ratingDeadline.toISOString())} (경기 종료 후 3시간)
            </p>
          ) : ratingClosed ? (
            <p className="mt-2 text-sm font-semibold text-[var(--ui-muted)]">
              평점 입력이 마감되었습니다. (경기 종료 후 3시간)
            </p>
          ) : (
            <p className="mt-2 text-sm font-semibold text-[var(--ui-muted)]">
              세트 상태가 경기종료 또는 상세데이터 동기화일 때 투표가 열립니다.
            </p>
          )}
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
          ratings={setRatings}
        />
        <TeamRatingColumn
          title={teamLabel(teams, set.redTeamId)}
          teamId={set.redTeamId}
          rows={setLines}
          players={players}
          ratings={setRatings}
        />
      </section>

      <section className="mobile-list-shell rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-4">
        <h3 className="text-base font-black text-[var(--ui-ink)]">한줄평</h3>
        {reviewRows.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--ui-muted)]">아직 작성된 한줄평이 없습니다.</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {reviewRows.map((rating) => {
              const player = players.find((item) => item.id === rating.playerId);
              return (
                <article
                  key={rating.id}
                  className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-2.5"
                >
                  <PlayerAvatar player={player} />
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[var(--ui-ink)]">{player?.name ?? "-"}</p>
                    <p className="mt-1 text-sm leading-5 text-[var(--ui-text)]">{rating.review}</p>
                  </div>
                  <p className="text-sm font-black tabular-nums text-[var(--ui-ink)]">
                    {rating.rating.toFixed(1)}
                  </p>
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
    allSets,
    fanRatings,
    predictionMarket,
    tournaments,
    stages,
    matches,
  ] = await Promise.all([
    getAllTeams(),
    getAllPlayers(),
    getSetsByMatchId(match.id),
    getSets(),
    getFanRatings(),
    getPredictionMarketData(currentUser?.id),
    getTournaments(),
    getStages(),
    getMatches(),
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
  const matchSetIds = new Set(matchSets.map((s) => s.id));
  const matchFanRatings = fanRatings.filter((r) => matchSetIds.has(r.setId));
  const topFanLeader = fanRatingLeader(matchFanRatings);
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
  const aiPreview = activeTab === "preview"
    ? await getMatchAiPreview({ match, teams, matches, sets: allSets })
    : null;
  const embedUrl = youtubeEmbedUrl(match.vodUrl);
  return (
    <main className="layout-wide match-detail-page flex flex-col gap-5 bg-[var(--ui-surface)] pb-12 pt-5 text-[var(--ui-text)]">
      <PageHeader
        title={`${teamAName} vs ${teamBName}`}
        breadcrumbs={[{ label: "경기 일정", href: "/schedule" }, { label: `${teamAName} vs ${teamBName}` }]}
        className="gap-2 md:[&_.home-section-title]:text-2xl"
        action={
          <Link href="/schedule" className="text-[13px] font-bold text-[var(--ui-muted)] transition-colors hover:text-[var(--ui-ink)]">
            일정 목록
          </Link>
        }
      />

      <section className="mobile-full-bleed mobile-surface-section overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] md:mx-0" aria-label="매치 요약">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-3 pt-2.5 text-xs font-bold text-[var(--ui-muted)]">
          <span className="text-[var(--ui-ink)]">{tournament?.name ?? "대회 미지정"}</span>
          {stage ? <><span aria-hidden>·</span><span>{stage.name}</span></> : null}
          <span aria-hidden>·</span>
          <span>{formatDateTime(match.matchDate)}</span>
        </div>
        <div className="flex items-center gap-2.5 px-3 pb-3 pt-2.5 sm:gap-4 sm:px-4">
          <CompactTeamBlock team={teamA} teamName={teamAName} result={teamAResult} />

          <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
            {hasScore ? (
              <>
                <span className={`text-2xl font-black tabular-nums sm:text-3xl ${teamAResult === "LOSS" ? "text-[var(--ui-muted)]" : "text-[var(--ui-ink)]"}`}>
                  {scoreLabel(match.teamAScore)}
                </span>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-xs font-medium text-[var(--accent)]">{displayStatusLabel}</span>
                  <span className="text-xs font-medium text-[var(--ui-muted)]">BO{match.bestOf ?? "-"}</span>
                </div>
                <span className={`text-2xl font-black tabular-nums sm:text-3xl ${teamBResult === "LOSS" ? "text-[var(--ui-muted)]" : "text-[var(--ui-ink)]"}`}>
                  {scoreLabel(match.teamBScore)}
                </span>
              </>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-xl font-black text-[var(--ui-muted)] sm:text-2xl">VS</span>
                <span className="text-xs font-medium text-[var(--ui-muted)]">{displayStatusLabel} · BO{match.bestOf ?? "-"}</span>
              </div>
            )}
          </div>

          <CompactTeamBlock align="right" team={teamB} teamName={teamBName} result={teamBResult} />
        </div>

        {(pomPlayer || topFanPlayer) ? (
          <aside className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1.5 border-t border-[var(--ui-border)] px-3 py-2">
            {pomPlayer ? <PlayerHighlight label="POM" player={pomPlayer} /> : null}
            {topFanPlayer ? <PlayerHighlight label="팬 평점 1위" player={topFanPlayer} /> : null}
          </aside>
        ) : null}
      </section>

      <TabNav activeTab={activeTab} sets={matchSets} />

      {activeTab === "preview" ? (
        <MatchPreview
          match={match}
          teams={teams}
          matches={matches}
          sets={allSets}
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
          {match.vodUrl ? (
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
              <Link
                href={match.vodUrl}
                className="text-[15px] font-semibold text-accent"
                target="_blank"
              >
                원본 영상 열기
              </Link>
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
