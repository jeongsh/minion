import Link from "next/link";

import { notFound } from "next/navigation";

import { HomeUpcomingPredictionCard } from "@/components/domain/home-upcoming-prediction-card";
import { PageHeader } from "@/components/ui/page-header";
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
import type { FanRating, MatchStatus, Player, PlayerStatLine, SetResult, Team } from "@/lib/types";
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

import { MatchPreview } from "./match-preview";
import { SetDetailContent } from "./sets/[setId]/page";
import { SetRatingForm } from "./set-rating-form";

type MatchTab = "preview" | "data" | "rating" | "video";

const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "예정",
  live: "진행 중",
  completed: "종료",
};

const TAB_LABELS: Record<MatchTab, string> = {
  preview: "프리뷰",
  data: "매치 데이터",
  rating: "투표",
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
      <p className="truncate text-base font-black leading-tight text-[var(--ui-ink)] sm:text-xl">
        {teamName}
      </p>
      {resultLabel ? (
        <p className={`text-[15px] font-medium ${result === "WIN" ? "text-[var(--accent)]" : "text-[var(--ui-muted)]"}`}>
          {resultLabel}
        </p>
      ) : null}
    </div>
  );
  const logo = <TeamLogo team={team} size="h-11 w-11 sm:h-14 sm:w-14" plain />;

  return (
    <div className={`flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3 ${isRight ? "justify-start" : "justify-end"}`}>
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
    <span className="flex min-w-0 items-center gap-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--ui-surface-muted)]">
        {player?.profileImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={player.profileImageUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <span className="text-[15px] font-medium text-[var(--ui-muted)]">{player?.name?.slice(0, 2) ?? "-"}</span>
        )}
      </span>
      <span className="text-[15px] font-medium text-[var(--ui-muted)]">{label}</span>
      <span className="truncate text-[15px] font-black text-[var(--ui-ink)]">{player?.name ?? "집계 전"}</span>
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
  activeSetId,
  sets,
}: {
  activeTab: MatchTab;
  activeSetId?: string;
  sets: SetResult[];
}) {
  const firstSetId = sets[0]?.id;
  const linkClass = (active: boolean) =>
    `relative shrink-0 px-0 py-3 text-base font-bold transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 ${
      active
        ? "text-[var(--ui-ink)] after:bg-[var(--accent)]"
        : "text-[var(--ui-muted)] after:bg-transparent hover:text-[var(--ui-ink)]"
    }`;
  const divider = (
    <span className="h-3.5 w-px shrink-0 self-center bg-[var(--ui-border)]" aria-hidden />
  );

  return (
    <nav className="flex items-center gap-4 overflow-x-auto border-b border-[var(--ui-border)]" aria-label="매치 상세 탭">
      <Link href={tabHref("preview")} className={linkClass(activeTab === "preview")}>
        {TAB_LABELS.preview}
      </Link>
      {sets.length > 0 ? (
        <>
          {divider}
          {sets.map((set) => (
            <Link
              key={set.id}
              href={tabHref("data", set.id)}
              className={linkClass(activeTab === "data" && activeSetId === set.id)}
            >
              {setLabel(set)}
            </Link>
          ))}
          {divider}
        </>
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
    <div className="sticky top-[var(--ui-header-height)] z-20 flex gap-1 overflow-x-auto border-b border-[var(--ui-border)] bg-[var(--ui-surface)] py-2">
      {sets.map((set) => (
        <Link
          key={set.id}
          href={tabHref(tab, set.id)}
          className={`shrink-0 rounded-lg px-5 py-2.5 text-base font-bold transition-colors ${
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
  const sizeClass = size === "lg" ? "h-20 w-20" : "h-11 w-11";

  if (player?.profileImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={player.profileImageUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-xl object-cover object-top`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} grid shrink-0 place-items-center rounded-xl bg-[var(--ui-surface-muted)] text-[15px] font-black text-[var(--ui-muted)]`}
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
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-[var(--ui-border)] px-4 py-3 last:border-b-0">
      <PlayerAvatar player={player} />
      <div className="min-w-0">
        <p className="truncate text-[15px] font-black text-[var(--ui-ink)]">{player?.name ?? "-"}</p>
        <p className="text-[15px] font-bold text-[var(--ui-muted)]">{line.position}</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-black tabular-nums text-[var(--ui-ink)]">
          {average == null ? "-" : average.toFixed(1)}
        </p>
        <p className="text-[15px] font-semibold text-[var(--ui-muted)]">{ratings.length}개</p>
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
    <section className="overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
      <h3 className="border-b border-[var(--ui-border)] px-4 py-3 text-[15px] font-black text-[var(--ui-ink)]">
        {title}
      </h3>
      {teamRows.length === 0 ? (
        <p className="p-4 text-base text-[var(--ui-muted)]">평점 대상 선수가 없습니다.</p>
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
    <div className="flex flex-col gap-5">
      <SetSelector sets={sets} activeSet={set} tab="rating" />

      <section className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--ui-muted)]">SET POG</p>
          {leader ? (
            <div className="mt-4 flex items-center gap-4">
              <PlayerAvatar player={leaderPlayer} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-xl font-black text-[var(--ui-ink)]">
                  {leaderPlayer?.name ?? "-"}
                </p>
                <p className="mt-1 text-[15px] font-semibold text-[var(--ui-muted)]">
                  {teamLabel(teams, leaderPlayer?.teamId)} · {leader.count}개 평점
                </p>
                <p className="mt-3 text-[28px] font-black leading-none tabular-nums text-[var(--ui-ink)]">
                  {leader.average.toFixed(1)}
                  <span className="text-base font-bold text-[var(--ui-muted)]"> / 5</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-base text-[var(--ui-muted)]">아직 집계된 평점이 없습니다.</p>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5">
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
            <p className="mt-3 text-[15px] font-semibold text-[var(--ui-muted)]">
              평점 입력 마감: {formatDateTime(ratingDeadline.toISOString())} (경기 종료 후 3시간)
            </p>
          ) : ratingClosed ? (
            <p className="mt-3 text-[15px] font-semibold text-[var(--ui-muted)]">
              평점 입력이 마감되었습니다. (경기 종료 후 3시간)
            </p>
          ) : (
            <p className="mt-3 text-[15px] font-semibold text-[var(--ui-muted)]">
              세트 상태가 경기종료 또는 상세데이터 동기화일 때 투표가 열립니다.
            </p>
          )}
        </div>
      </section>

      {snapshotReady ? (
        <Link
          href={snapshotHref}
          className="flex items-center justify-between gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-3 text-[15px] font-bold text-[var(--ui-ink)] transition-colors hover:bg-[var(--ui-surface-muted)]"
        >
          <span>커뮤니티 공유용 스냅샷 보기</span>
          <span aria-hidden="true" className="text-[var(--ui-muted)]">&gt;</span>
        </Link>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-2">
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

      <section className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5">
        <h3 className="text-lg font-black text-[var(--ui-ink)]">한줄평</h3>
        {reviewRows.length === 0 ? (
          <p className="mt-3 text-base text-[var(--ui-muted)]">아직 작성된 한줄평이 없습니다.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {reviewRows.map((rating) => {
              const player = players.find((item) => item.id === rating.playerId);
              return (
                <article
                  key={rating.id}
                  className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3"
                >
                  <PlayerAvatar player={player} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-black text-[var(--ui-ink)]">{player?.name ?? "-"}</p>
                    <p className="mt-1 text-[15px] leading-6 text-[var(--ui-text)]">{rating.review}</p>
                  </div>
                  <p className="text-base font-black tabular-nums text-[var(--ui-ink)]">
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
  const matchSetIds = new Set(matchSets.map((s) => s.id));
  const matchFanRatings = fanRatings.filter((r) => matchSetIds.has(r.setId));
  const topFanLeader = fanRatingLeader(matchFanRatings);
  const pomPlayer = players.find((p) => p.id === match.officialPomPlayerId);
  const topFanPlayer = topFanLeader ? players.find((p) => p.id === topFanLeader.playerId) : undefined;

  const activeSetCard = activeSet ? (
    <SetDetailContent matchId={matchId} setId={activeSet.id} embedded />
  ) : (
    <div className="rounded-xl border border-dashed border-[var(--ui-border)] p-5 text-[15px] text-[var(--ui-muted)]">
      세트 데이터가 아직 연결되지 않았습니다.
    </div>
  );

  const poll = (
    <section>
      <div className="mb-3 flex items-end justify-between gap-3"><h2 className="home-section-title text-xl text-[var(--ui-ink)]">LP 승부예측</h2><span className="text-[15px] font-semibold text-[var(--ui-muted)]">예상 배당은 마감 전까지 변동됩니다</span></div>
      <HomeUpcomingPredictionCard match={match} teamA={teamA} teamB={teamB} tournament={tournament?.name} bets={predictionMarket.bets.filter((bet) => bet.matchId === match.id)} currentUserId={currentUser?.id} balance={predictionMarket.balance}/>
    </section>
  );
  const embedUrl = youtubeEmbedUrl(match.vodUrl);
  return (
    <main className="match-detail-page mx-auto flex w-full max-w-[1500px] flex-col gap-7 bg-[var(--ui-surface)] px-5 pb-16 pt-8 text-[var(--ui-text)] xl:px-10">
      <PageHeader
        title={`${teamAName} vs ${teamBName}`}
        breadcrumbs={[{ label: "경기 일정", href: "/schedule" }, { label: `${teamAName} vs ${teamBName}` }]}
        action={
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--ui-surface-muted)] px-3 py-1.5 text-[15px] font-bold text-[var(--ui-muted)]">BO{match.bestOf ?? "-"}</span>
            <span className="rounded-full bg-[var(--ui-ink)] px-3 py-1.5 text-[15px] font-bold text-[var(--ui-surface)]">{MATCH_STATUS_LABEL[match.status]}</span>
          </div>
        }
      />

      <section className="overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]" aria-label="매치 요약">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 px-4 pt-3 text-[15px] font-bold text-[var(--ui-muted)]">
          <span className="text-[var(--ui-ink)]">{tournament?.name ?? "대회 미지정"}</span>
          {stage ? <><span aria-hidden>·</span><span>{stage.name}</span></> : null}
          <span aria-hidden>·</span>
          <span>{formatDateTime(match.matchDate)}</span>
        </div>
        <div className="flex items-center gap-3 px-4 pb-4 pt-3 sm:gap-6 sm:px-6">
          <CompactTeamBlock team={teamA} teamName={teamAName} result={teamAResult} />

          <div className="flex shrink-0 items-center gap-3 sm:gap-4">
            {hasScore ? (
              <>
                <span className={`text-3xl font-black tabular-nums sm:text-4xl ${teamAResult === "LOSS" ? "text-[var(--ui-muted)]" : "text-[var(--ui-ink)]"}`}>
                  {scoreLabel(match.teamAScore)}
                </span>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[15px] font-medium text-[var(--accent)]">{MATCH_STATUS_LABEL[match.status]}</span>
                  <span className="text-xs font-medium text-[var(--ui-muted)]">BO{match.bestOf ?? "-"}</span>
                </div>
                <span className={`text-3xl font-black tabular-nums sm:text-4xl ${teamBResult === "LOSS" ? "text-[var(--ui-muted)]" : "text-[var(--ui-ink)]"}`}>
                  {scoreLabel(match.teamBScore)}
                </span>
              </>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-2xl font-black text-[var(--ui-muted)] sm:text-3xl">VS</span>
                <span className="text-[15px] font-medium text-[var(--ui-muted)]">{MATCH_STATUS_LABEL[match.status]} · BO{match.bestOf ?? "-"}</span>
              </div>
            )}
          </div>

          <CompactTeamBlock align="right" team={teamB} teamName={teamBName} result={teamBResult} />
        </div>

        {(pomPlayer || topFanPlayer) ? (
          <aside className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 border-t border-[var(--ui-border)] px-4 py-2.5">
            {pomPlayer ? <PlayerHighlight label="POM" player={pomPlayer} /> : null}
            {topFanPlayer ? <PlayerHighlight label="팬 평점 1위" player={topFanPlayer} /> : null}
          </aside>
        ) : null}
      </section>

      <TabNav activeTab={activeTab} activeSetId={activeSet?.id} sets={matchSets} />

      {activeTab === "preview" ? (
        <MatchPreview
          match={match}
          teams={teams}
          matches={matches}
          sets={allSets}
          poll={poll}
        />
      ) : null}

      {activeTab === "data" ? (
        <section className="flex flex-col gap-4" aria-label="세트 데이터">
          {activeSetCard}
        </section>
      ) : null}

      {activeTab === "rating" ? (
        <div className="flex flex-col gap-3">
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
          className="rounded-md border border-border bg-surface p-4"
          aria-labelledby="match-video"
        >
          <h2 id="match-video" className="home-section-title text-xl">
            영상
          </h2>
          {match.vodUrl ? (
            <div className="mt-4 flex flex-col gap-3">
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
            <p className="mt-4 rounded-md border border-dashed border-border p-4 text-base text-muted">
              아직 연결된 영상 URL이 없습니다.
            </p>
          )}
        </section>
      ) : null}

    </main>
  );
}
