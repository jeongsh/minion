import type { Match, SetResult, Team } from "@/lib/types";
import { KST_TIMEZONE, teamLabel } from "@/lib/view-data";
import type { MatchAiPreview } from "@/lib/match-preview-ai";
import type { ReactNode } from "react";

import { TeamLogo } from "@/components/ui/team-logo";

function isSamePair(match: Match, teamAId: string, teamBId: string) {
  return (
    (match.teamAId === teamAId && match.teamBId === teamBId) ||
    (match.teamAId === teamBId && match.teamBId === teamAId)
  );
}

function completedBefore(matches: Match[], currentMatch: Match) {
  const currentTime = new Date(currentMatch.matchDate).getTime();
  return matches
    .filter(
      (match) =>
        match.id !== currentMatch.id &&
        match.status === "completed" &&
        new Date(match.matchDate).getTime() < currentTime,
    )
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
}

function teamRecentRecord(matches: Match[], teamId: string) {
  const recent = matches
    .filter((match) => match.teamAId === teamId || match.teamBId === teamId)
    .slice(0, 5);
  const wins = recent.filter((match) => match.winnerTeamId === teamId).length;
  const losses = recent.length - wins;

  return {
    games: recent.length,
    wins,
    losses,
    form: recent.map((match) => (match.winnerTeamId === teamId ? "W" : "L")) as ("W" | "L")[],
  };
}

function teamSetSummary(sets: SetResult[], matches: Match[], teamId: string) {
  const recentMatches = matches
    .filter((match) => match.teamAId === teamId || match.teamBId === teamId)
    .slice(0, 5);
  const recentMatchIds = new Set(recentMatches.map((match) => match.id));
  const teamSets = sets.filter(
    (set) =>
      recentMatchIds.has(set.matchId) &&
      (set.blueTeamId === teamId || set.redTeamId === teamId),
  );
  const score = recentMatches.reduce(
    (total, item) => {
      const own = item.teamAId === teamId ? item.teamAScore : item.teamBScore;
      const opponent = item.teamAId === teamId ? item.teamBScore : item.teamAScore;
      total.wins += own ?? 0;
      total.losses += opponent ?? 0;
      return total;
    },
    { wins: 0, losses: 0 },
  );
  const kills = teamSets.reduce((sum, set) => {
    const value = set.blueTeamId === teamId ? set.blueKills : set.redKills;
    return sum + (value ?? 0);
  }, 0);

  return {
    setDiff: score.wins - score.losses,
    avgKills: teamSets.length > 0 ? kills / teamSets.length : 0,
  };
}

/** 맞대결 목록용 한 줄 날짜. */
function formatMeetingDay(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIMEZONE,
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(value))
    .replace(/\.$/, "");
}

