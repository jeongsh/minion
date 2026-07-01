import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { WinnerPredictionPoll } from "@/components/domain/winner-prediction-poll";
import {
  getAllPlayers,
  getAllTeams,
  getFanMatchPredictions,
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
  playerLabel,
  teamLabel,
  topFanRatingForMatch,
} from "@/lib/view-data";

import { predictMatchWinnerAction, submitSetPlayerRatingAction } from "./actions";
import { MatchPreview } from "./match-preview";
import { SetDetailContent } from "./sets/[setId]/page";

type MatchTab = "preview" | "data" | "rating" | "video";
const RECENT_SET_FOCUS_WINDOW_MS = 30 * 60 * 1000;

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

function latestRecentlyFinishedSet(sets: SetResult[], now = Date.now()) {
  return [...sets]
    .filter((set) => {
      if (!isSetRatingOpen(set) || !set.resultRecordedAt) return false;
      const recordedAt = new Date(set.resultRecordedAt).getTime();
      return (
        Number.isFinite(recordedAt) &&
        now - recordedAt >= 0 &&
        now - recordedAt <= RECENT_SET_FOCUS_WINDOW_MS
      );
    })
    .sort((a, b) => {
      const aTime = new Date(a.resultRecordedAt ?? 0).getTime();
      const bTime = new Date(b.resultRecordedAt ?? 0).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return b.setNumber - a.setNumber;
    })[0];
}

function scoreLabel(score: number | null | undefined) {
  return score ?? "-";
}

function matchScoreLabel(teamAScore: number | null, teamBScore: number | null) {
  if (teamAScore === null && teamBScore === null) {
    return "vs";
  }

  return `${scoreLabel(teamAScore)} : ${scoreLabel(teamBScore)}`;
}

