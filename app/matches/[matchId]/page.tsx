import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { WinnerPredictionPoll } from "@/components/domain/winner-prediction-poll";
import { SourceNotice } from "@/components/domain/source-notice";
import {
  getAllPlayers,
  getAllTeams,
  getFanMatchPredictions,
  getFanRatings,
  getMatchById,
  getMatches,
  getSets,
  getSetsByMatchId,
  getStages,
  getTournaments,
} from "@/lib/data/lck";
import type { MatchStatus, SetResult } from "@/lib/types";
import { isSetRatingOpen } from "@/lib/set-status";
import {
  formatDateTime,
  playerLabel,
  teamLabel,
  topFanRatingForMatch,
} from "@/lib/view-data";

import { predictMatchWinnerAction } from "./actions";
import { MatchPreview } from "./match-preview";
import { SetDetailContent } from "./sets/[setId]/page";

type MatchTab = "preview" | "data" | "video";
const RECENT_SET_FOCUS_WINDOW_MS = 30 * 60 * 1000;

const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "예정",
  live: "진행 중",
  completed: "종료",
};

const TAB_LABELS: Record<MatchTab, string> = {
  preview: "프리뷰",
  data: "매치 데이터",
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
  score,
  resultLabel,
}: {
  align?: "left" | "right";
  seedLabel: string;
  teamName: string;
  score: number | null;
  resultLabel: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-3 ${align === "right" ? "items-end text-right" : ""}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {seedLabel}
      </p>
      <div
        className={`flex items-center gap-3 ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        <div>
          <p className="text-2xl font-semibold md:text-3xl">{teamName}</p>
          <p className="mt-1 text-sm font-semibold text-muted">{resultLabel}</p>
        </div>
        <span className="text-5xl font-semibold md:text-6xl">
          {score ?? "-"}
        </span>
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
  return value === "preview" || value === "data" || value === "video"
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
          href={tabHref(tab, tab === "data" ? firstSetId : undefined)}
          className={`rounded-md border px-4 py-2 text-sm font-semibold ${
            activeTab === tab
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-surface hover:bg-surface-muted"
          }`}
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
}: {
  sets: SetResult[];
  activeSet?: SetResult;
}) {
  if (sets.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {sets.map((set) => (
        <Link
          key={set.id}
          href={tabHref("data", set.id)}
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
  const cookieStore = await cookies();
  const voterKey = cookieStore.get("lckhub_match_prediction_voter")?.value;
  const predictionClosed = match.status !== "scheduled";

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
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <TeamScoreBlock
            seedLabel="Team A"
            teamName={teamAName}
            score={match.teamAScore}
            resultLabel={teamAResult}
          />

          <div className="rounded-md border border-border bg-surface-muted px-6 py-5 text-center">
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
            score={match.teamBScore}
            resultLabel={teamBResult}
          />
        </div>
        <div className="grid gap-4 border-t border-border px-6 py-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-muted">공식 POM</p>
            <p className="mt-1 text-base font-semibold">
              {playerLabel(players, match.officialPomPlayerId)}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold text-muted">팬 평점 1위</p>
            <p className="mt-1 text-base font-semibold">
              {topFanRatingForMatch(match.id, fanRatings, players)}
            </p>
          </div>
        </div>
      </section>

      <TabNav activeTab={activeTab} firstSetId={matchSets[0]?.id} />

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

      <SourceNotice />
    </main>
  );
}
