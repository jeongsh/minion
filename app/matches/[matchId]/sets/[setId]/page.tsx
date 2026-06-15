import Link from "next/link";
import { notFound } from "next/navigation";
import { MiniModalLink } from "@/components/domain/mini-modal-link";
import { SectionHeader } from "@/components/layout/section-header";
import { DataTable } from "@/components/ui/data-table";
import {
  getChampions,
  getFanRatings,
  getMatchById,
  getPlayerStatLines,
  getPlayers,
  getSetById,
  getSetPicksBans,
  getTeams,
} from "@/lib/data/lck";
import { calculatePlayerStats } from "@/lib/stats";
import type { Player, SetPickBan } from "@/lib/types";
import { durationLabel, playerLabel, teamLabel } from "@/lib/view-data";

function fiveSlots<T>(items: T[]) {
  return Array.from({ length: 5 }, (_, index) => items[index] ?? null);
}

function goldLabel(value: number | null | undefined) {
  if (!value) {
    return "-";
  }

  return `${(value / 1000).toFixed(1)}K`;
}

function DraftChampionTile({
  draft,
  championName,
  player,
  align = "left",
  muted = false,
}: {
  draft: SetPickBan | null;
  championName: string;
  player?: Player;
  align?: "left" | "right";
  muted?: boolean;
}) {
  return (
    <div
      className={`relative min-h-20 overflow-hidden rounded-md border border-border bg-background p-3 ${
        muted ? "opacity-75" : ""
      }`}
    >
      <div className={`flex h-full flex-col justify-between gap-2 ${align === "right" ? "items-end text-right" : ""}`}>
        <span className="text-xs font-semibold text-muted">{player?.position ?? draft?.phase ?? "대기"}</span>
        <div>
          <p className="text-base font-semibold">
            {draft ? (
              <MiniModalLink
                href="/stats/champions"
                label={championName}
                eyebrow="챔피언"
                title={championName}
                rows={[
                  { label: "픽", value: "집계 예정" },
                  { label: "밴", value: "집계 예정" },
                  { label: "승률", value: "집계 예정" },
                ]}
                cta="챔피언 스탯 보기"
              />
            ) : (
              "미입력"
            )}
          </p>
          <p className="text-xs text-muted">{player?.name ?? "선수 미입력"}</p>
        </div>
      </div>
      {muted ? <div className="absolute inset-x-3 top-1/2 h-px rotate-[-18deg] bg-muted" /> : null}
    </div>
  );
}

