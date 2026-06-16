import Link from "next/link";
import { notFound } from "next/navigation";

import { SourceNotice } from "@/components/domain/source-notice";
import { DataTable } from "@/components/ui/data-table";
import {
  getChampions,
  getFanRatings,
  getMatchById,
  getPlayers,
  getSetPicksBans,
  getSetsByMatchId,
  getStages,
  getTeams,
  getTournaments,
} from "@/lib/data/lck";
import type { MatchStatus, SetPickBan, SetResult } from "@/lib/types";
import {
  durationLabel,
  formatDateTime,
  playerLabel,
  setHref,
  teamLabel,
  topFanRatingForMatch,
} from "@/lib/view-data";

const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  scheduled: "예정",
  live: "진행 중",
  completed: "종료",
};

function setLabel(set: SetResult) {
  return `${set.setNumber}세트`;
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

function winnerLabel({
  winnerTeamId,
  teams,
}: {
  winnerTeamId: string | null | undefined;
  teams: Awaited<ReturnType<typeof getTeams>>;
}) {
  return winnerTeamId ? teamLabel(teams, winnerTeamId) : "-";
}

function DraftPills({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.length === 0 ? (
        <span className="text-xs text-muted">-</span>
      ) : (
        items.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="rounded-md bg-surface-muted px-2 py-1 text-xs font-semibold"
          >
            {item}
          </span>
        ))
      )}
    </div>
  );
}

