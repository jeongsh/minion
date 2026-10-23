import type { ReactNode } from "react";
import Link from "next/link";
import { StatRadar } from "@/components/charts/stat-radar";
import { PowerRankingChart } from "@/components/charts/power-ranking-chart";
import { SectionHeading } from "@/components/ui/section-heading";
import { TeamLogo } from "@/components/ui/team-logo";
import type { Match, Team } from "@/lib/types";
import type { MatchAiPreview } from "@/lib/match-preview-ai";
import { TEAM_RADAR_AXES, formatTeamMetric, type BriefingTeamStats } from "@/lib/match-briefing-stats";
import { teamPowerRanking, type MatchPowerRankings } from "@/lib/power-rankings";
import { KST_TIMEZONE, matchHref, teamLabel } from "@/lib/view-data";

// 같은 페이지 승부예측 바(prediction-match-bar)와 동일한 카드 표면: 라이트는 흰
// 표면 + 테두리로 흰 배경에서 또렷하게, 다크는 한 단계 밝은 표면으로 뜬다.
const CARD_SURFACE = "border border-[var(--ui-border)] bg-[var(--ui-surface)] dark:bg-[var(--ui-surface-muted)]";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: KST_TIMEZONE, month: "numeric", day: "numeric" }).format(new Date(value));
}

/** 홈 매치 카드·승부예측 바와 같은 규칙: 검증된 hex만 쓰고 아니면 중립색으로 떨어진다. */
function teamColor(team?: Team) {
  const color = team?.primaryColor;
  return color && /^#[\da-f]{6}$/i.test(color) ? color : "var(--ui-ink)";
}

function TeamLegend({ names, colors }: { names: string[]; colors: string[] }) {
  return <span className="flex shrink-0 gap-3 text-[13px] font-medium text-[var(--ui-muted)]">
    {names.map((name, index) => <span key={index} className="inline-flex items-center gap-1.5"><i aria-hidden className={`w-4 border-t-2 ${index ? "border-dashed" : "border-solid"}`} style={{ borderColor: colors[index] }} />{name}</span>)}
  </span>;
}

function TeamProfile({ team, stats, rank, condition, winColor }: { team?: Team; stats: BriefingTeamStats; rank: number | null; condition: string | null; winColor: string }) {
  const strongest = stats.scores.map((score, index) => ({ score, index }))
    .filter((item) => item.score != null).sort((a, b) => b.score! - a.score!).slice(0, 2);
  return (
    <section className={`grid min-w-0 gap-y-4 rounded-xl ${CARD_SURFACE} p-3.5 sm:p-4`} aria-label={`${team?.shortName ?? "팀"} 프로필`}>
      <div className="flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="hidden shrink-0 sm:block"><TeamLogo team={team} size="h-7 w-7" plain themeAware /></span>
          <div className="min-w-0">
            <h3 className="truncate text-[15px] font-black leading-5 text-[var(--ui-ink)]">{team?.shortName ?? "-"}</h3>
            <p className="truncate text-[13px] font-medium leading-4 text-[var(--ui-muted)]">{team?.name}</p>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <strong className="block text-[15px] font-black leading-5 tabular-nums text-[var(--ui-ink)]">{rank != null ? `${rank}위` : "-"}</strong>
          <span className="block whitespace-nowrap text-[13px] font-medium leading-4 text-[var(--ui-muted)]">세계 순위</span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div>
          <strong className="block whitespace-nowrap text-xl font-black leading-6 tabular-nums text-[var(--ui-ink)]">{stats.form.length ? `${stats.wins}승 ${stats.losses}패` : "-"}</strong>
          <span className="mt-0.5 block text-[13px] font-medium text-[var(--ui-muted)]">최근 {stats.form.length || 5}매치</span>
          <div className="mt-2 flex gap-1" role="img" aria-label={stats.form.length ? stats.form.map((result) => result === "W" ? "승" : "패").join(" ") : "최근 경기 없음"}>
            {stats.form.map((result, i) => <span key={i} className="h-1 flex-1 rounded-full" style={{ background: result === "W" ? winColor : "color-mix(in srgb, var(--ui-muted) 35%, transparent)" }} />)}
          </div>
        </div>
        <div>
          <strong className="block text-xl font-black leading-6 tabular-nums text-[var(--ui-ink)]">{stats.setWinRate != null ? `${stats.setWinRate}%` : "-"}</strong>
          <span className="mt-0.5 block text-[13px] font-medium text-[var(--ui-muted)]">세트 승률</span>
        </div>
      </div>
      <div>
        <h4 className="text-[13px] font-medium text-[var(--ui-muted)]">강점</h4>
        <p className="mt-1 text-base font-normal leading-6 text-[var(--ui-text)]">{strongest.length ? strongest.map(({ index }) => <span key={index} className="block">{TEAM_RADAR_AXES[index].title} <span className="tabular-nums text-[var(--ui-ink)]">{formatTeamMetric(stats.values[index], index)}</span></span>) : "수집된 지표 없음"}</p>
      </div>
      <div>
        <h4 className="text-[13px] font-medium text-[var(--ui-muted)]">승리 조건</h4>
        <p className="mt-1 text-base font-normal leading-6 text-[var(--ui-text)]">{condition ?? "분석 대기"}</p>
      </div>
    </section>
  );
}

