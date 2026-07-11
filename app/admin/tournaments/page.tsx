import Link from "next/link";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { getAllTeams, getBracketStages, getMatches, getStages, getTournaments } from "@/lib/data/lck";
import { buildAllStageColumns, isWeekStage, splitBracketSides } from "@/lib/tournaments/bracket";
import {
  DOMESTIC_SEGMENTS,
  INTERNATIONAL_SEGMENTS,
  segmentThemeByKey,
} from "@/lib/tournaments/international-segments";
import { matchesTournamentSegment } from "@/lib/tournaments/season-2026";
import type { Match, Team, Tournament } from "@/lib/types";

import { createBracketStageAction, createStageAction } from "./actions";
import { BracketStageTabs, type BracketStageTab } from "./bracket-stage-tabs";
import {
  TournamentBracketEditor,
  type EditorMatch,
  type MatchOptionGroup,
} from "./stage-bracket-editor";

const ALL_SEGMENTS = [...DOMESTIC_SEGMENTS, ...INTERNATIONAL_SEGMENTS];

// LCK는 스플릿 1/2/3(LCK컵, MSI로 가는 길, 토너먼트)의 게이트키핑 토너먼트만
// 브래킷 형태로 직접 편집한다. 정규 시즌 라운드(Rounds 1-2/3-4)는 순위표로만 다룬다.
const LCK_MANAGEABLE_SPLITS = new Set(["Cup", "Road to MSI", "Season Play-In", "Season Playoffs"]);

// 어드민 스플릿 탭도 유저페이지처럼 "스플릿 1/2/3" 3개로만 묶어서 보여준다. 스플릿 3은
// Season Play-In/Season Playoffs라는 별개 대회(tournament) 2개로 이뤄져 있어서, 그 안에서
// 어느 쪽을 편집할지 고르는 서브탭을 하나 더 둔다.
const LCK_SPLIT_GROUPS: Record<"1" | "2" | "3", string[]> = {
  "1": ["Cup"],
  "2": ["Road to MSI"],
  "3": ["Season Play-In", "Season Playoffs"],
};
const LCK_SPLIT_GROUP_BY_RAW_SPLIT: Record<string, "1" | "2" | "3"> = {
  Cup: "1",
  "Road to MSI": "2",
  "Season Play-In": "3",
  "Season Playoffs": "3",
};
function formatMatchDateShort(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

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
    groupIndex: match.groupIndex,
  };
}

type SplitOption = { key: string; label: string; tournamentId: string };

/**
 * 세그먼트 하나가 여러 개의 실제 대회(예: LCK의 Rounds 1-2 / Road to MSI / Rounds 3-4 등)를
 * 묶고 있을 수 있다. 같은 split 이름으로 중복 수집된 대회(예: gol.gg/Leaguepedia 이중 수집)가
 * 있으면 매치가 더 많이 채워진 쪽을 관리 대상으로 고른다.
 */
function buildSplitOptions(
  activeTournaments: Tournament[],
  matches: Match[],
  allowedSplits?: Set<string>,
): SplitOption[] {
  const matchCountByTournament = new Map<string, number>();
  for (const match of matches) {
    matchCountByTournament.set(match.tournamentId, (matchCountByTournament.get(match.tournamentId) ?? 0) + 1);
  }

  // split이 없는 대회(예: LCK 시즌 요약 대회)는 순위 집계 전용이라 브래킷 관리 대상이 아니다.
  const bestByKey = new Map<string, Tournament>();
  for (const tournament of activeTournaments) {
    if (!tournament.split) continue;
    if (allowedSplits && !allowedSplits.has(tournament.split)) continue;
    const current = bestByKey.get(tournament.split);
    if (!current || (matchCountByTournament.get(tournament.id) ?? 0) > (matchCountByTournament.get(current.id) ?? 0)) {
      bestByKey.set(tournament.split, tournament);
    }
  }

  return [...bestByKey.entries()]
    .sort(([, a], [, b]) => (a.startDate ?? "").localeCompare(b.startDate ?? ""))
    .map(([key, tournament]) => ({ key, label: tournament.split ?? tournament.name, tournamentId: tournament.id }));
}