function setDraftItems({
  picksBans,
  setId,
  side,
  actionType,
  championName,
}: {
  picksBans: SetPickBan[];
  setId: string;
  side: "blue" | "red";
  actionType: "pick" | "ban";
  championName: (championId: string) => string;
}) {
  return picksBans
    .filter((item) => item.setId === setId && item.side === side && item.actionType === actionType)
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((item) => championName(item.championId));
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
    <div className={`flex min-w-0 flex-col gap-3 ${align === "right" ? "items-end text-right" : ""}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{seedLabel}</p>
      <div className={`flex items-center gap-3 ${align === "right" ? "flex-row-reverse" : ""}`}>
        <div>
          <p className="text-2xl font-semibold md:text-3xl">{teamName}</p>
          <p className="mt-1 text-sm font-semibold text-muted">{resultLabel}</p>
        </div>
        <span className="text-5xl font-semibold md:text-6xl">{score ?? "-"}</span>
      </div>
    </div>
  );
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const match = await getMatchById(matchId);

  if (!match) {
    notFound();
  }

  const [teams, players, sets, fanRatings, champions, picksBans, tournaments, stages] =
    await Promise.all([
      getTeams(),
      getPlayers(),
      getSetsByMatchId(match.id),
      getFanRatings(),
      getChampions(),
      getSetPicksBans(),
      getTournaments(),
      getStages(),
    ]);

  const tournament = tournaments.find((item) => item.id === match.tournamentId);
  const stage = stages.find((item) => item.id === match.stageId);
  const matchRatings = fanRatings.filter((rating) => rating.matchId === match.id);
  const teamAName = teamLabel(teams, match.teamAId);
  const teamBName = teamLabel(teams, match.teamBId);
  const championName = (championId: string) =>
    champions.find((champion) => champion.id === championId)?.name ?? "-";
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

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <section className="overflow-hidden rounded-md border border-border bg-surface" aria-label="매치 요약">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
          <TeamScoreBlock
            seedLabel="1st"
            teamName={teamAName}
            score={match.teamAScore}
            resultLabel={teamAResult}
          />

          <div className="rounded-md border border-border bg-surface-muted px-6 py-5 text-center">
            <p className="text-xs font-semibold text-muted">
              {tournament?.name ?? "대회 미지정"}
              {stage ? ` · ${stage.name}` : ""}
            </p>
            <p className="mt-2 text-4xl font-semibold">{matchScoreLabel(match.teamAScore, match.teamBScore)}</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-xs font-semibold text-muted">
              <span>{formatDateTime(match.matchDate)}</span>
              <span>Bo{match.bestOf ?? "-"}</span>
              <span>{MATCH_STATUS_LABEL[match.status]}</span>
            </div>
          </div>

          <TeamScoreBlock
            align="right"
            seedLabel="4th"
            teamName={teamBName}
            score={match.teamBScore}
            resultLabel={teamBResult}
          />
        </div>

      </section>

      <section className="grid gap-3 md:grid-cols-3" aria-label="매치 핵심 정보">
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs font-semibold text-muted">승리 팀</p>
          <p className="mt-2 text-lg font-semibold">{winnerLabel({ winnerTeamId: match.winnerTeamId, teams })}</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs font-semibold text-muted">공식 POM</p>
          <p className="mt-2 text-lg font-semibold">{playerLabel(players, match.officialPomPlayerId)}</p>
        </div>
        <div className="rounded-md border border-border bg-surface p-4">
          <p className="text-xs font-semibold text-muted">팬 평점 1위</p>
          <p className="mt-2 text-lg font-semibold">{topFanRatingForMatch(match.id, fanRatings, players)}</p>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="set-results">
        <h2 id="set-results" className="text-xl font-semibold">
          세트 결과
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {sets.length === 0 ? (
            <div className="rounded-md border border-dashed border-border bg-surface p-4 text-sm text-muted">
              세트 상세 데이터가 아직 연결되지 않았습니다.
            </div>
          ) : (
            sets.map((set) => (
              <Link
                key={set.id}
                href={setHref(match, set)}
                className="rounded-md border border-border bg-surface p-4 hover:bg-surface-muted"
              >
                <div className="flex items-center justify-between gap-3">
                  <strong>{setLabel(set)}</strong>
                  <span className="text-sm font-semibold text-accent">{teamLabel(teams, set.winnerTeamId)} 승</span>
                </div>
                <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-sm">
                  <span>{teamLabel(teams, set.blueTeamId)}</span>
                  <strong>
                    {set.blueKills ?? "-"} : {set.redKills ?? "-"}
                  </strong>
                  <span className="text-right">{teamLabel(teams, set.redTeamId)}</span>
                </div>
                <div className="mt-3 text-xs text-muted">
                  {durationLabel(set.durationSeconds)} · 드래곤 {set.blueDragons ?? "-"}:{set.redDragons ?? "-"} · 바론{" "}
                  {set.blueBarons ?? "-"}:{set.redBarons ?? "-"}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="set-drafts">
        <h2 id="set-drafts" className="text-xl font-semibold">
          세트별 밴픽 요약
        </h2>
        <DataTable
          rows={sets}
          emptyText="밴픽은 세트 상세가 연결된 뒤 세트별 목록으로 표시됩니다."
          columns={[
            { key: "set", label: "세트", render: setLabel },
            {
              key: "blue-bans",
              label: "블루 밴",
              render: (row) => (
                <DraftPills
                  items={setDraftItems({
                    picksBans,
                    setId: row.id,
                    side: "blue",
                    actionType: "ban",
                    championName,
                  })}
                />
              ),
            },
            {
              key: "blue-picks",
              label: "블루 픽",
              render: (row) => (
                <DraftPills
                  items={setDraftItems({
                    picksBans,
                    setId: row.id,
                    side: "blue",
                    actionType: "pick",
                    championName,
                  })}
                />
              ),
            },
            {
              key: "red-bans",
              label: "레드 밴",
              render: (row) => (
                <DraftPills
                  items={setDraftItems({
                    picksBans,
                    setId: row.id,
                    side: "red",
                    actionType: "ban",
                    championName,
                  })}
                />
              ),
            },
            {
              key: "red-picks",
              label: "레드 픽",
              render: (row) => (
                <DraftPills
                  items={setDraftItems({
                    picksBans,
                    setId: row.id,
                    side: "red",
                    actionType: "pick",
                    championName,
                  })}
                />
              ),
            },
          ]}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-[1fr_1fr]" aria-labelledby="match-reactions">
        <div className="rounded-md border border-border bg-surface p-4">
          <h2 id="match-reactions" className="text-xl font-semibold">
            매치 반응
          </h2>
          <p className="mt-4 text-sm text-muted">{matchRatings.length}개 반응</p>
          <div className="mt-4 rounded-md border border-dashed border-border p-4 text-sm text-muted">
            팬 반응/한줄평 입력 영역은 커뮤니티 기능과 연결해서 확장할 수 있습니다.
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-4">
          <h2 className="text-xl font-semibold">팬 평가</h2>
          <DataTable
            rows={matchRatings}
            emptyText="아직 등록된 평가가 없습니다."
            columns={[
              { key: "player", label: "선수", render: (row) => playerLabel(players, row.playerId) },
              { key: "rating", label: "평점", render: (row) => row.rating.toFixed(1) },
              { key: "review", label: "리뷰", render: (row) => row.review || "-" },
            ]}
          />
        </div>
      </section>

      <SourceNotice />
    </main>
  );
}