export function MatchPreview({ match, teams, matches, poll, aiPreview, stats, powerRankings }: {
  match: Match;
  teams: Team[];
  matches: Match[];
  poll: ReactNode;
  aiPreview: MatchAiPreview;
  stats: { teamA: BriefingTeamStats; teamB: BriefingTeamStats };
  powerRankings: MatchPowerRankings;
}) {
  const teamA = teams.find((team) => team.id === match.teamAId);
  const teamB = teams.find((team) => team.id === match.teamBId);
  const names = [teamLabel(teams, match.teamAId), teamLabel(teams, match.teamBId)];
  const winColors = [teamColor(teamA), teamColor(teamB)];
  const colors = [teamA, teamB].map((team) => team?.primaryColor
    ? `light-dark(color-mix(in srgb, ${team.primaryColor} 85%, var(--ui-ink)), color-mix(in srgb, ${team.primaryColor} 60%, var(--ui-ink)))`
    : "var(--ui-ink)");
  const rankings = [teamA, teamB].map((team) => teamPowerRanking(team, powerRankings.teams, match.matchDate));
  const issue = aiPreview.narrative?.title ?? (aiPreview.source === "ai" ? aiPreview.headline : null);
  const issueSource = aiPreview.narrative?.sources[0]?.url;
  const tags = aiPreview.narrative?.tags ?? [];
  const chartSeries = rankings.map((ranking, index) => ({ label: names[index], color: colors[index], history: ranking?.history ?? [] }));
  const latestDates = rankings.flatMap((ranking) => ranking?.history.at(-1)?.date ?? []).sort();
  const meetings = matches.filter((item) => item.id !== match.id && item.status === "completed" && new Date(item.matchDate) < new Date(match.matchDate)
    && ((item.teamAId === match.teamAId && item.teamBId === match.teamBId) || (item.teamAId === match.teamBId && item.teamBId === match.teamAId)))
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime()).slice(0, 5);

  return (
    <div className="flex flex-col gap-5">
      {poll}
      <section className="mobile-full-bleed mobile-gutter md:mx-0" aria-labelledby="ai-match-preview">
        <SectionHeading aside={aiPreview.generatedAt ? <span className="text-[13px] font-medium text-[var(--ui-muted)]">{formatDate(aiPreview.generatedAt)} 기준</span> : null}>
          <span id="ai-match-preview">AI 브리핑</span>
        </SectionHeading>
        {issue || aiPreview.summary ? (
          <div className={`mb-4 rounded-xl ${CARD_SURFACE} p-3.5 sm:p-4`}>
            {issue ? <p className="text-base font-black leading-6 text-[var(--ui-ink)]">{issueSource ? <a href={issueSource} target="_blank" rel="noopener noreferrer" className="hover:underline">{issue}</a> : issue}</p> : null}
            {aiPreview.summary ? <p className={`${issue ? "mt-1.5" : ""} text-base font-normal leading-7 text-[var(--ui-text)]`}>{aiPreview.summary}</p> : null}
            {tags.length ? <div className="mt-3 flex flex-wrap gap-1.5">{tags.map((tag, index) => <span key={index} className="rounded-md border border-[var(--ui-border)] px-2 py-0.5 text-[13px] font-medium text-[var(--ui-muted)]">#{tag}</span>)}</div> : null}
          </div>
        ) : null}
        <div className="grid grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-2">
          <TeamProfile team={teamA} stats={stats.teamA} rank={rankings[0]?.history.at(-1)?.rank ?? null} condition={aiPreview.teamAWinCondition} winColor={winColors[0]} />
          <TeamProfile team={teamB} stats={stats.teamB} rank={rankings[1]?.history.at(-1)?.rank ?? null} condition={aiPreview.teamBWinCondition} winColor={winColors[1]} />
        </div>
        <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:gap-3 md:grid-cols-2">
          <figure className={`row-span-3 grid min-w-0 grid-rows-subgrid gap-y-2 rounded-xl ${CARD_SURFACE} p-3.5 sm:p-4`}>
            <figcaption className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold leading-7 text-[var(--ui-ink)]">팀 지표 비교</h3><TeamLegend names={names} colors={colors} /></figcaption>
            <p className="text-[13px] font-medium leading-5 text-[var(--ui-muted)]">최근 5매치 수집 팀 내 백분위</p>
            <div className="h-[280px] min-w-0" data-team-metrics-chart>
              {stats.teamA.statSetCount || stats.teamB.statSetCount ? <StatRadar axes={TEAM_RADAR_AXES} label={`${names[0]}와 ${names[1]}의 최근 5매치 팀 지표 비교`} showComparisonValues series={[stats.teamA, stats.teamB].map((item, i) => ({ label: names[i], color: colors[i], scores: item.scores, values: item.values.map(formatTeamMetric), dashed: i === 1 }))} /> : <p className="flex h-full items-center justify-center text-base text-[var(--ui-muted)]">수집된 팀 지표 없음</p>}
            </div>
          </figure>
          <figure className={`row-span-3 grid min-w-0 grid-rows-subgrid gap-y-2 rounded-xl ${CARD_SURFACE} p-3.5 sm:p-4`}>
            <figcaption className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold leading-7 text-[var(--ui-ink)]">파워랭킹 추이</h3><TeamLegend names={names} colors={colors} /></figcaption>
            <p className="text-[13px] font-medium leading-5 text-[var(--ui-muted)]"><a href={powerRankings.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">LoL Esports</a>{latestDates.length ? ` ${formatDate(latestDates.at(-1)!)} 기준` : ""}</p>
            <PowerRankingChart series={chartSeries} error={powerRankings.status === "error"} />
          </figure>
        </div>
        {meetings.length ? <section className="mt-4" aria-label="최근 맞대결">
          <h3 className="mb-2 text-lg font-bold text-[var(--ui-ink)]">최근 맞대결</h3>
          <div className="grid gap-2">{meetings.map((meeting) => <Link key={meeting.id} href={matchHref(meeting)} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl bg-[var(--ui-card-bg)] px-3 py-2.5 text-[15px] font-medium hover:bg-[var(--ui-card-hover)]">
            <span className="text-[13px] font-medium text-[var(--ui-muted)]">{formatDate(meeting.matchDate)}</span>
            <span className="flex min-w-0 items-center justify-center gap-2 text-[var(--ui-ink)]"><TeamLogo team={teams.find((team) => team.id === meeting.teamAId)} size="h-5 w-5" plain themeAware /><span className="truncate">{teamLabel(teams, meeting.teamAId)}</span><strong className="shrink-0 text-[15px] font-black tabular-nums">{meeting.teamAScore} : {meeting.teamBScore}</strong><span className="truncate">{teamLabel(teams, meeting.teamBId)}</span><TeamLogo team={teams.find((team) => team.id === meeting.teamBId)} size="h-5 w-5" plain themeAware /></span>
            <span className="text-xs font-medium text-[var(--ui-muted)]">BO{meeting.bestOf}</span>
          </Link>)}</div>
        </section> : null}
      </section>
    </div>
  );
}
