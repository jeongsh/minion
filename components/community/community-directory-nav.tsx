import Image from "next/image";

import { TeamLogo } from "@/components/ui/team-logo";
import { TeamDirectoryItem } from "@/components/ui/team-directory-item";
import type { BoardScope } from "@/lib/community/boards";
import type { Team } from "@/lib/types";

export function CommunityDirectoryNav({
  favoriteTeamId,
  followedTeamIds,
  scope,
  teamSlug,
  teams,
}: {
  favoriteTeamId: string | null;
  followedTeamIds: string[];
  scope: BoardScope;
  teamSlug?: string;
  teams: Team[];
}) {
  const orderedTeams = orderCommunityTeams(teams, favoriteTeamId, followedTeamIds);

  return (
    <nav
      aria-label="다른 커뮤니티로 이동"
      className="mobile-full-bleed flex min-w-0 overflow-hidden border-y border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 sm:mx-0 sm:w-full sm:rounded-[var(--ui-card-radius)] sm:border sm:px-4 sm:py-3"
    >
      <div className="-mr-3 flex min-w-0 flex-1 gap-1 overflow-x-auto pr-3 [scrollbar-width:none] sm:mr-0 sm:flex-wrap sm:overflow-visible sm:pr-0 [&::-webkit-scrollbar]:hidden">
        <TeamDirectoryItem
          href="/community"
          label="LCK"
          ariaLabel="LCK 커뮤니티로 이동"
          active={scope === "hub"}
          icon={
            <Image
              src="/logos/tournaments/lck.svg"
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 object-contain dark:invert"
            />
          }
        />

        {orderedTeams.map((team) => {
          const active =
            scope === "team" &&
            (team.fanSiteHost === teamSlug || team.slug === teamSlug);

          return (
            <TeamDirectoryItem
              key={team.id}
              href={`/fan/${team.fanSiteHost}/community`}
              label={team.shortName}
              ariaLabel={`${team.name} 팬 커뮤니티로 이동`}
              active={active}
              icon={<TeamLogo team={team} size="h-5 w-5" plain themeAware />}
            />
          );
        })}
      </div>
    </nav>
  );
}

function orderCommunityTeams(teams: Team[], favoriteTeamId: string | null, followedTeamIds: string[]) {
  const followedKeys = new Set(followedTeamIds);
  const matchesKey = (team: Team, key: string | null) =>
    Boolean(key && (team.id === key || team.slug === key || team.fanSiteHost === key));
  const favorite = teams.find((team) => matchesKey(team, favoriteTeamId));
  const followed = teams.filter(
    (team) =>
      team !== favorite &&
      (followedKeys.has(team.id) || followedKeys.has(team.slug) || followedKeys.has(team.fanSiteHost)),
  );
  const prioritized = new Set([...(favorite ? [favorite.id] : []), ...followed.map((team) => team.id)]);

  return [...(favorite ? [favorite] : []), ...followed, ...teams.filter((team) => !prioritized.has(team.id))];
}
