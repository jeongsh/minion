"use client";

import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";
import { TeamLogo } from "@/components/ui/team-logo";
import type { Player, Team } from "@/lib/types";

const POSITIONS = ["TOP", "JGL", "MID", "BOT", "SUP"] as const;
const POS_ORDER = ["TOP", "JGL", "MID", "BOT", "SUP"];

function PlayerCard({ player, team }: { player: Player; team: Team | undefined }) {
  return (
    <Link
      href={`/players/${player.slug}`}
      className="group min-w-0 overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--ui-card-bg)]">
        {player.profileImageUrl ? (
          <img
            src={player.profileImageUrl}
            alt={player.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover object-top transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <span className="grid h-full place-items-center text-lg font-black text-[var(--ui-muted)]">
            {player.name.slice(0, 2)}
          </span>
        )}
        <span className="absolute left-2 top-2 rounded-lg bg-black/65 px-2 py-1 text-[11px] font-black text-white">
          {player.position}
        </span>
      </div>
      <div className="p-3">
        <p className="truncate text-[16px] font-black text-[var(--ui-ink)]">{player.name}</p>
        <p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--ui-muted)]">
          {team?.shortName ?? "FA"}
          {player.realName ? ` · ${player.realName}` : ""}
        </p>
      </div>
    </Link>
  );
}

export function PlayerDirectory({
  teams,
  players,
  challengersPlayers,
}: {
  teams: Team[];
  players: Player[];
  challengersPlayers: Player[];
}) {
  const [division, setDivision] = useState<"first" | "challengers">("first");
  const [teamId, setTeamId] = useState("all");
  const [position, setPosition] = useState("all");
  const sourcePlayers = division === "first" ? players : challengersPlayers;
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const visible = useMemo(() => sourcePlayers.filter((player) => (teamId === "all" || player.teamId === teamId) && (position === "all" || player.position === position)), [sourcePlayers, position, teamId]);

  const sortedVisible = useMemo(() => {
    const teamRank = new Map(teams.map((team, index) => [team.id, index]));
    return [...visible].sort((a, b) => {
      const rankA = a.teamId ? (teamRank.get(a.teamId) ?? teams.length) : teams.length;
      const rankB = b.teamId ? (teamRank.get(b.teamId) ?? teams.length) : teams.length;
      if (rankA !== rankB) return rankA - rankB;
      if (a.isStarter !== b.isStarter) return a.isStarter ? -1 : 1;
      if (a.position !== b.position) return POS_ORDER.indexOf(a.position) - POS_ORDER.indexOf(b.position);
      return a.name.localeCompare(b.name);
    });
  }, [visible, teams]);

  const filters = (
    <div className="space-y-5">
      <fieldset><legend className="mb-2 text-[12px] font-black uppercase tracking-[0.1em] text-[var(--ui-muted)]">포지션</legend><div className="grid grid-cols-3 gap-2 md:grid-cols-2">{["all", ...POSITIONS].map((item) => <button key={item} type="button" onClick={() => setPosition(item)} className={`min-h-10 rounded-xl px-2 text-[13px] font-black ${position === item ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "bg-[var(--ui-card-bg)] text-[var(--ui-muted)]"}`}>{item === "all" ? "전체" : item}</button>)}</div></fieldset>
      <fieldset>
        <legend className="mb-2 text-[12px] font-black uppercase tracking-[0.1em] text-[var(--ui-muted)]">팀</legend>
        <div className="grid gap-1.5">
          <button type="button" onClick={() => setTeamId("all")} className={`flex min-h-11 items-center rounded-xl px-3 text-sm font-black ${teamId === "all" ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "bg-[var(--ui-card-bg)] text-[var(--ui-muted)]"}`}>
            전체 팀
          </button>
          {teams.map((team) => (
            <button key={team.id} type="button" onClick={() => setTeamId(team.id)} className={`flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-left text-sm font-bold ${teamId === team.id ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "hover:bg-[var(--ui-card-hover)]"}`}>
              <TeamLogo team={team} size="h-7 w-7" plain themeAware />
              <span className="truncate">{team.shortName}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex shrink-0 rounded-xl bg-[var(--ui-card-bg)] p-1">
          <button
            type="button"
            onClick={() => setDivision("first")}
            className={`rounded-lg px-4 py-2 text-sm font-black transition-colors ${
              division === "first" ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "text-[var(--ui-muted)]"
            }`}
          >
            1군
          </button>
          <button
            type="button"
            onClick={() => setDivision("challengers")}
            className={`rounded-lg px-4 py-2 text-sm font-black transition-colors ${
              division === "challengers" ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "text-[var(--ui-muted)]"
            }`}
          >
            2군
          </button>
        </div>
        <p className="hidden text-sm font-bold text-[var(--ui-muted)] md:block">{visible.length}명</p>
      </div>
      <div className="md:grid md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <div className="mb-4 flex items-center justify-between md:hidden"><p className="text-sm font-bold text-[var(--ui-muted)]">{visible.length}명</p><AdaptiveDialog title="선수 필터" trigger={<span className="flex items-center gap-2"><SlidersHorizontal size={18} />필터</span>} triggerClassName="flex min-h-11 items-center rounded-xl border border-[var(--ui-border)] px-3 text-sm font-black">{filters}</AdaptiveDialog></div>
      <aside className="sticky top-20 hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 md:block">{filters}</aside>
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="선수 목록">
        {sortedVisible.map((player) => (
          <PlayerCard key={player.id} player={player} team={player.teamId ? teamMap.get(player.teamId) : undefined} />
        ))}
        {!visible.length ? (
          <KitschEmptyState
            character="marker"
            title="이 조합엔 선수가 숨어있어요"
            body="팀이나 포지션 필터를 살짝 바꿔보세요."
            animated
            className="col-span-full"
          />
        ) : null}
      </section>
      </div>
    </div>
  );
}
