"use client";

// import { useState } from "react";
import Link from "next/link";
import { SectionHeading } from "@/components/ui/section-heading";
import { TeamLogo } from "@/components/ui/team-logo";
import type { Match, Stage, Team } from "@/lib/types";
import type { HomeTournamentOverview as Overview } from "@/lib/tournaments/home-overview";
import { formatBracketColumnLabel } from "@/lib/tournaments/bracket";
import { formatDateTime, matchHref } from "@/lib/view-data";

import { summarizeHomeBracket } from "@/lib/tournaments/home-overview";

function MatchSummary({ match, stage, teamMap }: { match: Match; stage: Stage; teamMap: Map<string, Team> }) {
  return (
    <Link href={matchHref(match)} className="block min-w-0 rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--ui-card-hover)]">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2 text-[13px] font-medium text-[var(--ui-muted)]">
        <span className="truncate">{formatBracketColumnLabel(stage.name)}</span>
        <span className="shrink-0">{match.status === "live" ? "진행 중" : formatDateTime(match.matchDate)}</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <span className="flex min-w-0 items-center gap-2"><TeamLogo team={teamMap.get(match.teamAId)} themeAware plain size="size-6" /><span className="truncate text-[15px] font-bold">{teamMap.get(match.teamAId)?.shortName ?? "TBD"}</span></span>
        <span className="text-base font-bold tabular-nums">{match.status === "scheduled" ? "vs" : `${match.teamAScore ?? "–"} : ${match.teamBScore ?? "–"}`}</span>
        <span className="flex min-w-0 items-center justify-end gap-2"><span className="truncate text-[15px] font-bold">{teamMap.get(match.teamBId)?.shortName ?? "TBD"}</span><TeamLogo team={teamMap.get(match.teamBId)} themeAware plain size="size-6" /></span>
      </div>
    </Link>
  );
}

export type HomeTournamentOption = { key: string; label: string; name: string; overview: Overview };

export function HomeTournamentOverview({ overview: initialOverview, options, teams }: { overview: Overview; options: HomeTournamentOption[]; teams: Team[] }) {
  // 임시 대회 탭 복원 시 상태와 titleAccessory를 함께 활성화한다.
  // const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selectedKey: string | null = null;
  const selected = options.find((option) => option.key === selectedKey)
    ?? options.find((option) => option.name === initialOverview?.name);
  const overview = selected ? selected.overview : initialOverview;
  const teamMap = new Map(teams.map((team) => [team.id, team]));
  const summary = summarizeHomeBracket(overview?.columns ?? []);
  const standingColumns = overview?.groups.length === 1
    ? [0, 1].map((column) => ({ ...overview.groups[0], title: "", rows: overview.groups[0].rows.slice(column * 5, (column + 1) * 5) })).filter((group) => group.rows.length > 0)
    : overview?.groups.slice(0, 2).map((group) => ({ ...group, rows: group.rows.slice(0, 5) })) ?? [];
  const champion = summary.final?.match.winnerTeamId ? teamMap.get(summary.final.match.winnerTeamId) : undefined;
  return (
    <>
      <SectionHeading
        href={overview?.href ?? (selected ? `/tournaments/${selected.key}?year=${selected.name.slice(0, 4)}` : "/tournaments")}
        className="min-h-8 flex-wrap items-center sm:h-8 sm:flex-nowrap [&>h2]:shrink-0"
        titleAccessory={
          /* 임시 대회 전환 탭
          <div className="order-3 flex w-full min-w-0 gap-1 overflow-x-auto sm:order-none sm:w-auto sm:flex-1" aria-label="홈 대회 선택">
            {options.map((option) => <button key={option.key} type="button" aria-pressed={selected?.key === option.key} onClick={() => setSelectedKey(option.key)} className={`shrink-0 rounded-md px-2 py-1 text-[13px] font-medium transition-colors ${selected?.key === option.key ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "text-[var(--ui-muted)] hover:bg-[var(--ui-card-hover)]"}`}>{option.label}</button>)}
          </div>
          */ null
        }
      >{selected?.name ?? overview?.name ?? "최근 대회"}</SectionHeading>
      {!overview ? <p className="rounded-xl bg-[var(--ui-card-bg)] p-5 text-base text-[var(--ui-muted)] xl:min-h-[282px] xl:flex-1">등록된 대회 현황이 없습니다.</p> : (
        <div className="flex min-w-0 flex-col rounded-2xl bg-[var(--ui-card-bg)] p-3 sm:p-4 xl:min-h-[282px] xl:flex-1">
          {overview.groups.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {standingColumns.map((group) => (
                <div key={group.rows[0]?.team.id ?? group.title} className="min-w-0">
                  {group.title ? <h3 className="mb-2 text-lg font-bold">{group.title}</h3> : null}
                  <div className="grid grid-cols-[24px_minmax(0,1fr)_64px_48px] gap-2 px-2 pb-2 text-[13px] font-medium text-[var(--ui-muted)]">
                    <span className="col-span-2">팀 순위</span><span className="text-right">승패</span><span className="text-right">득실차</span>
                  </div>
                  <ol className="space-y-1">
                    {group.rows.map((row) => (
                      <li key={row.team.id}>
                        <Link href={`/teams?team=${encodeURIComponent(row.team.fanSiteHost || row.team.slug)}`} className="grid min-h-11 grid-cols-[24px_minmax(0,1fr)_64px_48px] items-center gap-2 rounded-lg bg-[var(--ui-surface)] px-2 py-2 hover:bg-[var(--ui-card-hover)]">
                          <span className="text-center text-sm font-medium tabular-nums">{row.rank}</span>
                          <span className="flex min-w-0 items-center gap-2"><TeamLogo team={row.team} themeAware plain size="size-6" /><span className="truncate text-[15px] font-bold">{row.team.shortName}</span></span>
                          <span className="text-right text-sm font-medium tabular-nums">{row.matchWins}승 {row.matchLosses}패</span>
                          <span className="text-right text-sm font-medium tabular-nums text-[var(--ui-muted)]">{row.setDiff > 0 ? "+" : ""}{row.setDiff}</span>
                        </Link>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          ) : summary.final ? (
            <div className="grid flex-1 items-center gap-4 sm:min-h-[220px] sm:grid-cols-2">
              <div className="flex items-center justify-center gap-4 py-5">
                <TeamLogo team={champion} themeAware plain size="size-16" />
                <div><p className="mb-1 text-[13px] font-medium text-[var(--ui-muted)]">{champion ? "우승" : "결승 종료"}</p><p className="text-2xl font-bold">{champion?.shortName ?? "결과 확인 중"}</p></div>
              </div>
              <div className="rounded-xl bg-[var(--ui-surface)]"><MatchSummary {...summary.final} teamMap={teamMap} /></div>
            </div>
          ) : overview.columns.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {summary.panels.map((panel) => (
                <div key={panel.title} className="min-w-0">
                  <h3 className="mb-2 text-sm font-medium text-[var(--ui-muted)]">{panel.title}</h3>
                  <div className="min-h-[220px] rounded-xl bg-[var(--ui-surface)]">
                    {panel.entries.length > 0 ? panel.entries.map((entry) => <MatchSummary key={entry.match.id} {...entry} teamMap={teamMap} />)
                      : <p className="px-3 py-5 text-base text-[var(--ui-muted)]">{panel.title === "최근 결과" ? "아직 종료된 경기가 없습니다." : "등록된 경기가 없습니다."}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="py-6 text-base text-[var(--ui-muted)]">아직 공개된 대진표가 없습니다.</p>}
        </div>
      )}
    </>
  );
}
