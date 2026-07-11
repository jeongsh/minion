import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { TeamLogo } from "@/components/ui/team-logo";
import { PlayerRosterCarousel } from "@/components/domain/player-roster-carousel";
import { getPlayers, getTeamsSortedByRank } from "@/lib/data/lck";
import type { Player, Team } from "@/lib/types";

const POSITION_ORDER = ["TOP", "JGL", "MID", "BOT", "SUP"] as const;

function pickStarters(players: Player[]): (Player | null)[] {
  const byPosition = new Map<string, Player[]>();
  for (const p of players) {
    const arr = byPosition.get(p.position) ?? [];
    arr.push(p);
    byPosition.set(p.position, arr);
  }
  return POSITION_ORDER.map((pos) => {
    const candidates = byPosition.get(pos) ?? [];
    // is_starter 우선, 없으면 이름 오름차순 첫 번째
    return candidates.find((p) => p.isStarter) ?? candidates[0] ?? null;
  });
}

// 주전 선수가 처음 5명 안에 들어오도록 정렬하고, 나머지 선수를 뒤이어 붙인다.
function orderRoster(players: Player[]): Player[] {
  const starters = pickStarters(players).filter((p): p is Player => p !== null);
  const starterIds = new Set(starters.map((p) => p.id));
  const rest = players
    .filter((p) => !starterIds.has(p.id))
    .sort((a, b) => {
      const pa = POSITION_ORDER.indexOf(a.position);
      const pb = POSITION_ORDER.indexOf(b.position);
      if (pa !== pb) return pa - pb;
      return a.name.localeCompare(b.name);
    });
  return [...starters, ...rest];
}

function TeamRosterSection({
  team,
  players,
}: {
  team: Team;
  players: Player[];
}) {
  const roster = orderRoster(players);
  if (roster.length === 0) return null;

  return (
    <section style={{ "--tp": team.primaryColor } as React.CSSProperties}>
      {/* 팀 헤더 */}
      <div className="mb-4 flex items-center gap-3">
        <TeamLogo team={team} size="h-12 w-12" />
        <div className="flex min-w-0 flex-col">
          <Link
            href={`/teams/${team.slug}`}
            className="home-section-title truncate text-[length:var(--ui-title-size)] text-[var(--ui-ink)]"
          >
            {team.name}
          </Link>
          <span className="text-[13px] font-semibold text-[var(--ui-muted)]">{team.shortName}</span>
        </div>
        <Link
          href={`/teams/${team.slug}`}
          className="ml-auto flex shrink-0 items-center text-sm font-bold text-[var(--ui-muted)] transition-colors hover:text-[var(--ui-ink)]"
        >
          팀 채널
          <ChevronRight size={16} />
        </Link>
      </div>

      <PlayerRosterCarousel players={roster} />
    </section>
  );
}

export default async function PlayersPage() {
  const [teams, players] = await Promise.all([getTeamsSortedByRank(), getPlayers()]);

  // teamId(UUID) → 선수 목록
  const playersByTeam = new Map<string, Player[]>();
  for (const player of players) {
    if (!player.teamId) continue;
    const arr = playersByTeam.get(player.teamId) ?? [];
    arr.push(player);
    playersByTeam.set(player.teamId, arr);
  }

  const teamsWithPlayers = teams.filter((t) => (playersByTeam.get(t.id) ?? []).length > 0);

  return (
    <main className="min-h-screen bg-[var(--ui-surface)] text-[var(--ui-text)]">
      <div className="mx-auto w-full max-w-[1400px] px-5 pb-16 pt-8 xl:px-10">
        <PageHeader
          eyebrow="PLAYERS"
          title="선수"
          action={
            <p className="rounded-full bg-[var(--ui-surface-muted)] px-3 py-1.5 text-[13px] font-bold text-[var(--ui-muted)]">
              {teamsWithPlayers.length} TEAMS
            </p>
          }
        />
        <div className="mt-10 flex flex-col gap-12">
          {teamsWithPlayers.map((team) => (
            <TeamRosterSection
              key={team.id}
              team={team}
              players={playersByTeam.get(team.id) ?? []}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
