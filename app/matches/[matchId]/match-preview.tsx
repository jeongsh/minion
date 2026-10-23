import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { StatRadar } from "@/components/charts/stat-radar";
import { PowerRankingChart } from "@/components/charts/power-ranking-chart";
import { SectionHeading } from "@/components/ui/section-heading";
import { TeamLogo } from "@/components/ui/team-logo";
import type { Champion, Match, Player, Team } from "@/lib/types";
import type { MatchAiPreview } from "@/lib/match-preview-ai";
import {
  TEAM_STYLE_AXES, buildFirstDragonMinutes, formatTeamStyle, regionLeague, teamRegion,
  type BriefingTeamVisuals, type ChampionPriority, type DragonEvent, type LeagueSetRecord, type TeamStyle,
} from "@/lib/match-preview-visuals";
import type { MatchPreviewAccuracy } from "@/lib/match-preview-accuracy";
import { teamPowerRanking, type MatchPowerRankings } from "@/lib/power-rankings";
import { KST_TIMEZONE, matchHref, teamLabel } from "@/lib/view-data";
import {
  AccuracySummary, CARD_SURFACE, ChampionPriorityMap, ChartCard, FirstDragonChart, LaneGoldChart, Legend, LeagueRecordBar, META,
  SideWinRates, WinProbabilityGauge,
} from "./match-preview-charts";
import { ChartReveal } from "./match-preview-reveal";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", { timeZone: KST_TIMEZONE, month: "numeric", day: "numeric" }).format(new Date(value));
}

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * 막대와 점에 쓰는 팀 색. 검증된 primaryColor를 그대로 쓰되, 검정·흰색에 가까워
 * 한쪽 테마에서 사라지는 색과 두 팀이 겹치는 색은 중립 잉크와 보조색으로 바꾼다.
 */