function TeamScoreBlock({
  align = "left",
  seedLabel,
  teamName,
  logoUrl,
  isWinner,
  isLoser,
  resultLabel,
}: {
  align?: "left" | "right";
  seedLabel: string;
  teamName: string;
  logoUrl?: string;
  isWinner: boolean;
  isLoser: boolean;
  resultLabel: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-2 ${align === "right" ? "items-end text-right" : ""}`}
    >
      <p className="text-sm font-bold uppercase tracking-wide text-muted">
        {seedLabel}
      </p>
      <div className={`flex items-center gap-4 ${align === "right" ? "flex-row-reverse" : ""}`}>
        {/* 로고 + 팀명 + WIN/LOSS */}
        <div className={`flex flex-col ${align === "right" ? "items-end" : ""}`}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={teamName} className="h-20 w-20 object-contain md:h-24 md:w-24" />
          ) : (
            <div className="h-20 w-20 md:h-24 md:w-24" />
          )}
          <p className="mt-2 text-lg font-semibold md:text-xl">{teamName}</p>
          <p className="mt-0.5 text-sm font-semibold text-muted">{resultLabel}</p>
        </div>
        {/* 승리/패배 마크 — 임시 숨김 */}
      </div>
    </div>
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
  firstSetId,
}: {
  activeTab: MatchTab;
  firstSetId?: string;
}) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="매치 상세 탭">
      {(Object.keys(TAB_LABELS) as MatchTab[]).map((tab) => (
        <Link
          key={tab}
          href={tabHref(
            tab,
            tab === "data" || tab === "rating" ? firstSetId : undefined,
          )}
          className={`rounded-md border px-4 py-2 text-sm font-semibold ${
            activeTab === tab
              ? "border-foreground bg-foreground"
              : "border-border bg-surface hover:bg-surface-muted"
          }`}
          style={activeTab === tab ? { color: "#ffffff" } : undefined}
        >
          {TAB_LABELS[tab]}
        </Link>
      ))}
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
    <div className="flex flex-wrap gap-2">
      {sets.map((set) => (
        <Link
          key={set.id}
          href={tabHref(tab, set.id)}
          className={`rounded-md border px-3 py-2 text-sm font-semibold ${
            activeSet?.id === set.id
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border bg-surface hover:bg-surface-muted"
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
      <img
        src={player.profileImageUrl}
        alt=""
        className={`${sizeClass} shrink-0 rounded-md object-cover object-top`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} grid shrink-0 place-items-center rounded-md border border-border bg-surface-muted text-sm font-semibold`}
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
    <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-3 py-3 last:border-b-0">
      <PlayerAvatar player={player} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{player?.name ?? "-"}</p>
        <p className="text-xs text-muted">{line.position}</p>
      </div>
      <div className="text-right">
        <p className="text-lg font-semibold tabular-nums">
          {average == null ? "-" : average.toFixed(1)}
        </p>
        <p className="text-xs text-muted">{ratings.length}개</p>
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
    <section className="overflow-hidden rounded-md border border-border bg-surface">
      <h3 className="border-b border-border px-4 py-3 text-sm font-semibold">
        {title}
      </h3>
      {teamRows.length === 0 ? (
        <p className="p-4 text-sm text-muted">평점 대상 선수가 없습니다.</p>
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
      <div className="rounded-md border border-dashed border-border bg-surface p-4 text-sm text-muted">
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
        <div className="rounded-md border border-border bg-surface p-5">
          <p className="text-xs font-semibold uppercase text-muted">SET POG</p>
          {leader ? (
            <div className="mt-4 flex items-center gap-4">
              <PlayerAvatar player={leaderPlayer} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-2xl font-semibold">
                  {leaderPlayer?.name ?? "-"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {teamLabel(teams, leaderPlayer?.teamId)} · {leader.count}개 평점
                </p>
                <p className="mt-3 text-4xl font-semibold tabular-nums">
                  {leader.average.toFixed(1)}
                  <span className="text-base text-muted"> / 5</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">아직 집계된 평점이 없습니다.</p>
          )}
        </div>

        <form
          action={submitSetPlayerRatingAction}
          className="rounded-md border border-border bg-surface p-5"
        >
          <input type="hidden" name="matchId" value={matchId} />
          <input type="hidden" name="setId" value={set.id} />
          <div className="grid gap-3 lg:grid-cols-[minmax(10rem,1fr)_8rem_minmax(12rem,1.5fr)_auto]">
            <select
              name="playerId"
              required
              disabled={!ratingOpen || selectableLines.length === 0}
              defaultValue=""
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <option value="" disabled>
                선수 선택
              </option>
              {selectableLines.map((line) => {
                const player = players.find((item) => item.id === line.playerId);
                return (
                  <option key={`${line.setId}-${line.playerId}`} value={line.playerId}>
                    {teamLabel(teams, line.teamId)} · {line.position} · {player?.name ?? "-"}
                  </option>
                );
              })}
            </select>
            <select
              name="rating"
              required
              disabled={!ratingOpen || selectableLines.length === 0}
              defaultValue=""
              className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <option value="" disabled>
                점수
              </option>
              {ratingOptions.map((value) => (
                <option key={value} value={value}>
                  {value.toFixed(1)}
                </option>
              ))}
            </select>
            <input
              name="review"
              maxLength={240}
              disabled={!ratingOpen || selectableLines.length === 0}
              placeholder="한줄평"
              className="min-w-0 rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!ratingOpen || selectableLines.length === 0}
              className="rounded-md border border-foreground bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-muted disabled:text-muted"
            >
              제출
            </button>
          </div>
          {ratingOpen && ratingDeadline ? (
            <p className="mt-3 text-sm text-muted">
              평점 입력 마감: {formatDateTime(ratingDeadline.toISOString())} (경기 종료 후 3시간)
            </p>
          ) : ratingClosed ? (
            <p className="mt-3 text-sm text-muted">
              평점 입력이 마감되었습니다. (경기 종료 후 3시간)
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted">
              세트 상태가 경기종료 또는 상세데이터 동기화일 때 투표가 열립니다.
            </p>
          )}
        </form>
      </section>

      {snapshotReady ? (
        <Link
          href={snapshotHref}
          className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-4 py-3 text-sm font-semibold hover:bg-surface-muted"
        >
          <span>커뮤니티 공유용 스냅샷 보기</span>
          <span aria-hidden="true" className="text-muted">&gt;</span>
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

      <section className="rounded-md border border-border bg-surface p-5">
        <h3 className="text-lg font-semibold">한줄평</h3>
        {reviewRows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">아직 작성된 한줄평이 없습니다.</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {reviewRows.map((rating) => {
              const player = players.find((item) => item.id === rating.playerId);
              return (
                <article
                  key={rating.id}
                  className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-3 rounded-md border border-border bg-background p-3"
                >
                  <PlayerAvatar player={player} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{player?.name ?? "-"}</p>
                    <p className="mt-1 text-sm text-muted">{rating.review}</p>
                  </div>
                  <p className="text-sm font-semibold tabular-nums">
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

  const [
    teams,
    players,
    matchSets,
    allSets,
    fanRatings,
    predictions,
    tournaments,
    stages,
    matches,
  ] = await Promise.all([
    getAllTeams(),
    getAllPlayers(),
    getSetsByMatchId(match.id),
    getSets(),
    getFanRatings(),
    getFanMatchPredictions(match.id),
    getTournaments(),
    getStages(),
    getMatches(),
  ]);

  const requestedSet = matchSets.find((set) => set.id === query.set);
  const defaultSet =
    requestedSet ??
    latestRecentlyFinishedSet(matchSets) ??
    matchSets[0];
  const matchPlayerStatLines =
    matchSets.length > 0
      ? await getPlayerStatLines(matchSets.map((set) => set.id))
      : [];
  const defaultTab: MatchTab =
    requestedSet ||
    (defaultSet &&
    (match.status !== "scheduled" ||
      defaultSet.status !== "scheduled"))
      ? "data"
      : "preview";
  const activeTab = normalizeTab(query.tab, defaultTab);
  const activeSet = requestedSet ?? defaultSet;
  const tournament = tournaments.find((item) => item.id === match.tournamentId);
  const stage = stages.find((item) => item.id === match.stageId);
  const teamAName = teamLabel(teams, match.teamAId);
  const teamBName = teamLabel(teams, match.teamBId);
  const teamALogoUrl = teams.find((t) => t.id === match.teamAId)?.logoUrl;
  const teamBLogoUrl = teams.find((t) => t.id === match.teamBId)?.logoUrl;
  const teamAResult = match.winnerTeamId
    ? match.winnerTeamId === match.teamAId
      ? "WIN"
      : "LOSS"
    : MATCH_STATUS_LABEL[match.status];
  const teamBResult = match.winnerTeamId
    ? match.winnerTeamId === match.teamBId
      ? "WIN"
      : "LOSS"
    : MATCH_STATUS_LABEL[match.status];
  const matchSetIds = new Set(matchSets.map((s) => s.id));
  const matchFanRatings = fanRatings.filter((r) => matchSetIds.has(r.setId));
  const topFanLeader = fanRatingLeader(matchFanRatings);
  const pomPlayer = players.find((p) => p.id === match.officialPomPlayerId);
  const topFanPlayer = topFanLeader ? players.find((p) => p.id === topFanLeader.playerId) : undefined;

  const cookieStore = await cookies();
  const voterKey = cookieStore.get("lckhub_match_prediction_voter")?.value;
  // 경기중(예정이 아니어도 아직 완료 전)에도 승자예측 투표를 열어두고, 경기 종료 시 마감
  const predictionClosed = match.status === "completed";

  const activeSetCard = activeSet ? (
    <SetDetailContent matchId={matchId} setId={activeSet.id} embedded />
  ) : (
    <div className="rounded-md border border-dashed border-border bg-surface p-4 text-sm text-muted">
      세트 데이터가 아직 연결되지 않았습니다.
    </div>
  );

  const poll = (
    <WinnerPredictionPoll
      match={match}
      teams={teams}
      predictions={predictions}
      voterKey={voterKey}
      closed={predictionClosed}
      action={predictMatchWinnerAction}
    />
  );
  const embedUrl = youtubeEmbedUrl(match.vodUrl);
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <section
        className="overflow-hidden rounded-md border border-border bg-surface"
        aria-label="매치 요약"
      >
        <div className="grid gap-4 p-4 lg:grid-cols-[3fr_1fr_1fr]">
          {/* 좌 60%: 경기 결과 */}
          <div className="flex flex-col gap-4 rounded-md border border-border bg-surface-muted p-6">
            <p className="text-base font-bold text-foreground">경기결과</p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6">
            <TeamScoreBlock
              seedLabel="Team A"
              teamName={teamAName}
              logoUrl={teamALogoUrl}
              isWinner={match.winnerTeamId === match.teamAId}
              isLoser={match.winnerTeamId !== null && match.winnerTeamId !== match.teamAId}
              resultLabel={teamAResult}
            />

            <div className="rounded-md border border-border bg-surface px-6 py-5 text-center">
              <p className="text-xs font-semibold text-muted">
                {tournament?.name ?? "대회 미지정"}
                {stage ? ` · ${stage.name}` : ""}
              </p>
              <p className="mt-2 text-4xl font-semibold">
                {matchScoreLabel(match.teamAScore, match.teamBScore)}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs font-semibold text-muted">
                <span>{formatDateTime(match.matchDate)}</span>
                <span>Bo{match.bestOf ?? "-"}</span>
                <span>{MATCH_STATUS_LABEL[match.status]}</span>
              </div>
            </div>

            <TeamScoreBlock
              align="right"
              seedLabel="Team B"
              teamName={teamBName}
              logoUrl={teamBLogoUrl}
              isWinner={match.winnerTeamId === match.teamBId}
              isLoser={match.winnerTeamId !== null && match.winnerTeamId !== match.teamBId}
              resultLabel={teamBResult}
            />
          </div>
          </div>

          {/* 중 20%: POM */}
          <div className="flex flex-col gap-4 rounded-md border border-border bg-surface-muted p-5">
            <p className="text-base font-bold text-foreground">POM</p>
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <div className="flex h-44 w-full items-center justify-center rounded-md bg-white p-4">
                {pomPlayer?.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={pomPlayer.profileImageUrl} alt={pomPlayer.name} className="h-36 w-36 rounded-md object-cover object-top" />
                ) : (
                  <div className="flex h-36 w-36 items-center justify-center rounded-md bg-surface-muted text-sm font-semibold">
                    {pomPlayer?.name?.slice(0, 2) ?? "-"}
                  </div>
                )}
              </div>
              <p className="text-sm font-bold">{pomPlayer?.name ?? "-"}</p>
            </div>
          </div>

          {/* 우 20%: 팬 평점 1위 */}
          <div className="flex flex-col gap-4 rounded-md border border-border bg-surface-muted p-5">
            <p className="text-base font-bold text-foreground">팬 평점 1위</p>
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <div className="flex h-44 w-full items-center justify-center rounded-md bg-white p-4">
                {topFanPlayer?.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={topFanPlayer.profileImageUrl} alt={topFanPlayer.name} className="h-36 w-36 rounded-md object-cover object-top" />
                ) : (
                  <div className="flex h-36 w-36 items-center justify-center rounded-md bg-surface-muted text-sm font-semibold">
                    {topFanPlayer?.name?.slice(0, 2) ?? "-"}
                  </div>
                )}
              </div>
              <p className="text-sm font-bold">{topFanPlayer?.name ?? "-"}</p>
            </div>
          </div>

        </div>
      </section>

      <TabNav activeTab={activeTab} firstSetId={activeSet?.id ?? matchSets[0]?.id} />

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
        <div className="flex flex-col gap-3">
          <SetSelector sets={matchSets} activeSet={activeSet} />
          {activeSetCard}
        </div>
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
          <h2 id="match-video" className="text-xl font-semibold">
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
                className="text-sm font-semibold text-accent"
                target="_blank"
              >
                원본 영상 열기
              </Link>
            </div>
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-border p-4 text-sm text-muted">
              아직 연결된 영상 URL이 없습니다.
            </p>
          )}
        </section>
      ) : null}

    </main>
  );
}
