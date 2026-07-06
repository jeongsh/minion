"use client";

import { useMemo, useState } from "react";
import { championLabel } from "@/lib/champions";
import { DEFAULT_DDRAGON_VERSION, ddragonVersionFromPatch } from "@/lib/ddragon";
import { PlayerLoadout } from "@/components/domain/player-loadout";
import { PlayerItemSlots } from "@/app/matches/[matchId]/player-item-slots";
import type { RuneCatalog } from "@/lib/runes";
import type { GameSpell } from "@/lib/spells";
import type { FanRating, Match, Player, PlayerStatLine, SetResult, Team } from "@/lib/types";
import { teamLabel } from "@/lib/view-data";

type ChampionLike = {
  id: string;
  slug: string;
  name: string;
  imageUrl?: string;
  ddragonId?: string;
};

type EnrichedLine = PlayerStatLine & {
  match: Match;
  set: SetResult;
  stats: {
    kda: number;
    dpm: number;
    csm: number;
  };
};

export type RecentMatchRow = {
  match: Match;
  lines: EnrichedLine[];
  ratings: FanRating[];
  fanPog: boolean;
  officialPomName: string;
};

function compactDate(value: string | null | undefined) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function dateKeyKST(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const data = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${data.year}-${data.month}-${data.day}`;
}

function matchScore(match: Match) {
  if (match.teamAScore == null || match.teamBScore == null) return match.status;
  return `${match.teamAScore}:${match.teamBScore}`;
}

function matchResultForPlayer(match: Match, teamId: string) {
  if (!match.winnerTeamId) return match.status;
  return match.winnerTeamId === teamId ? `승리 ${matchScore(match)}` : `패배 ${matchScore(match)}`;
}

function opponentId(match: Match, teamId: string) {
  return match.teamAId === teamId ? match.teamBId : match.teamAId;
}

export function RecentMatchSetRows({
  player,
  teams,
  match,
  lines,
  champions,
  ratings,
  fanPog,
  officialPomName,
  spellsByVersion,
  runeCatalogByVersion,
}: {
  player: Player;
  teams: Team[];
  match: Match;
  lines: EnrichedLine[];
  champions: ChampionLike[];
  ratings: FanRating[];
  fanPog: boolean;
  officialPomName: string;
  spellsByVersion: Record<string, GameSpell[]>;
  runeCatalogByVersion: Record<string, RuneCatalog>;
}) {
  const opponent = teamLabel(teams, opponentId(match, player.teamId));
  const maxDamage = Math.max(...lines.map((line) => line.damageToChampions), 1);

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
      <div className="grid gap-3 border-b border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-4 py-3 text-sm text-[var(--ui-ink)] md:grid-cols-[1fr_auto_auto_auto] md:items-center">
        <div>
          <p className="font-semibold">{compactDate(match.matchDate)} · vs {opponent}</p>
          <p className="mt-1 text-xs text-[var(--ui-muted)]">{match.name}</p>
        </div>
        <div><span className="text-[var(--ui-muted)]">매치 결과 </span><strong>{matchResultForPlayer(match, player.teamId)}</strong></div>
        <div><span className="text-[var(--ui-muted)]">팬 POG </span><strong>{fanPog ? "선정" : "-"}</strong></div>
        <div><span className="text-[var(--ui-muted)]">공식 POM </span><strong>{officialPomName}</strong></div>
      </div>

      <div className="divide-y divide-[var(--ui-border)] overflow-x-auto text-[var(--ui-ink)]">
        {lines.length === 0 ? (
          <div className="px-4 py-4 text-sm text-[var(--ui-muted)]">이 매치에 연결된 선수 세트 기록이 없습니다.</div>
        ) : (
          lines.map((line) => {
            const champion = champions.find((item) => item.id === line.championId);
            const rating = ratings.find((item) => item.setId === line.setId);
            const itemVersion = ddragonVersionFromPatch(line.set.patch);
            const spells = spellsByVersion[itemVersion] ?? spellsByVersion[DEFAULT_DDRAGON_VERSION] ?? [];
            const runeCatalog = runeCatalogByVersion[itemVersion] ?? runeCatalogByVersion[DEFAULT_DDRAGON_VERSION] ?? {
              keystones: [],
              trees: [],
            };
            const damageWidth = Math.max(4, (line.damageToChampions / maxDamage) * 100);
            return (
              <div
                key={line.setId}
                className="grid min-w-[72rem] grid-cols-[14rem_7.25rem_minmax(5.5rem,0.7fr)_3.5rem_4rem_5rem_13rem_4rem] items-center gap-3 px-3 py-2.5 text-sm"
              >
                <div>
                  <PlayerLoadout
                    champion={champion}
                    spellIds={line.spellIds}
                    runeIds={line.runeIds}
                    spells={spells}
                    version={itemVersion}
                    runeCatalog={runeCatalog}
                    primaryLabel={champion ? championLabel(champion) : "-"}
                    badge={`${line.set.setNumber}세트`}
                    size="sm"
                  />
                </div>
                <div className="text-center">
                  <p className="font-semibold tabular-nums">{line.kills} / {line.deaths} / {line.assists}</p>
                  <p className="text-xs text-[var(--ui-muted)]">{line.stats.kda.toFixed(2)}</p>
                </div>
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold tabular-nums">{line.damageToChampions.toLocaleString("ko-KR")}</span>
                    <span className="text-xs text-[var(--ui-muted)] tabular-nums">DPM {line.stats.dpm}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${damageWidth}%` }} />
                  </div>
                </div>
                <div className="text-center font-semibold tabular-nums">{line.visionScore}</div>
                <div className="text-center">
                  <p className="font-semibold tabular-nums">{line.cs}</p>
                  <p className="text-xs text-[var(--ui-muted)]">{line.stats.csm}</p>
                </div>
                <div className="text-center font-semibold tabular-nums">
                  {line.gold.toLocaleString("ko-KR")}
                </div>
                <PlayerItemSlots
                  itemIds={line.itemIds}
                  roleBoundItem={line.roleBoundItem}
                  version={itemVersion}
                  slotClassName="h-8 w-8"
                  separatorClassName="h-5 w-px"
                  imageSizes="32px"
                />
                <div className="text-right text-xs text-[var(--ui-muted)]">평점 {rating ? rating.rating.toFixed(1) : "-"}</div>
              </div>
            );
          })
        )}
      </div>
    </article>
  );
}

