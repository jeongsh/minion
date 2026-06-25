"use client";

import Link from "next/link";
import { useState } from "react";
import { DataTable } from "@/components/ui/data-table";
import { durationLabel, formatDateTime, matchHref, playerLabel } from "@/lib/view-data";
import type { Match, Player, SetResult, Team, Tournament } from "@/lib/types";

type Props = {
  teamId: string;
  matches: Match[];
  sets: SetResult[];
  teams: Team[];
  players: Player[];
  tournaments: Tournament[];
};

const LEAGUE_LABELS: Record<string, string> = {
  LCK: "LCK",
  MSI: "MSI",
  Worlds: "월즈",
  "First Stand": "퍼스트스탠드",
  EWC: "EWC",
};
const LEAGUE_ORDER = ["LCK", "MSI", "Worlds", "First Stand", "EWC"];

export function TeamMatchHistory({ teamId, matches, sets, teams, players, tournaments }: Props) {
  const tournamentMap = new Map(tournaments.map((t) => [t.id, t]));

  const years = [...new Set(
    matches
      .map((m) => tournamentMap.get(m.tournamentId)?.season)
      .filter((y): y is number => y != null),
  )].sort((a, b) => b - a);

  const leaguesInData = new Set(
    matches
      .map((m) => tournamentMap.get(m.tournamentId)?.league)
      .filter((l): l is string => !!l && l in LEAGUE_LABELS),
  );
  const leagues = LEAGUE_ORDER.filter((l) => leaguesInData.has(l));

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [opponentQuery, setOpponentQuery] = useState("");

  const opponentMatches = opponentQuery.trim()
    ? (() => {
        const q = opponentQuery.trim().toLowerCase();
        const matched = teams.filter(
          (t) => t.slug.toLowerCase().includes(q) || t.shortName.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
        );
        const matchedIds = new Set(matched.map((t) => t.id));
        return new Set(
          matches
            .filter((m) => {
              const opId = m.teamAId === teamId ? m.teamBId : m.teamAId;
              return matchedIds.has(opId);
            })
            .map((m) => m.id),
        );
      })()
    : null;

  const filtered = [...matches]
    .filter((m) => {
      const t = tournamentMap.get(m.tournamentId);
      if (!t) return false;
      if (selectedYear && t.season !== selectedYear) return false;
      if (selectedLeague && t.league !== selectedLeague) return false;
      if (opponentMatches && !opponentMatches.has(m.id)) return false;
      return true;
    })
    .sort((a, b) => b.matchDate.localeCompare(a.matchDate));

  return (
    <div className="flex flex-col gap-4">
      {/* 연도 필터 */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setSelectedYear(null)}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
            selectedYear === null
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border bg-surface text-muted hover:bg-surface-muted"
          }`}
        >
          전체
        </button>
        {years.map((year) => (
          <button
            key={year}
            onClick={() => setSelectedYear(selectedYear === year ? null : year)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              selectedYear === year
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-surface text-muted hover:bg-surface-muted"
            }`}
          >
            {year}
          </button>
        ))}
      </div>

      {/* 리그 필터 */}
      <div className="flex flex-wrap gap-1.5">
        {leagues.map((league) => (
          <button
            key={league}
            onClick={() => setSelectedLeague(selectedLeague === league ? null : league)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              selectedLeague === league
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-surface text-muted hover:bg-surface-muted"
            }`}
          >
            {LEAGUE_LABELS[league]}
          </button>
        ))}
      </div>

      {/* 상대팀 검색 */}
      <div className="relative w-48">
        <input
          type="text"
          value={opponentQuery}
          onChange={(e) => setOpponentQuery(e.target.value)}
          placeholder="상대팀 검색"
          className="w-full rounded-full border border-border bg-surface px-3 py-1 text-xs text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent"
        />
        {opponentQuery && (
          <button
            onClick={() => setOpponentQuery("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
            aria-label="초기화"
          >
            ×
          </button>
        )}
      </div>

      {/* 테이블 */}
      <DataTable
        rows={filtered}
        emptyText="해당 조건의 경기가 없습니다."
        columns={[
          {
            key: "match",
            label: "경기",
            render: (row) => (
              <Link href={matchHref(row)} className="hover:text-accent">
                {row.name}
              </Link>
            ),
          },
          {
            key: "opponent",
            label: "상대",
            render: (row) => {
              const opponentId = row.teamAId === teamId ? row.teamBId : row.teamAId;
              return teams.find((t) => t.id === opponentId)?.shortName ?? "?";
            },
          },
          {
            key: "result",
            label: "결과",
            render: (row) => {
              const myScore = row.teamAId === teamId ? row.teamAScore : row.teamBScore;
              const opScore = row.teamAId === teamId ? row.teamBScore : row.teamAScore;
              if (myScore == null || opScore == null) return "-";
              const win = myScore > opScore;
              return (
                <span className={`font-bold ${win ? "text-blue-600" : "text-red-500"}`}>
                  {win ? "승" : "패"}
                </span>
              );
            },
          },
          {
            key: "score",
            label: "스코어",
            render: (row) => `${row.teamAScore ?? "-"}:${row.teamBScore ?? "-"}`,
          },
          {
            key: "sets",
            label: "세트",
            render: (row) => {
              const relatedSets = sets
                .filter((s) => s.matchId === row.id)
                .sort((a, b) => a.setNumber - b.setNumber);
              if (relatedSets.length === 0) return "-";
              return (
                <span className="flex gap-0.5">
                  {relatedSets.map((s) =>
                    s.winnerTeamId === teamId ? (
                      <span key={s.id} className="font-bold text-blue-600">승</span>
                    ) : (
                      <span key={s.id} className="font-bold text-red-500">패</span>
                    ),
                  )}
                </span>
              );
            },
          },
          {
            key: "duration",
            label: "세트 시간",
            render: (row) => durationLabel(sets.find((s) => s.matchId === row.id)?.durationSeconds),
          },
          {
            key: "pom",
            label: "POM",
            render: (row) => playerLabel(players, row.officialPomPlayerId),
          },
          {
            key: "date",
            label: "일시",
            render: (row) => formatDateTime(row.matchDate),
          },
        ]}
      />
    </div>
  );
}