export default async function SetDetailPage({
  params,
}: {
  params: Promise<{ matchId: string; setId: string }>;
}) {
  const { matchId, setId } = await params;
  const [match, set] = await Promise.all([getMatchById(matchId), getSetById(setId)]);

  if (!match || !set || set.matchId !== match.id) {
    notFound();
  }

  const [teams, players, champions, picksBans, playerStatLines, fanRatings] = await Promise.all([
    getTeams(),
    getPlayers(),
    getChampions(),
    getSetPicksBans(set.id),
    getPlayerStatLines(set.id),
    getFanRatings(),
  ]);
  const championName = (championId: string) =>
    champions.find((champion) => champion.id === championId)?.name ?? "-";
  const sideDraftItems = (side: "blue" | "red", actionType: "pick" | "ban") =>
    picksBans
      .filter((item) => item.side === side && item.actionType === actionType)
      .sort((a, b) => a.orderIndex - b.orderIndex);
  const blueBans = sideDraftItems("blue", "ban");
  const redBans = sideDraftItems("red", "ban");
  const bluePicks = sideDraftItems("blue", "pick");
  const redPicks = sideDraftItems("red", "pick");
  const playerByPosition = (teamId: string, position: Player["position"]) =>
    players.find((player) => player.teamId === teamId && player.position === position);
  const positions: Player["position"][] = ["TOP", "JGL", "MID", "BOT", "SUP"];
  const blueLineup = positions.map((position) => ({
    position,
    player: playerByPosition(set.blueTeamId, position),
  }));
  const redLineup = positions.map((position) => ({
    position,
    player: playerByPosition(set.redTeamId, position),
  }));
  const relatedRatings = fanRatings.filter((rating) => rating.setId === set.id);
  const playerRows = playerStatLines.map((line) => {
    const player = players.find((item) => item.id === line.playerId);
    return {
      line,
      player,
      stats: calculatePlayerStats(line),
      rating: relatedRatings.find((rating) => rating.playerId === line.playerId),
    };
  });
  const blueWon = set.winnerTeamId === set.blueTeamId;
  const redWon = set.winnerTeamId === set.redTeamId;
  const finalGoldDiff =
    set.blueGold !== null && set.redGold !== null ? Math.abs(set.blueGold - set.redGold) : null;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="세트 상세" title={`${match.name} · ${set.setNumber}세트`} />

      <section className="flex flex-col gap-4" aria-labelledby="set-summary">
        <h2 id="set-summary" className="text-xl font-semibold">
          세트 종합 결과
        </h2>
        <div className="overflow-hidden rounded-md border border-border bg-surface">
          <div className="grid gap-3 border-b border-border bg-surface-muted p-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="flex items-center justify-between gap-3">
              <strong className="text-2xl">{teamLabel(teams, set.blueTeamId)}</strong>
              <span className="text-2xl font-semibold">{blueWon ? "WIN" : "LOSS"}</span>
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-muted">GAME TIME</p>
              <p className="text-3xl font-semibold">{durationLabel(set.durationSeconds)}</p>
              <p className="text-xs text-muted">{match.name} · GAME {set.setNumber}</p>
            </div>
            <div className="flex items-center justify-between gap-3 md:flex-row-reverse">
              <strong className="text-2xl">{teamLabel(teams, set.redTeamId)}</strong>
              <span className="text-2xl font-semibold">{redWon ? "WIN" : "LOSS"}</span>
            </div>
          </div>

          <div className="grid gap-6 p-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-md border border-border bg-background">
              {[
                ["KILLS", `${set.blueKills ?? "-"}`, `${set.redKills ?? "-"}`],
                ["GOLD", goldLabel(set.blueGold), goldLabel(set.redGold)],
                ["TOWERS", `${set.blueTowers ?? "-"}`, `${set.redTowers ?? "-"}`],
                ["DRAKES", `${set.blueDragons ?? "-"}`, `${set.redDragons ?? "-"}`],
                ["BARONS", `${set.blueBarons ?? "-"}`, `${set.redBarons ?? "-"}`],
              ].map(([label, left, right]) => (
                <div
                  key={label}
                  className="grid grid-cols-[1fr_7rem_1fr] items-center border-b border-border px-4 py-3 last:border-b-0"
                >
                  <strong className="text-right text-lg">{left}</strong>
                  <span className="text-center text-xs font-semibold text-muted">{label}</span>
                  <strong className="text-lg">{right}</strong>
                </div>
              ))}
            </div>

            <div className="rounded-md border border-border bg-background p-4">
              <h3 className="text-base font-semibold">골드 흐름</h3>
              <div className="mt-4 grid min-h-40 place-items-center rounded-md border border-dashed border-border bg-surface p-4 text-center">
                <div>
                  <p className="text-2xl font-semibold">
                    {finalGoldDiff ? `${goldLabel(finalGoldDiff)} 차이` : "골드 타임라인 데이터 준비 중"}
                  </p>
                  <p className="mt-2 text-sm text-muted">
                    Riot match timeline이 연결되기 전까지는 최종 골드 차이만 표시합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="pick-ban">
        <h2 id="pick-ban" className="text-xl font-semibold">
          밴픽
        </h2>
        <div className="grid gap-3 rounded-md border border-border bg-surface p-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold">
                <span>{teamLabel(teams, set.blueTeamId)} 밴</span>
                <span className="text-muted">BLUE</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {fiveSlots(blueBans).map((draft, index) => (
                  <DraftChampionTile
                    key={draft?.id ?? `blue-ban-${index}`}
                    draft={draft}
                    championName={draft ? championName(draft.championId) : "-"}
                    muted
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3 text-sm font-semibold">
                <span className="text-muted">RED</span>
                <span>{teamLabel(teams, set.redTeamId)} 밴</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {fiveSlots(redBans).map((draft, index) => (
                  <DraftChampionTile
                    key={draft?.id ?? `red-ban-${index}`}
                    draft={draft}
                    championName={draft ? championName(draft.championId) : "-"}
                    align="right"
                    muted
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_16rem_1fr]">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-5 lg:grid-cols-5">
              {fiveSlots(bluePicks).map((draft, index) => (
                <DraftChampionTile
                  key={draft?.id ?? `blue-pick-${index}`}
                  draft={draft}
                  championName={draft ? championName(draft.championId) : "-"}
                  player={blueLineup[index]?.player}
                />
              ))}
            </div>
            <div className="flex min-h-36 flex-col items-center justify-center rounded-md border border-border bg-background p-4 text-center">
              <p className="text-xs font-semibold text-muted">MATCH</p>
              <p className="mt-2 text-lg font-semibold">{match.name}</p>
              <div className="mt-4 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
                <strong>{teamLabel(teams, set.blueTeamId)}</strong>
                <span className="text-sm text-muted">vs</span>
                <strong>{teamLabel(teams, set.redTeamId)}</strong>
              </div>
              <p className="mt-4 text-3xl font-semibold">{set.setNumber}</p>
              <p className="mt-1 text-xs text-muted">PATCH {set.patch ?? "-"}</p>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-5 lg:grid-cols-5">
              {fiveSlots(redPicks).map((draft, index) => (
                <DraftChampionTile
                  key={draft?.id ?? `red-pick-${index}`}
                  draft={draft}
                  championName={draft ? championName(draft.championId) : "-"}
                  player={redLineup[index]?.player}
                  align="right"
                />
              ))}
            </div>
          </div>
        </div>

        <DataTable
          rows={picksBans}
          columns={[
            { key: "phase", label: "단계", render: (row) => row.phase },
            { key: "order", label: "순서", render: (row) => row.orderIndex },
            { key: "side", label: "진영", render: (row) => (row.side === "blue" ? "블루" : "레드") },
            { key: "team", label: "팀", render: (row) => teamLabel(teams, row.teamId) },
            { key: "action", label: "구분", render: (row) => (row.actionType === "pick" ? "픽" : "밴") },
            { key: "champion", label: "챔피언", render: (row) => championName(row.championId) },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="player-stats">
        <h2 id="player-stats" className="text-xl font-semibold">
          선수 스탯
        </h2>
        <DataTable
          rows={playerRows}
          columns={[
            { key: "player", label: "선수", render: (row) => row.player?.name ?? "-" },
            { key: "team", label: "팀", render: (row) => teamLabel(teams, row.line.teamId) },
            { key: "position", label: "포지션", render: (row) => row.line.position },
            { key: "kda", label: "KDA", render: (row) => row.stats.kda },
            { key: "kp", label: "KP%", render: (row) => `${row.stats.kp}%` },
            { key: "dpm", label: "DPM", render: (row) => row.stats.dpm },
            { key: "csm", label: "CSM", render: (row) => row.stats.csm },
            { key: "gpm", label: "GPM", render: (row) => row.stats.gpm },
            { key: "rating", label: "팬 평점", render: (row) => row.rating?.rating.toFixed(1) ?? "-" },
          ]}
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="set-reviews">
        <h2 id="set-reviews" className="text-xl font-semibold">
          세트 평점 / 리뷰
        </h2>
        <DataTable
          rows={relatedRatings}
          columns={[
            { key: "player", label: "선수", render: (row) => playerLabel(players, row.playerId) },
            { key: "rating", label: "평점", render: (row) => row.rating.toFixed(1) },
            { key: "review", label: "리뷰", render: (row) => row.review },
          ]}
        />
      </section>

      <section className="flex flex-wrap gap-2" aria-label="이동">
        <Link
          href={`/matches/${match.id}`}
          className="rounded-md border border-border bg-surface px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
        >
          매치 상세
        </Link>
      </section>
    </main>
  );
}