function SplitTabs({
  segmentKey,
  year,
  options,
  activeKey,
}: {
  segmentKey: string;
  year: number;
  options: SplitOption[];
  activeKey: string;
}) {
  if (options.length <= 1) return null;

  return (
    <section className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Link
          key={option.key}
          href={`/admin/tournaments?segment=${segmentKey}&year=${year}&split=${encodeURIComponent(option.key)}`}
          className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
            option.key === activeKey
              ? "bg-accent text-accent-foreground"
              : "bg-surface-muted text-muted hover:text-foreground"
          }`}
        >
          {option.label}
        </Link>
      ))}
    </section>
  );
}

export default async function AdminTournamentsPage({
  searchParams,
}: {
  searchParams: Promise<{ segment?: string; year?: string; bracketStageId?: string; split?: string }>;
}) {
  const params = await searchParams;
  const requestedSegment = params.segment ? segmentThemeByKey(params.segment) : null;
  const segmentTheme = requestedSegment ?? ALL_SEGMENTS[0];

  const [tournaments, stages, matches, teams, bracketStages] = await Promise.all([
    getTournaments(),
    getStages(),
    getMatches(),
    getAllTeams(),
    getBracketStages(),
  ]);

  const segmentTournaments = tournaments.filter((tournament) =>
    matchesTournamentSegment(tournament, segmentTheme.key),
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

  const splitOptions = buildSplitOptions(
    activeTournaments,
    matches,
    segmentTheme.key === "lck" ? LCK_MANAGEABLE_SPLITS : undefined,
  );
  const activeSplit =
    splitOptions.find((option) => option.key === params.split) ?? splitOptions[0] ?? null;

  const isLckSegment = segmentTheme.key === "lck";
  const activeSplitGroup = isLckSegment && activeSplit ? LCK_SPLIT_GROUP_BY_RAW_SPLIT[activeSplit.key] : null;
  const splitGroupTabs = isLckSegment
    ? (["1", "2", "3"] as const)
        .map((groupNumber) => {
          const firstOption = LCK_SPLIT_GROUPS[groupNumber]
            .map((rawSplit) => splitOptions.find((option) => option.key === rawSplit))
            .find((option): option is SplitOption => Boolean(option));
          if (!firstOption) return null;
          return { groupNumber, label: LCK_SPLIT_GROUPS[groupNumber].length > 1 ? `스플릿 ${groupNumber}` : `스플릿 ${groupNumber} · ${firstOption.label}`, targetKey: firstOption.key };
        })
        .filter((tab): tab is { groupNumber: "1" | "2" | "3"; label: string; targetKey: string } => tab != null)
    : [];
  const subSplitOptions =
    isLckSegment && activeSplitGroup
      ? LCK_SPLIT_GROUPS[activeSplitGroup]
          .map((rawSplit) => splitOptions.find((option) => option.key === rawSplit))
          .filter((option): option is SplitOption => Boolean(option))
      : [];
  const primaryTournamentId = activeSplit?.tournamentId ?? activeTournaments[0]?.id ?? null;

  // LCK컵(스플릿 1)의 "Week" 스테이지는 브래킷이 아니라 공개 페이지에서 순위표로 따로
  // 보여주므로, 라운드 편집기에도 노출하지 않는다.
  const segmentStages = stages
    .filter((stage) => tournamentIds.has(stage.tournamentId))
    .filter((stage) => !(activeSplit?.key === "Cup" && isWeekStage(stage.name)));
  const segmentMatches = matches.filter((match) => tournamentIds.has(match.tournamentId));
  const teamMap = new Map(teams.map((team) => [team.id, team]));

  const tournamentBracketStages = bracketStages
    .filter((bracketStage) => bracketStage.tournamentId === primaryTournamentId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const activeBracketStage =
    tournamentBracketStages.find((bracketStage) => bracketStage.id === params.bracketStageId) ??
    tournamentBracketStages[0] ??
    null;

  // 스플릿 3(Season Play-In/Season Playoffs)은 서로 다른 대회라 브래킷 스테이지도 각자
  // 하나씩 따로 갖고 있다. 매번 스플릿을 옮겨 다니지 않아도 되도록, 이 경우엔 두 대회의
  // 브래킷 스테이지를 "브래킷 스테이지" 탭 하나에 같이 보여주고 각 탭이 자기 대회의
  // split 값을 함께 들고 다니게 한다.
  const bracketStageTabsForDisplay: BracketStageTab[] =
    isLckSegment && subSplitOptions.length > 1
      ? subSplitOptions
          .map((option): BracketStageTab | null => {
            const stage = bracketStages
              .filter((bracketStage) => bracketStage.tournamentId === option.tournamentId)
              .sort((a, b) => a.orderIndex - b.orderIndex)[0];
            return stage ? { id: stage.id, name: stage.name, split: option.key } : null;
          })
          .filter((tab): tab is BracketStageTab => tab != null)
      : tournamentBracketStages.map((bracketStage) => ({ id: bracketStage.id, name: bracketStage.name }));

  const columns = buildAllStageColumns(segmentStages, segmentMatches);
  const activeColumns = activeBracketStage
    ? columns.filter(({ stage }) => stage.bracketStageId === activeBracketStage.id)
    : [];

  // "다음 경기 지정" 후보는 지금 보고 있는 브래킷 스테이지 안으로만 좁힌다. 대회 전체
  // (다른 브래킷 스테이지나 LCK의 다른 스플릿 수십 주차)를 다 보여주면 관련 없는 라운드가
  // 섞이고 TBD vs TBD가 끝없이 나열돼 찾기 어렵다.
  const activeBracketStageStages = activeBracketStage
    ? stages
        .filter((stage) => stage.bracketStageId === activeBracketStage.id)
        .filter((stage) => !(activeSplit?.key === "Cup" && isWeekStage(stage.name)))
    : [];
  const activeBracketStageMatches = matches.filter((match) =>
    activeBracketStageStages.some((stage) => stage.id === match.stageId),
  );
  const primaryColumns = buildAllStageColumns(activeBracketStageStages, activeBracketStageMatches);
  const matchOptions: MatchOptionGroup[] = primaryColumns.map(({ stage, matches: stageMatches }) => ({
    stageId: stage.id,
    stageName: stage.name,
    matches: [...stageMatches]
      .sort((a, b) => new Date(a.matchDate).getTime() - new Date(b.matchDate).getTime())
      .map((match) => ({
        id: match.id,
        label: `${formatMatchDateShort(match.matchDate)} · ${teamMap.get(match.teamAId)?.shortName ?? "TBD"} vs ${
          teamMap.get(match.teamBId)?.shortName ?? "TBD"
        }`,
      })),
  }));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <div className="flex flex-col gap-2">
        <Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "대회 관리" }]} />
        <SectionHeader title="대회 관리" />
      </div>

      <section className="flex flex-wrap gap-2">
        {ALL_SEGMENTS.map((segment) => (
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

      {isLckSegment ? (
        <section className="flex flex-wrap gap-2">
          {splitGroupTabs.map((tab) => (
            <Link
              key={tab.groupNumber}
              href={`/admin/tournaments?segment=${segmentTheme.key}&year=${activeSeason}&split=${encodeURIComponent(tab.targetKey)}`}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                tab.groupNumber === activeSplitGroup
                  ? "bg-accent text-accent-foreground"
                  : "bg-surface-muted text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </section>
      ) : (
        <SplitTabs
          segmentKey={segmentTheme.key}
          year={activeSeason}
          options={splitOptions}
          activeKey={activeSplit?.key ?? ""}
        />
      )}

      {primaryTournamentId ? (
        <section className="flex flex-wrap items-start gap-3">
          <BracketStageTabs
            segmentKey={segmentTheme.key}
            year={activeSeason}
            split={activeSplit?.key}
            bracketStages={bracketStageTabsForDisplay}
            activeBracketStageId={activeBracketStage?.id ?? ""}
          />

          <form
            action={createBracketStageAction}
            className="flex items-end gap-2 rounded-lg border border-border bg-surface p-3"
          >
            <input type="hidden" name="segmentKey" value={segmentTheme.key} />
            <input type="hidden" name="tournamentId" value={primaryTournamentId} />
            <label className="flex flex-col gap-1 text-[13px] font-semibold text-foreground">
              새 브래킷 스테이지
              <input
                type="text"
                name="name"
                required
                placeholder="예: 플레이-인"
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              />
            </label>
            <Button type="submit" size="sm">
              추가
            </Button>
          </form>
        </section>
      ) : null}

      {primaryTournamentId && activeBracketStage ? (
        <form
          action={createStageAction}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-4"
        >
          <input type="hidden" name="segmentKey" value={segmentTheme.key} />
          <input type="hidden" name="tournamentId" value={primaryTournamentId} />
          <input type="hidden" name="bracketStageId" value={activeBracketStage.id} />
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
              {activeColumns.map(({ stage }) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name} 다음에 추가
                </option>
              ))}
            </select>
          </label>
          <Button type="submit">
            라운드 추가
          </Button>
        </form>
      ) : null}

      {!primaryTournamentId ? (
        <p className="rounded-lg border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          등록된 대회가 없습니다.
        </p>
      ) : !activeBracketStage ? (
        <p className="rounded-lg border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          {activeSeason} {segmentTheme.name}에 브래킷 스테이지가 없습니다. 위에서 먼저 하나 추가해주세요.
        </p>
      ) : activeColumns.length === 0 ? (
        <p className="rounded-lg border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
          &quot;{activeBracketStage.name}&quot;에 등록된 대진이 없습니다.
        </p>
      ) : (
        <section className="overflow-hidden rounded-2xl bg-[#0a0e1a] p-6 shadow-2xl">
          <p className="mb-4 text-[13px] font-semibold text-white/40">
            카드를 드래그해서 다른 라운드나 조로 자유롭게 옮기거나 순서를 바꿀 수 있습니다. 버튼으로도 조를 바꿀 수 있습니다.
          </p>
          <TournamentBracketEditor
            segmentKey={segmentTheme.key}
            bracketStageId={activeBracketStage.id}
            bracketStages={tournamentBracketStages.map((bracketStage) => ({
              id: bracketStage.id,
              name: bracketStage.name,
            }))}
            stages={activeColumns.map(({ stage }) => ({ id: stage.id, name: stage.name }))}
            matchOptions={matchOptions}
            initialBoard={Object.fromEntries(
              activeColumns.map(({ stage, matches: stageMatches }) => {
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
