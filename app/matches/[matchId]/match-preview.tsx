import type { Match, SetResult, Team } from "@/lib/types";
import { KST_TIMEZONE, teamLabel } from "@/lib/view-data";
import type { MatchAiPreview } from "@/lib/match-preview-ai";
import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";

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

/** 맞대결 목록용 한 줄 날짜. 지난 시즌 기록까지 섞이므로 연도를 함께 보여준다. */
function formatMeetingDay(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: KST_TIMEZONE,
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(value))
    .replace(/\.$/, "");
}

/** 눈여겨볼 곳의 첫 문장만 형광펜 하이라이트로 강조한다. */
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
      className={`grid gap-2 border-b border-[var(--ui-border)] px-4 py-3.5 last:border-b-0 sm:grid-cols-[8.75rem_minmax(0,1fr)] sm:gap-4 sm:px-5 sm:py-4 ${
        align === "center" ? "sm:items-center" : "sm:items-start"
      }`}
    >
      <span className="text-sm font-bold text-[var(--ui-muted)]">{label}</span>
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
    <div className="rounded-lg border border-[var(--ui-border)] px-2.5 py-2 sm:px-3">
      <div className="text-sm font-bold text-[var(--ui-muted)]">{label}</div>
      <div className="mt-1 text-base font-black tabular-nums">
        <span style={{ color: colorA }}>{valueA}</span>
        <span className="px-1 font-bold text-[var(--ui-muted)]">vs</span>
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
      className={`truncate text-sm ${won ? "font-black text-[var(--ui-ink)]" : "font-bold text-[var(--ui-muted)]"}`}
    >
      {name}
    </span>
  );
  const scoreNode = (
    <span
      className={`shrink-0 text-base tabular-nums ${won ? "font-black text-[var(--ui-ink)]" : "font-bold text-[var(--ui-muted)]"}`}
    >
      {score ?? "-"}
    </span>
  );

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 ${align === "right" ? "flex-row-reverse" : ""}`}
    >
      {scoreNode}
      {nameNode}
      <TeamLogo team={team} size="h-6 w-6" plain themeAware />
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
    <div className="flex items-center gap-3 rounded-lg bg-[var(--ui-card-bg)] px-3 py-2">
      <span className="shrink-0 whitespace-nowrap text-xs font-bold tabular-nums text-[var(--ui-muted)]">
        {formatMeetingDay(meeting.matchDate)}
      </span>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:gap-3">
        <MeetingSide
          team={teamA}
          name={teamLabel(teams, meeting.teamAId)}
          score={meeting.teamAScore}
          won={meeting.winnerTeamId === meeting.teamAId}
          align="right"
        />
        <span className="shrink-0 text-xs font-bold text-[var(--ui-muted)]">:</span>
        <MeetingSide
          team={teamB}
          name={teamLabel(teams, meeting.teamBId)}
          score={meeting.teamBScore}
          won={meeting.winnerTeamId === meeting.teamBId}
        />
      </div>
      <span
        className="shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold text-white"
        style={{ background: winnerColor }}
      >
        {teamLabel(teams, meeting.winnerTeamId)} 승
      </span>
    </div>
  );
}

function FormRow({
  label,
  form,
  color,
}: {
  label: string;
  form: ("W" | "L")[];
  color: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="text-sm font-bold text-[var(--ui-muted)]">{label}</span>
      {form.length === 0 ? (
        <span className="text-sm font-bold text-[var(--ui-muted)]">-</span>
      ) : (
        form.map((result, index) => (
          <span
            key={index}
            className={`grid h-6 w-6 place-items-center rounded-full text-xs font-medium leading-none ${
              result === "W" ? "text-white" : "bg-[var(--ui-surface-muted)] text-[var(--ui-muted)]"
            }`}
            style={result === "W" ? { background: color } : undefined}
          >
            {result}
          </span>
        ))
      )}
    </span>
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
  const [watchLead, watchRest] = splitLeadSentence(aiPreview.watchPoint);
  const winA = aiPreview.winProbabilityA;
  const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
  const record = (item: ReturnType<typeof teamRecentRecord>) =>
    item.games > 0 ? `${item.wins}-${item.losses}` : "-";

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
      <section
        className="mobile-full-bleed overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] md:mx-0"
        aria-labelledby="ai-match-preview"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ui-border)] px-4 py-3 sm:px-5">
          <h2 id="ai-match-preview" className="home-section-title text-lg text-[var(--ui-ink)]">
            AI 브리핑
          </h2>
        </div>

        <BriefingRow label="판세 요약">
          <p className="text-base leading-7 text-[var(--ui-text)]">{aiPreview.summary}</p>
        </BriefingRow>

        <BriefingRow label="눈여겨볼 곳">
          <p className="text-base font-bold leading-7 text-[var(--ui-ink)]">
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
                <b className="text-base font-black tabular-nums text-[var(--ui-ink)]">{winA}%</b>
              </span>
              <span className="flex min-w-0 items-center gap-2">
                <b className="text-base font-black tabular-nums text-[var(--ui-ink)]">{100 - winA}%</b>
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
          <div className="grid grid-cols-3 gap-2">
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

        <BriefingRow label="최근 폼" align="center">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <FormRow label={teamAName} form={teamARecent.form} color={colorA} />
            <FormRow label={teamBName} form={teamBRecent.form} color={colorB} />
          </div>
        </BriefingRow>

        <BriefingRow label="최근 맞대결">
          {h2h.length === 0 ? (
            <p className="text-sm text-[var(--ui-muted)]">
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

        {aiPreview.sources.length > 0 ? (
          <BriefingRow label="참고한 전망">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              {aiPreview.sources.map((source) => (
                <a
                  key={source.url}
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 text-sm font-bold text-[var(--ui-text)] underline decoration-[var(--ui-border-strong)] underline-offset-4 hover:text-[var(--ui-ink)]"
                  title={source.title}
                >
                  <span className="max-w-48 truncate">{source.title}</span>
                  <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" strokeWidth={2} />
                </a>
              ))}
            </div>
          </BriefingRow>
        ) : null}
      </section>

      <div className="lg:sticky lg:top-20 lg:self-start">{poll}</div>
    </div>
  );
}
