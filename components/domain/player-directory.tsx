"use client";

import { SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { AdaptiveDialog } from "@/components/responsive/adaptive-dialog";
import { TeamLogo } from "@/components/ui/team-logo";
import type { Player, Team } from "@/lib/types";

const POSITIONS = ["TOP", "JGL", "MID", "BOT", "SUP"] as const;

export function PlayerDirectory({ teams, players }: { teams: Team[]; players: Player[] }) {
  const [teamId, setTeamId] = useState("all");
  const [position, setPosition] = useState("all");
  const teamMap = useMemo(() => new Map(teams.map((team) => [team.id, team])), [teams]);
  const visible = useMemo(() => players.filter((player) => (teamId === "all" || player.teamId === teamId) && (position === "all" || player.position === position)), [players, position, teamId]);

  const filters = (
    <div className="space-y-5">
      <fieldset><legend className="mb-2 text-[12px] font-black uppercase tracking-[0.1em] text-[var(--ui-muted)]">포지션</legend><div className="grid grid-cols-3 gap-2 md:grid-cols-2">{["all", ...POSITIONS].map((item) => <button key={item} type="button" onClick={() => setPosition(item)} className={`min-h-10 rounded-xl px-2 text-[13px] font-black ${position === item ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "bg-[var(--ui-surface-muted)] text-[var(--ui-muted)]"}`}>{item === "all" ? "전체" : item}</button>)}</div></fieldset>
      <fieldset>
        <legend className="mb-2 text-[12px] font-black uppercase tracking-[0.1em] text-[var(--ui-muted)]">팀</legend>
        <div className="grid gap-1.5">
          <button type="button" onClick={() => setTeamId("all")} className={`flex min-h-11 items-center rounded-xl px-3 text-sm font-black ${teamId === "all" ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "bg-[var(--ui-surface-muted)] text-[var(--ui-muted)]"}`}>
            전체 팀
          </button>
          {teams.map((team) => (
            <button key={team.id} type="button" onClick={() => setTeamId(team.id)} className={`flex min-h-11 items-center gap-2 rounded-xl px-2.5 text-left text-sm font-bold ${teamId === team.id ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "hover:bg-[var(--ui-surface-muted)]"}`}>
              <TeamLogo team={team} size="h-7 w-7" plain themeAware />
              <span className="truncate">{team.shortName}</span>
            </button>
          ))}
        </div>
      </fieldset>
    </div>
  );

  return (
    <div className="mt-6 md:grid md:grid-cols-[180px_minmax(0,1fr)] md:items-start md:gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
      <div className="mb-4 flex items-center justify-between md:hidden"><p className="text-sm font-bold text-[var(--ui-muted)]">{visible.length}명</p><AdaptiveDialog title="선수 필터" trigger={<span className="flex items-center gap-2"><SlidersHorizontal size={18} />필터</span>} triggerClassName="flex min-h-11 items-center rounded-xl border border-[var(--ui-border)] px-3 text-sm font-black">{filters}</AdaptiveDialog></div>
      <aside className="sticky top-20 hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 md:block">{filters}</aside>
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-label="선수 목록">
        {visible.map((player) => {
          const team = player.teamId ? teamMap.get(player.teamId) : undefined;
          return <Link key={player.id} href={`/players/${player.slug}`} className="group min-w-0 overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]"><div className="relative aspect-[4/5] overflow-hidden bg-[var(--ui-surface-muted)]">{player.profileImageUrl ? <img src={player.profileImageUrl} alt={player.name} className="h-full w-full object-cover object-top transition-transform group-hover:scale-[1.03]" /> : <span className="grid h-full place-items-center text-lg font-black text-[var(--ui-muted)]">{player.name.slice(0, 2)}</span>}<span className="absolute left-2 top-2 rounded-lg bg-black/65 px-2 py-1 text-[11px] font-black text-white">{player.position}</span></div><div className="p-3"><p className="truncate text-[16px] font-black text-[var(--ui-ink)]">{player.name}</p><p className="mt-0.5 truncate text-[13px] font-semibold text-[var(--ui-muted)]">{team?.shortName ?? "FA"}{player.realName ? ` · ${player.realName}` : ""}</p></div></Link>;
        })}
        {!visible.length ? <p className="col-span-full rounded-2xl bg-[var(--ui-surface-muted)] px-5 py-16 text-center text-sm text-[var(--ui-muted)]">조건에 맞는 선수가 없습니다.</p> : null}
      </section>
    </div>
  );
}
