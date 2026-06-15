import Link from "next/link";
import { notFound } from "next/navigation";
import { MiniModalLink } from "@/components/domain/mini-modal-link";
import { SourceNotice } from "@/components/domain/source-notice";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
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
import type { SetResult } from "@/lib/types";
import {
  durationLabel,
  formatDateTime,
  matchSetScore,
  playerLabel,
  teamLabel,
  topFanRatingForMatch,
} from "@/lib/view-data";

function setLabel(set: SetResult) {
  return `${set.setNumber}세트`;
}

function DraftPills({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.length === 0 ? (
        <span className="text-xs text-muted">-</span>
      ) : (
        items.map((item, index) => (
          <span key={`${item}-${index}`} className="rounded-md bg-surface-muted px-2 py-1 text-xs font-semibold">
            {item}
          </span>
        ))
      )}
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
  const championName = (championId: string) =>
    champions.find((champion) => champion.id === championId)?.name ?? "-";
  const draftList = (setId: string, side: "blue" | "red", actionType: "pick" | "ban") =>
    picksBans
      .filter((item) => item.setId === setId && item.side === side && item.actionType === actionType)
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((item) => championName(item.championId));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="경기 상세" title={match.name} />

      <section className="page-grid" aria-label="경기 요약">
        <StatCard label="경기명" value={match.name} />
        <StatCard label="일시" value={formatDateTime(match.matchDate)} />
        <StatCard label="대회" value={tournament?.name ?? "-"} />
        <StatCard label="구간" value={stage?.name ?? "-"} />
        <StatCard label="팀" value={`${teamLabel(teams, match.teamAId)} vs ${teamLabel(teams, match.teamBId)}`} />
        <StatCard label="최종 스코어" value={`${match.teamAScore ?? "-"}:${match.teamBScore ?? "-"}`} />
        <StatCard label="세트 스코어" value={matchSetScore(match, sets, teams)} />
        <StatCard label="공식 POM" value={playerLabel(players, match.officialPomPlayerId)} />
        <StatCard label="팬 평점 1위" value={topFanRatingForMatch(match.id, fanRatings, players)} />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="set-results">
        <h2 id="set-results" className="text-xl font-semibold">
          세트별 결과
        </h2>
        <DataTable
          rows={sets}
          columns={[
            { key: "set", label: "세트", render: setLabel },
            { key: "winner", label: "승리팀", render: (row) => teamLabel(teams, row.winnerTeamId) },
            { key: "blue", label: "블루팀", render: (row) => teamLabel(teams, row.blueTeamId) },
            { key: "red", label: "레드팀", render: (row) => teamLabel(teams, row.redTeamId) },
            { key: "time", label: "경기 시간", render: (row) => durationLabel(row.durationSeconds) },
            { key: "kills", label: "킬", render: (row) => `${row.blueKills ?? "-"}:${row.redKills ?? "-"}` },
            {
              key: "gold",
              label: "골드",
              render: (row) =>
                `${row.blueGold?.toLocaleString("ko-KR") ?? "-"}:${row.redGold?.toLocaleString("ko-KR") ?? "-"}`,
            },
            {
              key: "link",
              label: "이동",
              render: (row) => <Link href={`/matches/${match.id}/sets/${row.id}`}>세트 상세</Link>,
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="set-drafts">
        <h2 id="set-drafts" className="text-xl font-semibold">
          세트별 밴픽 목록
        </h2>
        <DataTable
          rows={sets}
          columns={[
            { key: "set", label: "세트", render: setLabel },
            { key: "blue-bans", label: "블루 밴", render: (row) => <DraftPills items={draftList(row.id, "blue", "ban")} /> },
            { key: "blue-picks", label: "블루 픽", render: (row) => <DraftPills items={draftList(row.id, "blue", "pick")} /> },
            { key: "red-bans", label: "레드 밴", render: (row) => <DraftPills items={draftList(row.id, "red", "ban")} /> },
            { key: "red-picks", label: "레드 픽", render: (row) => <DraftPills items={draftList(row.id, "red", "pick")} /> },
            {
              key: "link",
              label: "상세",
              render: (row) => (
                <MiniModalLink
                  href={`/matches/${match.id}/sets/${row.id}`}
                  label="전체 밴픽"
                  eyebrow="세트"
                  title={`${row.setNumber}세트`}
                  rows={[
                    { label: "승리팀", value: teamLabel(teams, row.winnerTeamId) },
                    { label: "경기 시간", value: durationLabel(row.durationSeconds) },
                  ]}
                  cta="세트 상세 보기"
                />
              ),
            },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="match-ratings">
        <h2 id="match-ratings" className="text-xl font-semibold">
          매치 평점
        </h2>
        <DataTable
          rows={matchRatings}
          columns={[
            { key: "player", label: "선수", render: (row) => playerLabel(players, row.playerId) },
            { key: "rating", label: "평점", render: (row) => row.rating.toFixed(1) },
            { key: "review", label: "리뷰", render: (row) => row.review },
          ]}
        />
      </section>

      <SourceNotice />
    </main>
  );
}
