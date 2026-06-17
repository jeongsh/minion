import Link from "next/link";
import { SectionHeader } from "@/components/layout/section-header";
import { getPlayers, getTeamsSortedByRank } from "@/lib/data/lck";
import type { Player, Team } from "@/lib/types";

const POSITION_ORDER = ["TOP", "JGL", "MID", "BOT", "SUP"] as const;

const POSITION_LABEL: Record<string, string> = {
  TOP: "탑",
  JGL: "정글",
  MID: "미드",
  BOT: "원딜",
  SUP: "서폿",
};

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

function PlayerPhoto({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className: string;
}) {
  if (!src) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-surface-muted text-sm font-semibold text-muted`}
        aria-label={alt}
      >
        {alt.slice(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} />
  );
}

function StarterCard({ player, position }: { player: Player | null; position: string }) {
  if (!player) {
    return (
      <div className="flex flex-col overflow-hidden rounded-md border border-dashed border-border bg-surface-muted opacity-40">
        <div className="flex aspect-[4/5] items-center justify-center bg-surface-muted">
          <span className="text-sm text-muted">미정</span>
        </div>
        <div className="p-3">
          <span className="text-xs font-semibold text-muted">{POSITION_LABEL[position]}</span>
        </div>
      </div>
    );
  }

  return (
    <Link
      href={`/players/${player.slug}`}
      className="group flex flex-col overflow-hidden rounded-md border border-border bg-surface transition-colors hover:border-accent hover:bg-surface-muted"
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-surface-muted">
        <PlayerPhoto
          src={player.profileImageUrl}
          alt={player.name}
          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <span className="absolute left-2 top-2 rounded-md bg-background/80 px-2 py-0.5 text-xs font-semibold text-accent backdrop-blur-sm">
          {POSITION_LABEL[position]}
        </span>
      </div>
      <div className="flex flex-col gap-0.5 p-3">
        <span className="truncate text-base font-bold leading-tight group-hover:text-accent">
          {player.name}
        </span>
        {player.realName && (
          <span className="truncate text-xs text-muted">{player.realName}</span>
        )}
      </div>
    </Link>
  );
}

function TeamRosterSection({
  team,
  players,
}: {
  team: Team;
  players: Player[];
}) {
  const starters = pickStarters(players);
  const hasAnyStarter = starters.some((p) => p !== null);
  if (!hasAnyStarter) return null;

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-surface">
      {/* 팀 헤더 */}
      <div
        className="flex items-center gap-3 px-5 py-4"
        style={{ borderLeft: `4px solid ${team.primaryColor}` }}
      >
        <div className="flex flex-col">
          <Link
            href={`/teams/${team.slug}`}
            className="text-lg font-bold hover:text-accent"
          >
            {team.name}
          </Link>
          <span className="text-xs text-muted">{team.shortName}</span>
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {POSITION_ORDER.map((pos, i) => (
            <StarterCard key={pos} player={starters[i] ?? null} position={pos} />
          ))}
        </div>
      </div>
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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow="선수" title="선수 목록" />
      <div className="flex flex-col gap-6">
        {teamsWithPlayers.map((team) => (
          <TeamRosterSection
            key={team.id}
            team={team}
            players={playersByTeam.get(team.id) ?? []}
          />
        ))}
      </div>
    </main>
  );
}