export function RecentMatchHistoryModal({
  player,
  teams,
  rows,
  champions,
  spellsByVersion,
  runeCatalogByVersion,
}: {
  player: Player;
  teams: Team[];
  rows: RecentMatchRow[];
  champions: ChampionLike[];
  spellsByVersion: Record<string, GameSpell[]>;
  runeCatalogByVersion: Record<string, RuneCatalog>;
}) {
  const [open, setOpen] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(0);
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const key = dateKeyKST(row.match.matchDate);
        return (!startDate || key >= startDate) && (!endDate || key <= endDate);
      }),
    [endDate, rows, startDate],
  );
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / 3));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleRows = filteredRows.slice(currentPage * 3, currentPage * 3 + 3);

  function updateRange(nextStart: string, nextEnd: string) {
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setPage(0);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-[var(--ui-ink)] px-4 py-2 text-sm font-semibold text-[var(--ui-surface)] transition-opacity hover:opacity-90"
      >
        전체 기록 보기
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/60 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="최근 경기 기록"
            className="mx-auto flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] text-[var(--ui-ink)] shadow-2xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ui-border)] px-5 py-4">
              <div>
                <h2 className="home-section-title text-2xl text-[var(--ui-ink)]">최근 경기 기록</h2>
                <p className="mt-1 text-sm text-[var(--ui-muted)]">3매치씩 확인하고 기간으로 좁혀볼 수 있습니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm font-semibold hover:bg-[var(--ui-surface-muted)]"
              >
                닫기
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--ui-border)] px-5 py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <span className="font-semibold">시작</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => updateRange(event.target.value, endDate)}
                    className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="font-semibold">종료</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => updateRange(startDate, event.target.value)}
                    className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => updateRange("", "")}
                className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 text-sm font-semibold hover:bg-[var(--ui-surface-muted)]"
              >
                전체 기간
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {visibleRows.length === 0 ? (
                <div className="rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-6 text-sm text-[var(--ui-muted)]">
                  선택한 기간의 경기 기록이 없습니다.
                </div>
              ) : (
                <div className="grid gap-4">
                  {visibleRows.map((row) => (
                    <RecentMatchSetRows
                      key={row.match.id}
                      player={player}
                      teams={teams}
                      match={row.match}
                      lines={row.lines}
                      champions={champions}
                      ratings={row.ratings}
                      fanPog={row.fanPog}
                      officialPomName={row.officialPomName}
                      spellsByVersion={spellsByVersion}
                      runeCatalogByVersion={runeCatalogByVersion}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--ui-border)] px-5 py-4 text-sm">
              <span className="text-[var(--ui-muted)]">{filteredRows.length}매치 · {currentPage + 1} / {pageCount}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage === 0}
                  onClick={() => setPage((value) => Math.max(value - 1, 0))}
                  className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 font-semibold hover:bg-[var(--ui-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  이전
                </button>
                <button
                  type="button"
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => setPage((value) => Math.min(value + 1, pageCount - 1))}
                  className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2 font-semibold hover:bg-[var(--ui-surface-muted)] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
