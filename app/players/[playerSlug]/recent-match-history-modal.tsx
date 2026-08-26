"use client";

import { ChevronDown, LoaderCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PlayerStatTable } from "@/components/domain/player-stat-table";
import { DialogSheetHeader } from "@/components/responsive/adaptive-dialog";
import { DEFAULT_DDRAGON_VERSION, ddragonVersionFromPatch } from "@/lib/ddragon";
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

function matchScore(match: Match, teamId: string) {
  if (match.teamAScore == null || match.teamBScore == null) return match.status;
  return match.teamAId === teamId
    ? `${match.teamAScore}:${match.teamBScore}`
    : `${match.teamBScore}:${match.teamAScore}`;
}

function matchResultForPlayer(match: Match, teamId: string) {
  if (!match.winnerTeamId) return match.status;
  return match.winnerTeamId === teamId ? `승리 ${matchScore(match, teamId)}` : `패배 ${matchScore(match, teamId)}`;
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
  variant = "card",
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
  variant?: "card" | "embedded";
}) {
  const playerTeamId = lines[0]?.teamId ?? player.teamId;
  const opponent = teamLabel(teams, opponentId(match, playerTeamId));
  const playerTeam = teamLabel(teams, playerTeamId);
  const tableRows = lines.map((line) => {
    const champion = champions.find((item) => item.id === line.championId);
    const rating = ratings.find((item) => item.setId === line.setId);
    const itemVersion = ddragonVersionFromPatch(line.set.patch);
    const spells = spellsByVersion[itemVersion] ?? spellsByVersion[DEFAULT_DDRAGON_VERSION] ?? [];
    const runeCatalog = runeCatalogByVersion[itemVersion] ?? runeCatalogByVersion[DEFAULT_DDRAGON_VERSION] ?? {
      keystones: [],
      trees: [],
    };

    return {
      id: line.setId,
      champion,
      primaryLabel: `${line.set.setNumber}세트`,
      secondaryLabel: (
        <>
          {champion?.name ?? "-"}
          <span className="hidden sm:inline"> · 평점 {rating ? rating.rating.toFixed(1) : "-"}</span>
        </>
      ),
      championLevel: line.championLevel,
      spellIds: line.spellIds,
      runeIds: line.runeIds,
      itemIds: line.itemIds,
      roleBoundItem: line.roleBoundItem,
      kills: line.kills,
      deaths: line.deaths,
      assists: line.assists,
      damage: line.damageToChampions,
      visionScore: line.visionScore,
      cs: line.cs,
      gold: line.gold,
      kda: line.stats.kda,
      dpm: line.stats.dpm,
      csm: line.stats.csm,
      version: itemVersion,
      spells,
      runeCatalog,
      accent: line.set.blueTeamId === line.teamId ? ("blue" as const) : ("red" as const),
    };
  });

  const matchHeader = variant === "embedded" ? null : (
    <div className="grid gap-3 border-b border-[var(--ui-border)] bg-[var(--ui-card-bg)] px-4 py-3 text-sm text-[var(--ui-ink)] [&>*:first-child]:block [&>*]:hidden min-[1024px]:grid-cols-[1fr_auto_auto_auto] min-[1024px]:items-center min-[1024px]:[&>*:first-child]:hidden min-[1024px]:[&>*]:block">
      <div className="font-black min-[1024px]:hidden">{playerTeam} vs {opponent}</div>
      <div className="hidden min-[1024px]:block">
        <p className="font-semibold">{compactDate(match.matchDate)} · vs {opponent}</p>
        <p className="mt-1 text-xs text-[var(--ui-muted)]">{match.name}</p>
      </div>
      <div><span className="text-[var(--ui-muted)]">매치 결과 </span><strong>{matchResultForPlayer(match, playerTeamId)}</strong></div>
      <div><span className="text-[var(--ui-muted)]">팬 POG </span><strong>{fanPog ? "선정" : "-"}</strong></div>
      <div><span className="text-[var(--ui-muted)]">공식 POM </span><strong>{officialPomName}</strong></div>
    </div>
  );

  return (
    <article className={variant === "embedded" ? "min-w-0 overflow-hidden rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)]" : "overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"}>
      {matchHeader}

      {tableRows.length === 0 ? (
        <div className={variant === "embedded" ? "py-4 text-sm text-[var(--ui-muted)]" : "px-4 py-4 text-sm text-[var(--ui-muted)]"}>이 매치에 연결된 선수 세트 기록이 없습니다.</div>
      ) : (
        <PlayerStatTable
          className={variant === "embedded" ? "" : "p-2"}
          framed={variant !== "embedded"}
          groups={[
            {
              id: match.id,
              label: variant === "embedded" ? compactDate(match.matchDate) : player.name,
              team: variant === "embedded" ? undefined : teams.find((team) => team.id === playerTeamId),
              won: variant === "embedded" ? false : match.winnerTeamId === playerTeamId,
              rows: tableRows,
            },
          ]}
        />
      )}
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
  const [visibleCount, setVisibleCount] = useState(3);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRows = rows.slice(0, visibleCount);
  const hasMore = visibleCount < rows.length;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !hasMore || loading) return;
    const root = scrollRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          observer.disconnect();
          setLoading(true);
          timerRef.current = setTimeout(() => {
            setVisibleCount((count) => Math.min(count + 3, rows.length));
            setLoading(false);
          }, 450);
        }
      },
      { root, rootMargin: "120px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, open, rows.length, visibleCount]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          setLoading(false);
          setVisibleCount(3);
          setOpen(true);
        }}
        className="rounded-full bg-[var(--ui-ink)] px-4 py-2 text-sm font-semibold text-[var(--ui-surface)] transition-opacity hover:opacity-90"
      >
        전체 기록 보기
      </button>

      {open && typeof document !== "undefined" ? createPortal(
        <div
          className="modal-backdrop fixed inset-0 z-[1000] flex items-end justify-center bg-black/45 [--modal-backdrop-dark-mobile:0.65] sm:items-center sm:p-6"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="최근 경기 기록"
            className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[24px] bg-[var(--ui-surface)] text-[var(--ui-ink)] shadow-2xl sm:max-w-7xl sm:rounded-[24px]"
          >
            <DialogSheetHeader onClose={() => setOpen(false)} title="최근 경기 기록" />

            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-5"
            >
              {visibleRows.length === 0 ? (
                <div className="rounded-xl bg-[var(--ui-card-bg)] p-5 text-sm text-[var(--ui-muted)]">
                  경기 기록이 없습니다.
                </div>
              ) : (
                <div className="grid gap-3 sm:gap-4">
                  {visibleRows.map((row) => (
                    <div key={row.match.id}>
                      <RecentMatchSetRows
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
                        variant="embedded"
                      />
                    </div>
                  ))}
                  {hasMore ? (
                    <div ref={sentinelRef} className="flex min-h-11 items-center justify-center gap-1.5 text-xs font-medium text-[var(--ui-muted)]" aria-live="polite">
                      {loading ? (
                        <><LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />불러오는 중</>
                      ) : (
                        <><ChevronDown aria-hidden="true" className="h-4 w-4" />아래로 스크롤해 더 보기</>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  );
}
