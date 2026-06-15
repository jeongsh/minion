import Link from "next/link";

import { SourceNotice } from "@/components/domain/source-notice";
import { getMatches, getStages, getTeams, getTournaments } from "@/lib/data/lck";
import type { Match, Team } from "@/lib/types";

// const leagueFilters = [
//   "LCK",
//   "EWC LoL",
//   "LCK CL",
//   "LPL",
//   "LEC",
//   "LCS",
//   "LCP",
//   "CBLOL",
//   "퍼스트 스탠드",
//   "시즌 오프닝",
//   "월드 챔피언십",
//   "ASI",
// ];

const months = Array.from({ length: 12 }, (_, index) => index + 1);

function dateKey(match: Match) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).format(new Date(match.matchDate));
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function monthOf(match: Match) {
  return new Date(match.matchDate).getMonth() + 1;
}

function statusLabel(status: Match["status"]) {
  if (status === "completed") {
    return "종료";
  }

  if (status === "live") {
    return "진행";
  }

  return "예정";
}

function stageName(stages: Awaited<ReturnType<typeof getStages>>, stageId: string) {
  return stages.find((stage) => stage.id === stageId)?.name ?? "-";
}

function teamById(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId);
}

function scoreText(match: Match) {
  if (match.teamAScore === null || match.teamBScore === null) {
    return "vs";
  }

  return `${match.teamAScore} : ${match.teamBScore}`;
}

function TeamMark({ team, align = "left" }: { team?: Team; align?: "left" | "right" }) {
  if (!team) {
    return <span className="font-semibold">-</span>;
  }

  const badge = (
    <span
      className="grid size-8 shrink-0 place-items-center rounded-full border border-border bg-surface-muted text-xs font-bold"
      style={{ color: team.primaryColor }}
      aria-hidden="true"
    >
      {team.shortName.slice(0, 3)}
    </span>
  );

  return (
    <span className={`flex items-center gap-3 ${align === "right" ? "justify-end" : ""}`}>
      {align === "right" ? null : badge}
      <span className="font-semibold">{team.name}</span>
      {align === "right" ? badge : null}
    </span>
  );
}

export default async function SchedulePage() {
  const [matches, teams, tournaments, stages] = await Promise.all([
    getMatches(),
    getTeams(),
    getTournaments(),
    getStages(),
  ]);
  const sortedMatches = [...matches].sort(
    (a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime(),
  );
  const activeMonth = sortedMatches[0] ? monthOf(sortedMatches[0]) : new Date().getMonth() + 1;
  const activeTournament = tournaments[0];
  const dateGroups = sortedMatches.reduce<Record<string, Match[]>>((groups, match) => {
    const key = dateKey(match);

    return {
      ...groups,
      [key]: [...(groups[key] ?? []), match],
    };
  }, {});

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-8">
      {/* <section className="rounded-md border border-border bg-surface px-5 py-4" aria-label="리그 선택">
        <div className="flex gap-5 overflow-x-auto pb-1">
          {leagueFilters.map((league, index) => (
            <button
              key={league}
              type="button"
              className="flex min-w-20 flex-col items-center gap-2 text-sm"
            >
              <span
                className={`grid size-14 place-items-center rounded-full border text-xs font-black ${
                  index === 0
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-surface-muted text-muted"
                }`}
              >
                {league
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 3)}
              </span>
              <span className={index === 0 ? "font-semibold text-accent" : "text-foreground"}>
                {league}
              </span>
            </button>
          ))}
        </div>
      </section> */}

      <section className="flex flex-col gap-6" aria-labelledby="schedule-title">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 id="schedule-title" className="text-2xl font-bold">
            {activeTournament?.name ?? "LCK"} 경기 일정
          </h1>
          <div className="flex items-center gap-4 md:justify-end">
            <button type="button" className="text-2xl text-muted" aria-label="이전 연도">
              ‹
            </button>
            <strong className="text-3xl font-black tracking-normal">2026</strong>
            <button type="button" className="text-2xl text-muted" aria-label="다음 연도">
              ›
            </button>
            <button type="button" className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted">
              최신
            </button>
          </div>
        </div>

        <div className="border-y border-border">
          <div className="grid grid-cols-6 gap-0 md:grid-cols-12">
            {months.map((month) => (
              <button
                key={month}
                type="button"
                className={`border-b-2 px-3 py-4 text-sm font-semibold ${
                  month === activeMonth
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {month}월
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 overflow-x-auto border-b border-border pb-4">
          <button type="button" className="flex items-center gap-2 pr-4 text-sm font-semibold">
            <span className="text-2xl leading-none">≡</span>
            전체
          </button>
          {teams.map((team) => (
            <button key={team.id} type="button" className="flex min-w-fit items-center gap-2 text-sm text-muted">
              <span
                className="grid size-7 place-items-center rounded-full bg-surface-muted text-[10px] font-bold"
                style={{ color: team.primaryColor }}
              >
                {team.shortName.slice(0, 3)}
              </span>
              {team.shortName}
            </button>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-border bg-surface" aria-label="경기 목록">
        {Object.entries(dateGroups).map(([date, groupMatches]) => (
          <div key={date}>
            <div className="border-b border-border bg-surface-muted px-5 py-4">
              <h2 className="text-xl font-black">{date}</h2>
            </div>
            <div className="divide-y divide-border">
              {groupMatches.map((match) => {
                const teamA = teamById(teams, match.teamAId);
                const teamB = teamById(teams, match.teamBId);
                const hasVod = Boolean(match.vodUrl);

                return (
                  <div
                    key={match.id}
                    className="grid gap-4 px-5 py-4 md:grid-cols-[4.5rem_4.5rem_7rem_minmax(12rem,1fr)_5rem_minmax(12rem,1fr)_6rem_8rem] md:items-center"
                  >
                    <time className="text-base font-bold">{timeLabel(match.matchDate)}</time>
                    <span className="w-fit rounded bg-surface-muted px-2 py-1 text-xs font-semibold text-muted">
                      {statusLabel(match.status)}
                    </span>
                    <span className="text-sm text-muted">{stageName(stages, match.stageId)}</span>
                    <Link href={`/teams/${teamA?.slug ?? ""}`} className="min-w-0">
                      <TeamMark team={teamA} align="right" />
                    </Link>
                    <Link href={`/matches/${match.id}`} className="text-center text-2xl font-black">
                      {scoreText(match)}
                    </Link>
                    <Link href={`/teams/${teamB?.slug ?? ""}`} className="min-w-0">
                      <TeamMark team={teamB} />
                    </Link>
                    {hasVod ? (
                      <a
                        href={match.vodUrl ?? "#"}
                        className="rounded-md border border-border px-3 py-2 text-center text-sm font-semibold"
                      >
                        다시보기
                      </a>
                    ) : (
                      <Link
                        href={`/matches/${match.id}`}
                        className="rounded-md border border-border px-3 py-2 text-center text-sm font-semibold"
                      >
                        상세
                      </Link>
                    )}
                    <span className="text-sm text-muted md:text-right">{match.venue ?? "경기장 미정"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <SourceNotice />
    </main>
  );
}
