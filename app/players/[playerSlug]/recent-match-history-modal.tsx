"use client";

import { useMemo, useState } from "react";
import { championLabel } from "@/lib/champions";
import { DEFAULT_DDRAGON_VERSION, ddragonVersionFromPatch } from "@/lib/ddragon";
import { itemImageUrl } from "@/lib/items";
import { RunePair } from "@/components/domain/rune-pair";
import type { RuneCatalog } from "@/lib/runes";
import { spellImageUrlById, type GameSpell } from "@/lib/spells";
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

function championImageUrl(champion: ChampionLike | undefined) {
  if (!champion) return "";
  if (champion.imageUrl) return champion.imageUrl;
  const fallback = champion.ddragonId || champion.slug || champion.name;
  return `https://ddragon.leagueoflegends.com/cdn/img/champion/tiles/${fallback.replace(/[^A-Za-z0-9]/g, "")}_0.jpg`;
}

function GameIcon({ src, className }: { src: string; className: string }) {
  return (
    <span className={`relative shrink-0 overflow-hidden bg-surface-muted ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : null}
    </span>
  );
}

function ItemSlots({ line, version }: { line: EnrichedLine; version: string }) {
  const regularItems = line.itemIds.slice(0, 6).filter((id): id is number => Boolean(id && id > 0));
  const trinket = line.itemIds[6];
  const entries = [
    ...regularItems,
    ...Array<number | null>(Math.max(0, 6 - regularItems.length)).fill(null),
    trinket ?? null,
    line.roleBoundItem ?? null,
  ];

  return (
    <div className="flex items-center gap-1">
      {entries.map((id, index) => (
        <GameIcon
          key={`${id ?? "empty"}-${index}`}
          src={id ? itemImageUrl(id, version) : ""}
          className="h-8 w-8 rounded border border-border/60"
        />
      ))}
    </div>
  );
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

  return (
    <article className="overflow-hidden rounded-md border border-border bg-background/30">
      <div className="grid gap-3 border-b border-border bg-surface-muted px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto_auto] md:items-center">
        <div>
          <p className="font-semibold">{compactDate(match.matchDate)} · vs {opponent}</p>
          <p className="mt-1 text-xs text-muted">{match.name}</p>
        </div>
        <div><span className="text-muted">매치 결과 </span><strong>{matchResultForPlayer(match, player.teamId)}</strong></div>
        <div><span className="text-muted">팬 POG </span><strong>{fanPog ? "선정" : "-"}</strong></div>
        <div><span className="text-muted">공식 POM </span><strong>{officialPomName}</strong></div>
      </div>

      <div className="divide-y divide-border overflow-x-auto">
        {lines.length === 0 ? (
          <div className="px-4 py-4 text-sm text-muted">이 매치에 연결된 선수 세트 기록이 없습니다.</div>
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
            const spell0Url = spellImageUrlById(spells, line.spellIds[0], itemVersion);
            const spell1Url = spellImageUrlById(spells, line.spellIds[1], itemVersion);
            return (
              <div
                key={line.setId}
                className="grid min-w-[72rem] grid-cols-[12rem_6rem_8rem_4rem_5rem_6rem_minmax(18rem,1fr)_4rem] items-center gap-4 px-4 py-3 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded border border-border bg-surface-muted">
                    {champion ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={championImageUrl(champion)} alt="" className="h-full w-full object-cover" />
                    ) : null}
                    <span className="absolute bottom-0 left-0 rounded-tr bg-background/90 px-1 text-[10px] font-semibold">
                      {line.set.setNumber}세트
                    </span>
                  </div>
                  <div className="grid shrink-0 grid-cols-2 gap-1">
                    <GameIcon src={spell0Url} className="h-8 w-8 rounded-sm border border-border/60" />
                    <RunePair runeIds={line.runeIds} catalog={runeCatalog} />
                    <GameIcon src={spell1Url} className="h-8 w-8 rounded-sm border border-border/60" />
                  </div>
                  <p className="min-w-0 truncate font-semibold">{champion ? championLabel(champion) : "-"}</p>
                </div>
                <div className="text-center">
                  <p className="font-semibold tabular-nums">{line.kills} / {line.deaths} / {line.assists}</p>
                  <p className="text-xs text-muted">{line.stats.kda.toFixed(2)}</p>
                </div>
                <div>
                  <p className="font-semibold tabular-nums">{line.damageToChampions.toLocaleString("ko-KR")}</p>
                  <p className="text-xs text-muted">DPM {line.stats.dpm}</p>
                </div>
                <div className="text-center font-semibold tabular-nums">{line.visionScore}</div>
                <div className="text-center">
                  <p className="font-semibold tabular-nums">{line.cs}</p>
                  <p className="text-xs text-muted">{line.stats.csm}</p>
                </div>
                <div className="text-center font-semibold tabular-nums">
                  {line.gold.toLocaleString("ko-KR")}
                </div>
                <ItemSlots line={line} version={itemVersion} />
                <div className="text-right text-xs text-muted">평점 {rating ? rating.rating.toFixed(1) : "-"}</div>
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
        className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface-muted"
      >
        전체 기록 보기
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 bg-black/60 p-4" role="presentation">
          <div
            role="dialog"
            aria-modal="true"
            aria-label="최근 경기 기록"
            className="mx-auto flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-2xl"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-semibold">최근 경기 기록</h2>
                <p className="mt-1 text-sm text-muted">3매치씩 확인하고 기간으로 좁혀볼 수 있습니다.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
              >
                닫기
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <label className="flex items-center gap-2">
                  <span className="font-semibold">시작</span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(event) => updateRange(event.target.value, endDate)}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="font-semibold">종료</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(event) => updateRange(startDate, event.target.value)}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => updateRange("", "")}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-surface-muted"
              >
                전체 기간
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {visibleRows.length === 0 ? (
                <div className="rounded-md border border-border bg-background/45 p-6 text-sm text-muted">
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

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-4 text-sm">
              <span className="text-muted">{filteredRows.length}매치 · {currentPage + 1} / {pageCount}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={currentPage === 0}
                  onClick={() => setPage((value) => Math.max(value - 1, 0))}
                  className="rounded-md border border-border bg-background px-3 py-2 font-semibold hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
                >
                  이전
                </button>
                <button
                  type="button"
                  disabled={currentPage >= pageCount - 1}
                  onClick={() => setPage((value) => Math.min(value + 1, pageCount - 1))}
                  className="rounded-md border border-border bg-background px-3 py-2 font-semibold hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40"
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
