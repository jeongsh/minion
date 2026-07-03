import Link from "next/link";

import { SectionHeader } from "@/components/layout/section-header";
import { getAllTeams, getMatches, getStages, getTournaments } from "@/lib/data/lck";
import { buildAllStageColumns, splitBracketSides } from "@/lib/tournaments/bracket";
import {
  INTERNATIONAL_SEGMENTS,
  internationalSegmentByKey,
} from "@/lib/tournaments/international-segments";
import { segmentForTournament } from "@/lib/tournaments/season-2026";
import type { Match, Team } from "@/lib/types";

import { createStageAction } from "./actions";
import {
  TournamentBracketEditor,
  type EditorMatch,
  type MatchOptionGroup,
} from "./stage-bracket-editor";

function toEditorMatch(match: Match, teamMap: Map<string, Team>): EditorMatch {
  return {
    id: match.id,
    matchDate: match.matchDate,
    bestOf: match.bestOf ?? null,
    teamAName: teamMap.get(match.teamAId)?.shortName ?? "TBD",
    teamBName: teamMap.get(match.teamBId)?.shortName ?? "TBD",
    teamAScore: match.teamAScore,
    teamBScore: match.teamBScore,
    advancesToMatchId: match.advancesToMatchId ?? null,
  };
}

export default async function AdminTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; year?: string }>;
}) {
  const params = await searchParams;
  const requestedSegment = params.segment ? internationalSegmentByKey(params.segment) : null;
  const segmentTheme = requestedSegment ?? INTERNATIONAL_SEGMENTS[0];

  const [tournaments, stages, matches, teams] = await Promise.all([
    getTournaments(),
    getStages(),
    getMatches(),
    getAllTeams(),
  ]);

  const segmentTournaments = tournaments.filter(
    (tournament) => segmentForTournament(tournament) === segmentTheme.key,
  );

  const seasons = [...new Set(segmentTournaments.map((tournament) => tournament.season))].sort(
    (a, b) => b - a,
  );
  const requestedSeason = params.year ? Number(params.year) : Number.NaN;
  const activeSeason = seasons.includes(requestedSeason) ? requestedSeason : seasons[0];

  const activeTournaments = segmentTournaments.filter(
    (tournament) => tournament.season === activeSeason,
  );
  const tournamentIds = new Set(activeTournaments.map((tournament) => tournament.id));
  const primaryTournamentId = activeTournaments[0]?.id ?? null;

  const segmentStages = stages.filter((stage) => tournamentIds.has(stage.tournamentId));
  const segmentMatches = matches.filter((match) => tournamentIds.has(match.tournamentId));
  const teamMap = new Map(teams.map((team) => [team.id, team]));

  const columns = buildAllStageColumns(segmentStages, segmentMatches);
  const matchOptions: MatchOptionGroup[] = columns.map(({ stage, matches: stageMatches }) => ({
    stageId: stage.id,
    stageName: stage.name,
    matches: stageMatches.map((match) => ({
      id: match.id,
      label: `${teamMap.get(match.teamAId)?.shortName ?? "TBD"} vs ${
        teamMap.get(match.teamBId)?.shortName ?? "TBD"
      }`,
    })),
  }));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="관리자" title="대회 관리" />

      <section className="flex flex-wrap gap-2">
        {INTERNATIONAL_SEGMENTS.map((segment) => (
          <Link
            key={segment.key}
            href={`/admin/tournaments?segment=${segment.key}`}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              segment.key === segmentTheme.key
                ? "bg-foreground text-background"
                : "bg-surface-muted text-muted hover:text-foreground"
            }`}
          >
            {segment.name}
          </Link>
        ))}
      </section>

      {seasons.length > 1 ? (
        <section className="flex flex-wrap gap-2">
          {seasons.map((season) => (
            <Link
              key={season}
              href={`/admin/tournaments?segment=${segmentTheme.key}&year=${season}`}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                season === activeSeason
                  ? "bg-accent text-accent-foreground"
                  : "bg-surface-muted text-muted hover:text-foreground"
              }`}
            >
              {season}
            </Link>
          ))}
        </section>
      ) : null}

      {primaryTournamentId ? (
        <form
          action={createStageAction}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4"
        >
          <input type="hidden" name="segmentKey" value={segmentTheme.key} />
          <input type="hidden" name="tournamentId" value={primaryTournamentId} />
          <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
            라운드 이름
            <input
              type="text"
              name="name"
              required
              placeholder="예: Bracket Round 5"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-foreground">
            추가할 위치
            <select
              name="afterStageId"
              defaultValue=""
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">맨 앞에 추가</option>
              {columns.map(({ stage }) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name} 다음에 추가
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background"
          >
            라운드 추가
          </button>
        </form>
      ) : null}

      {columns.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          {activeSeason ? `${activeSeason} ${segmentTheme.name}에 등록된 대진이 없습니다.` : "등록된 대회가 없습니다."}
        </p>
      ) : (
        <section className="overflow-hidden rounded-2xl bg-[#0a0e1a] p-6 shadow-2xl">
          <p className="mb-4 text-xs font-semibold text-white/40">
            카드를 드래그해서 다른 라운드나 조로 자유롭게 옮기거나 순서를 바꿀 수 있습니다. 버튼으로도 조를 바꿀 수 있습니다.
          </p>
          <TournamentBracketEditor
            segmentKey={segmentTheme.key}
            tournamentId={primaryTournamentId ?? ""}
            stages={columns.map(({ stage }) => ({ id: stage.id, name: stage.name }))}
            matchOptions={matchOptions}
            initialBoard={Object.fromEntries(
              columns.map(({ stage, matches: stageMatches }) => {
                const { upper, lower } = splitBracketSides(stageMatches);
                return [
                  stage.id,
                  {
                    upper: upper.map((match) => toEditorMatch(match, teamMap)),
                    lower: lower.map((match) => toEditorMatch(match, teamMap)),
                  },
                ];
              }),
            )}
          />
        </section>
      )}
    </main>
  );
}