function formatPreviewTime(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIMEZONE,
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatSourceDay(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** 경기 중 확인 문장의 첫 문장만 형광펜 하이라이트로 강조한다. */
function splitLeadSentence(text: string): [string, string] {
  const match = text.match(/^[^.!?]*[.!?]/);
  if (!match) return [text, ""];
  return [match[0], text.slice(match[0].length).trim()];
}

function BriefingRow({
  label,
  children,
  align = "start",
}: {
  label: string;
  children: ReactNode;
  align?: "start" | "center";
}) {
  return (
    <div
      className={`mb-2 grid gap-1 rounded-lg bg-[var(--ui-card-bg)] px-3 py-2.5 last:mb-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-3 sm:px-4 sm:py-3 ${
        align === "center" ? "sm:items-center" : "sm:items-start"
      }`}
    >
      <h3 className="text-[14px] font-medium leading-5 text-[var(--ui-ink)] sm:text-[15px] sm:font-bold sm:leading-6">{label}</h3>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function MetricCard({
  label,
  valueA,
  valueB,
  colorA,
  colorB,
}: {
  label: string;
  valueA: string;
  valueB: string;
  colorA: string;
  colorB: string;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-[var(--ui-surface)] px-1.5 py-2 sm:px-3">
      <div className="text-[13px] font-medium text-[var(--ui-muted)]">{label}</div>
      <div className="mt-1 whitespace-nowrap text-[15px] font-bold tabular-nums sm:text-base">
        <span style={{ color: colorA }}>{valueA}</span>
        <span className="px-px text-[12px] font-medium text-[var(--ui-muted)] sm:px-1 sm:text-[13px]">vs</span>
        <span style={{ color: colorB }}>{valueB}</span>
      </div>
    </div>
  );
}

function MeetingSide({
  team,
  name,
  score,
  won,
  align = "left",
}: {
  team?: Team;
  name: string;
  score: number | null | undefined;
  won: boolean;
  align?: "left" | "right";
}) {
  const nameNode = (
    <span
      className={`truncate text-[13px] font-medium sm:text-[15px] sm:font-bold ${won ? "text-[var(--ui-ink)]" : "text-[var(--ui-muted)]"}`}
    >
      {name}
    </span>
  );
  const scoreNode = (
    <span
      className={`shrink-0 text-[15px] font-bold tabular-nums sm:text-base ${won ? "text-[var(--ui-ink)]" : "text-[var(--ui-muted)]"}`}
    >
      {score ?? "-"}
    </span>
  );

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      {scoreNode}
      {nameNode}
      <TeamLogo team={team} size="h-5 w-5 sm:h-6 sm:w-6" plain themeAware />
    </div>
  );
}

function MeetingRow({
  meeting,
  teams,
  winnerColor,
}: {
  meeting: Match;
  teams: Team[];
  winnerColor: string;
}) {
  const teamA = teams.find((team) => team.id === meeting.teamAId);
  const teamB = teams.find((team) => team.id === meeting.teamBId);

  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-1.5 rounded-lg bg-[var(--ui-surface)] px-2.5 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-3 sm:px-3">
      <span className="shrink-0 whitespace-nowrap text-[13px] font-medium tabular-nums text-[var(--ui-muted)]">
        {formatMeetingDay(meeting.matchDate)}
      </span>
      <div className="flex min-w-0 items-center justify-center gap-1.5 sm:gap-3">
        <MeetingSide
          team={teamA}
          name={teamLabel(teams, meeting.teamAId)}
          score={meeting.teamAScore}
          won={meeting.winnerTeamId === meeting.teamAId}
          align="right"
        />
        <span className="shrink-0 text-[13px] font-medium text-[var(--ui-muted)]">:</span>
        <MeetingSide
          team={teamB}
          name={teamLabel(teams, meeting.teamBId)}
          score={meeting.teamBScore}
          won={meeting.winnerTeamId === meeting.teamBId}
        />
      </div>
      <span
        className="shrink-0 justify-self-end whitespace-nowrap text-[13px] font-medium"
        style={{ color: winnerColor }}
        aria-label={`${teamLabel(teams, meeting.winnerTeamId)} 승리`}
      >
        승리
      </span>
    </div>
  );
}

export function MatchPreview({
  match,
  teams,
  matches,
  sets,
  poll,
  aiPreview,
}: {
  match: Match;
  teams: Team[];
  matches: Match[];
  sets: SetResult[];
  poll: ReactNode;
  aiPreview: MatchAiPreview;
}) {
  const previousMatches = completedBefore(matches, match);
  const h2h = previousMatches
    .filter((item) => isSamePair(item, match.teamAId, match.teamBId))
    .slice(0, 5);
  const teamA = teams.find((team) => team.id === match.teamAId);
  const teamB = teams.find((team) => team.id === match.teamBId);
  const teamAName = teamLabel(teams, match.teamAId);
  const teamBName = teamLabel(teams, match.teamBId);
  const colorA = teamA?.primaryColor || "var(--ui-ink)";
  const colorB = teamB?.primaryColor || "var(--ui-muted)";
  const teamARecent = teamRecentRecord(previousMatches, match.teamAId);
  const teamBRecent = teamRecentRecord(previousMatches, match.teamBId);
  const teamASummary = teamSetSummary(sets, previousMatches, match.teamAId);
  const teamBSummary = teamSetSummary(sets, previousMatches, match.teamBId);
  const [watchLead, watchRest] = splitLeadSentence(aiPreview.liveCheck);
  const winA = aiPreview.winProbabilityA;
  const generatedMeta = aiPreview.generatedAt && aiPreview.generationPhase !== "legacy"
    ? `${formatPreviewTime(aiPreview.generatedAt)} 기준`
    : null;
  const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
  const record = (item: ReturnType<typeof teamRecentRecord>) =>
    item.games > 0 ? `${item.wins}-${item.losses}` : "-";

  return (
    <div className="flex flex-col gap-5">
      {poll}
      <section
        className="mobile-full-bleed mobile-gutter md:mx-0"
        aria-labelledby="ai-match-preview"
      >
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h2
            id="ai-match-preview"
            className="home-section-title text-[length:var(--ui-title-size)] text-[var(--ui-ink)]"
          >
            AI 브리핑
          </h2>
          {generatedMeta ? (
            <p className="text-[13px] font-medium text-[var(--ui-muted)]">{generatedMeta}</p>
          ) : null}
        </div>

        {aiPreview.narrative ? (
          <div className="mb-2 rounded-lg bg-[var(--ui-card-bg)] px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-0.5 text-[14px] font-medium text-[var(--ui-ink)]">오늘의 서사</span>
              {aiPreview.narrative.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[var(--ui-border)] bg-[var(--ui-surface)] px-2 py-1 text-[13px] font-medium text-[var(--ui-muted)]"
                >
                  {tag}
                </span>
              ))}
            </div>
            <h3 className="mt-2 text-[15px] font-bold leading-[23px] text-[var(--ui-ink)] sm:text-base sm:leading-6">
              {aiPreview.narrative.title}
            </h3>
            <p className="mt-1.5 text-[14px] leading-[22px] text-[var(--ui-text)] sm:text-base sm:leading-6">
              {aiPreview.narrative.body}
            </p>
            {aiPreview.matchMeaning ? (
              <div className="mt-2.5 border-t border-[var(--ui-border)] pt-2.5">
                <p className="text-[13px] font-medium text-[var(--ui-muted)]">이 경기의 의미</p>
                <p className="mt-1 text-[14px] leading-[22px] text-[var(--ui-text)] sm:text-base sm:leading-6">{aiPreview.matchMeaning}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        <BriefingRow label="전력 흐름">
          <div>
            {!aiPreview.narrative ? (
              <h4 className="mb-1 text-[15px] font-bold leading-[23px] text-[var(--ui-ink)] sm:text-base sm:leading-6">
                {aiPreview.headline}
              </h4>
            ) : null}
            <p className="text-[14px] leading-[22px] text-[var(--ui-text)] sm:text-base sm:leading-6">
              {aiPreview.summary}
            </p>
          </div>
        </BriefingRow>

        {!aiPreview.narrative && aiPreview.matchMeaning ? (
          <BriefingRow label="이 경기의 의미">
            <p className="text-[14px] leading-[22px] text-[var(--ui-text)] sm:text-base sm:leading-6">{aiPreview.matchMeaning}</p>
          </BriefingRow>
        ) : null}

        {aiPreview.recentView ? (
          <BriefingRow label="최근 평가 온도">
            <div>
              <h4 className="text-[15px] font-bold leading-[23px] text-[var(--ui-ink)] sm:text-base sm:leading-6">
                {aiPreview.recentView.title}
              </h4>
              <p className="mt-1 text-[14px] leading-[22px] text-[var(--ui-text)] sm:text-base sm:leading-6">
                {aiPreview.recentView.body}
              </p>
              {aiPreview.recentView.asOf ? (
                <p className="mt-1 text-[13px] font-medium text-[var(--ui-muted)]">
                  {formatSourceDay(aiPreview.recentView.asOf)} 자료 기준
                </p>
              ) : null}
            </div>
          </BriefingRow>
        ) : null}

        {aiPreview.teamAWinCondition || aiPreview.teamBWinCondition ? (
          <BriefingRow label="승리 조건">
            <div className="grid gap-2 sm:grid-cols-2">
              {aiPreview.teamAWinCondition ? (
                <div
                  className="rounded-lg border bg-[var(--ui-surface)] p-2.5 sm:p-3"
                  style={{ borderColor: colorA }}
                >
                  <div className="flex items-center gap-2">
                    <TeamLogo team={teamA} size="h-5 w-5 sm:h-6 sm:w-6" plain themeAware />
                    <h4 className="text-[14px] font-medium text-[var(--ui-ink)] sm:text-[15px] sm:font-bold">{teamAName}</h4>
                  </div>
                  <p className="mt-1.5 text-[14px] leading-[22px] text-[var(--ui-text)] sm:text-base sm:leading-6">
                    {aiPreview.teamAWinCondition}
                  </p>
                </div>
              ) : null}
              {aiPreview.teamBWinCondition ? (
                <div
                  className="rounded-lg border bg-[var(--ui-surface)] p-2.5 sm:p-3"
                  style={{ borderColor: colorB }}
                >
                  <div className="flex items-center gap-2">
                    <TeamLogo team={teamB} size="h-5 w-5 sm:h-6 sm:w-6" plain themeAware />
                    <h4 className="text-[14px] font-medium text-[var(--ui-ink)] sm:text-[15px] sm:font-bold">{teamBName}</h4>
                  </div>
                  <p className="mt-1.5 text-[14px] leading-[22px] text-[var(--ui-text)] sm:text-base sm:leading-6">
                    {aiPreview.teamBWinCondition}
                  </p>
                </div>
              ) : null}
            </div>
          </BriefingRow>
        ) : null}

        <BriefingRow label="경기 중 확인">
          <p className="text-[14px] font-medium leading-[22px] text-[var(--ui-ink)] sm:text-base sm:leading-6">
            <span
              style={{
                background:
                  "linear-gradient(transparent 62%, color-mix(in srgb, var(--accent) 22%, transparent) 62%)",
              }}
            >
              {watchLead}
            </span>
            {watchRest ? ` ${watchRest}` : null}
          </p>
        </BriefingRow>

        {winA !== null ? (
          <BriefingRow label="예상 승률" align="center">
            <div className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <TeamLogo team={teamA} size="h-5 w-5" plain themeAware />
                <b className="text-[15px] font-bold tabular-nums text-[var(--ui-ink)] sm:text-base">
                  {winA}%
                </b>
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <b className="text-[15px] font-bold tabular-nums text-[var(--ui-ink)] sm:text-base">
                  {100 - winA}%
                </b>
                <TeamLogo team={teamB} size="h-5 w-5" plain themeAware />
              </span>
            </div>
            <div
              className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full"
              role="img"
              aria-label={`${teamAName} ${winA}%, ${teamBName} ${100 - winA}%`}
            >
              <span className="rounded-l-full" style={{ width: `${winA}%`, background: colorA }} />
              <span className="flex-1 rounded-r-full" style={{ background: colorB }} />
            </div>
          </BriefingRow>
        ) : null}

        <BriefingRow label="전력 지표" align="center">
          <div className="grid grid-cols-1 gap-1.5 min-[360px]:grid-cols-3 sm:gap-2">
            <MetricCard
              label="최근 5전"
              valueA={record(teamARecent)}
              valueB={record(teamBRecent)}
              colorA={colorA}
              colorB={colorB}
            />
            <MetricCard
              label="세트 득실"
              valueA={signed(teamASummary.setDiff)}
              valueB={signed(teamBSummary.setDiff)}
              colorA={colorA}
              colorB={colorB}
            />
            <MetricCard
              label="평균 킬"
              valueA={teamASummary.avgKills > 0 ? teamASummary.avgKills.toFixed(1) : "-"}
              valueB={teamBSummary.avgKills > 0 ? teamBSummary.avgKills.toFixed(1) : "-"}
              colorA={colorA}
              colorB={colorB}
            />
          </div>
        </BriefingRow>

        <BriefingRow label="최근 맞대결">
          {h2h.length === 0 ? (
            <p className="text-[14px] leading-[22px] text-[var(--ui-muted)] sm:text-base sm:leading-7">
              현재 수집된 기록 기준 첫 맞대결입니다. 최근 대진 난이도와 경기력으로 비교했습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {h2h.map((item) => (
                <MeetingRow
                  key={item.id}
                  meeting={item}
                  teams={teams}
                  winnerColor={item.winnerTeamId === match.teamAId ? colorA : colorB}
                />
              ))}
            </div>
          )}
        </BriefingRow>

      </section>
    </div>
  );
}