function chartColors(teams: Array<Team | undefined>) {
  const colors = teams.map((team) => {
    const color = team?.primaryColor;
    if (!color || !/^#[\da-f]{6}$/i.test(color)) return "var(--ui-ink)";
    const value = luminance(color);
    return value < 0.04 || value > 0.85 ? "var(--ui-ink)" : color;
  });
  if (colors[0] === colors[1]) colors[1] = "var(--ui-muted)";
  return colors;
}

/**
 * 상단 매치 헤더처럼 로고와 팀 정보를 가로로 붙여 가운데 게이지 쪽으로 모은다.
 * 첫 줄은 팀명과 리그 배지, 둘째 줄은 파워랭킹이다. 리그는 테두리 배지로,
 * 파워랭킹은 순위 숫자만 진하게 써서 두 정보가 같은 글씨처럼 보이지 않게 한다.
 * 데스크톱은 텍스트 두 줄 48px(28 + 20)과 로고 56px, 모바일은 텍스트 40px(24 + 16)과
 * 로고 40px이고 로고 기준 세로 가운데에 텍스트를 둔다.
 */
function HeroTeam({ team, league, rank, align }: { team?: Team; league: string | null; rank: number | null; align: "left" | "right" }) {
  const left = align === "left";
  const badge = league ? (
    <span className="shrink-0 rounded-md border border-[var(--ui-border)] px-1 text-xs font-medium leading-4 text-[var(--ui-muted)] sm:px-1.5 sm:py-0.5">{league}</span>
  ) : null;
  return (
    <div className={`flex min-w-0 items-center gap-2 sm:gap-3 ${left ? "justify-self-start sm:justify-self-end" : "flex-row-reverse justify-self-end sm:justify-self-start"}`}>
      <div className={`flex h-10 min-w-0 flex-col sm:h-12 ${left ? "items-end" : "items-start"}`}>
        <div className="flex h-6 min-w-0 items-center gap-1.5 sm:h-7 sm:gap-2">
          {left ? badge : null}
          <strong className="truncate text-base font-black leading-6 text-[var(--ui-ink)] sm:text-2xl sm:leading-7">{team?.shortName ?? "-"}</strong>
          {left ? null : badge}
        </div>
        {rank != null ? (
          <span className="flex h-4 items-baseline gap-1 whitespace-nowrap leading-4 sm:h-5 sm:leading-5">
            <span className="text-[13px] font-medium text-[var(--ui-muted)]"><span className="hidden sm:inline">글로벌 </span>파워랭킹</span>
            <strong className="text-[13px] font-medium tabular-nums text-[var(--ui-ink)] sm:text-sm">{rank}위</strong>
          </span>
        ) : null}
      </div>
      <span className="shrink-0"><TeamLogo team={team} size="h-10 w-10 sm:h-14 sm:w-14" plain themeAware /></span>
    </div>
  );
}

export function MatchPreview({
  match, teams, players, champions, matches, poll, aiPreview, styles, visuals, championPriority, dragonEvents,
  leagueRecord, accuracy, powerRankings,
}: {
  match: Match;
  teams: Team[];
  players: Player[];
  champions: Champion[];
  matches: Match[];
  poll: ReactNode;
  aiPreview: MatchAiPreview;
  styles: { teamA: TeamStyle; teamB: TeamStyle };
  visuals: { teamA: BriefingTeamVisuals; teamB: BriefingTeamVisuals };
  championPriority: ChampionPriority[];
  dragonEvents: DragonEvent[];
  leagueRecord: LeagueSetRecord | null;
  accuracy: MatchPreviewAccuracy;
  powerRankings: MatchPowerRankings;
}) {
  const teamA = teams.find((team) => team.id === match.teamAId);
  const teamB = teams.find((team) => team.id === match.teamBId);
  const names = [teamLabel(teams, match.teamAId), teamLabel(teams, match.teamBId)];
  const colors = chartColors([teamA, teamB]);
  // 선 차트는 기존 레이더·파워랭킹과 같은 가독성 보정 색을 유지한다.
  const lineColors = [teamA, teamB].map((team) => team?.primaryColor
    ? `light-dark(color-mix(in srgb, ${team.primaryColor} 85%, var(--ui-ink)), color-mix(in srgb, ${team.primaryColor} 60%, var(--ui-ink)))`
    : "var(--ui-ink)");
  const rankings = [teamA, teamB].map((team) => teamPowerRanking(team, powerRankings.teams, match.matchDate));
  const ranks = rankings.map((ranking) => ranking?.history.at(-1)?.rank ?? null);
  const leagues = [teamA, teamB].map((team) => {
    const region = teamRegion(team);
    return region ? regionLeague(region) : null;
  });
  const chartSeries = rankings.map((ranking, index) => ({ label: names[index], color: lineColors[index], history: ranking?.history ?? [] }));
  const latestDate = rankings.flatMap((ranking) => ranking?.history.at(-1)?.date ?? []).sort().at(-1);
  const visualTeams = [visuals.teamA, visuals.teamB];
  const styleTeams = [styles.teamA, styles.teamB];
  const dragonMinutes = visualTeams.map((team) => buildFirstDragonMinutes(team, dragonEvents));
  const playerName = (id: string) => players.find((player) => player.id === id)?.name ?? id.replace(/^leaguepedia-player:/, "");
  const oneLiner = aiPreview.oneLiner ?? (aiPreview.source === "ai" ? aiPreview.summary : null);
  const watchPoints = aiPreview.watchPoints.length ? aiPreview.watchPoints : [aiPreview.liveCheck].filter(Boolean);
  const priorMeetings = matches.filter((item) => item.id !== match.id && item.status === "completed" && new Date(item.matchDate) < new Date(match.matchDate)
    && ((item.teamAId === match.teamAId && item.teamBId === match.teamBId) || (item.teamAId === match.teamBId && item.teamBId === match.teamAId)))
    .sort((a, b) => new Date(b.matchDate).getTime() - new Date(a.matchDate).getTime());
  const sampleCaption = `${names[0]} ${visualTeams[0].sets}세트, ${names[1]} ${visualTeams[1].sets}세트 기준`;

  return (
    <div className="flex flex-col gap-5">
      {poll}
      <section className="mobile-full-bleed mobile-gutter md:mx-0" aria-labelledby="ai-match-preview">
        <SectionHeading aside={aiPreview.generatedAt ? <span className={META}>{formatDate(aiPreview.generatedAt)} 기준</span> : null}>
          <span id="ai-match-preview">AI 브리핑</span>
        </SectionHeading>
        <div className="flex flex-col gap-3">
          <div className={`rounded-xl ${CARD_SURFACE} p-4 sm:p-5`}>
            {/* 모바일은 두 팀을 윗줄, 게이지를 아랫줄 가운데에 두고 sm부터 한 줄로 모은다. */}
            <div className="grid grid-cols-2 items-end gap-x-3 gap-y-4 sm:grid-cols-[minmax(0,1fr)_minmax(128px,220px)_minmax(0,1fr)] sm:gap-8">
              <HeroTeam team={teamA} league={leagues[0]} rank={ranks[0]} align="left" />
              <div className="order-last col-span-2 sm:order-none sm:col-span-1">
                {aiPreview.winProbabilityA != null
                  ? <WinProbabilityGauge names={names} colors={colors} probabilityA={aiPreview.winProbabilityA} />
                  : <span className="block text-center text-2xl font-black text-[var(--ui-muted)]">VS</span>}
              </div>
              <HeroTeam team={teamB} league={leagues[1]} rank={ranks[1]} align="right" />
            </div>
            {oneLiner ? (
              <p className={`mt-4 whitespace-pre-line rounded-lg bg-[var(--ui-card-bg)] px-4 py-3 text-sm leading-6 text-[var(--ui-ink)] sm:text-base sm:leading-7 ${aiPreview.oneLiner ? "font-medium" : "font-normal"}`}>{oneLiner}</p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ChartCard title="팀 성향 레이더" caption={`수집 팀 내 백분위 ${names[0]} ${styleTeams[0].sets}세트, ${names[1]} ${styleTeams[1].sets}세트`}
              legend={<Legend names={names} colors={lineColors} variant="line" />}>
              <div className="h-[280px] min-w-0" data-radar>
                <StatRadar axes={TEAM_STYLE_AXES} label={`${names[0]}와 ${names[1]}의 팀 성향 비교`} showComparisonValues
                  series={styleTeams.map((item, index) => ({ label: names[index], color: lineColors[index], scores: item.scores, values: item.values.map(formatTeamStyle), dashed: index === 1 }))} />
              </div>
            </ChartCard>
            <ChartCard title="글로벌 파워랭킹 추이"
              caption={<><a href={powerRankings.sourceUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">LoL Esports</a>{latestDate ? ` ${formatDate(latestDate)} 기준` : ""}</>}
              legend={<Legend names={names} colors={lineColors} variant="line" />}>
              <div data-wipe><PowerRankingChart series={chartSeries} error={powerRankings.status === "error"} /></div>
            </ChartCard>
          </div>

          <ChartCard title="라인별 15분 골드 격차" caption={`주전 선수 평균 ${sampleCaption}`} legend={<Legend names={names} colors={colors} />}>
            <LaneGoldChart lanes={visualTeams.map((team) => team.lanes)} colors={colors} playerName={playerName} />
          </ChartCard>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ChartCard title="첫 드래곤 시점" caption={`경기별 첫 드래곤 처치 시간 ${sampleCaption}`}>
              <FirstDragonChart names={names} colors={colors} minutes={dragonMinutes} />
            </ChartCard>
            <ChartCard title="진영별 승률" caption={sampleCaption} legend={<Legend names={["블루", "레드"]} colors={["var(--team-blue)", "var(--team-red)"]} />}>
              <SideWinRates names={names} teams={visualTeams} logos={[teamA, teamB]} />
            </ChartCard>
          </div>

          {championPriority.some((item) => item.picksA) && championPriority.some((item) => item.picksB) ? (
            <ChartCard title="챔피언 우선순위 맵" caption={`원 크기는 두 팀 합계 픽 수 ${sampleCaption}`} legend={<Legend names={names} colors={colors} />}>
              <ChampionPriorityMap names={names} colors={colors} items={championPriority} champions={champions} />
            </ChartCard>
          ) : null}

          {leagueRecord ? (
            <ChartCard title="리그 간 전력 비교" caption={`${accuracy.season} 국제 대회 맞대결 ${leagueRecord.winsA + leagueRecord.winsB}세트`}>
              <LeagueRecordBar record={leagueRecord} colors={colors} />
            </ChartCard>
          ) : null}

          {watchPoints.length ? (
            <section className={`rounded-xl ${CARD_SURFACE} p-4 sm:p-5`} aria-labelledby="match-watch-points">
              <h3 id="match-watch-points" className="text-lg font-bold leading-7 text-[var(--ui-ink)]">관전 포인트</h3>
              <ChartReveal>
                <ol className="mt-3 grid gap-3">
                  {watchPoints.map((point, index) => (
                    <li key={index} data-pop className="grid grid-cols-[28px_minmax(0,1fr)] items-start gap-3" style={{ "--i": index } as CSSProperties}>
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--ui-card-bg)] text-sm font-medium tabular-nums text-[var(--ui-ink)]">{index + 1}</span>
                      <span className="pt-0.5 text-sm leading-6 text-[var(--ui-text)] sm:text-base">{point}</span>
                    </li>
                  ))}
                </ol>
              </ChartReveal>
            </section>
          ) : null}

          {priorMeetings.length ? (
            <section className={`rounded-xl ${CARD_SURFACE} p-4 sm:p-5`} aria-label="최근 맞대결">
              <h3 className="text-lg font-bold leading-7 text-[var(--ui-ink)]">최근 맞대결</h3>
              <div className="mt-3 grid gap-2">
                {priorMeetings.slice(0, 5).map((meeting) => (
                  <Link key={meeting.id} href={matchHref(meeting)} className="grid grid-cols-[48px_minmax(0,1fr)_40px] items-center gap-3 rounded-lg bg-[var(--ui-card-bg)] px-3 py-2.5 hover:bg-[var(--ui-card-hover)]">
                    <span className={META}>{formatDate(meeting.matchDate)}</span>
                    <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-[15px] font-medium text-[var(--ui-ink)]">
                      <span className="flex min-w-0 items-center justify-end gap-2"><span className="truncate">{teamLabel(teams, meeting.teamAId)}</span><TeamLogo team={teams.find((team) => team.id === meeting.teamAId)} size="h-5 w-5" plain themeAware /></span>
                      <strong className="text-[15px] font-black tabular-nums">{meeting.teamAScore} : {meeting.teamBScore}</strong>
                      <span className="flex min-w-0 items-center gap-2"><TeamLogo team={teams.find((team) => team.id === meeting.teamBId)} size="h-5 w-5" plain themeAware /><span className="truncate">{teamLabel(teams, meeting.teamBId)}</span></span>
                    </span>
                    <span className="text-right text-xs font-medium text-[var(--ui-muted)]">BO{meeting.bestOf}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <ChartCard title="AI 예측 적중률" caption="경기 시작 전 승률이 50%를 넘긴 팀이 이기면 적중">
            <AccuracySummary accuracy={accuracy} />
          </ChartCard>
        </div>
      </section>
    </div>
  );
}
