import { getTeamByRouteKey } from "@/lib/team-themes";

export function FanSiteHero({ teamSlug }: { teamSlug: string }) {
  const team = getTeamByRouteKey(teamSlug);

  if (!team) {
    return null;
  }

  return (
    <section className="rounded-md border border-border bg-surface p-5">
      <p className="text-sm font-semibold text-accent">{team.shortName} fan site</p>
      <h2 className="mt-2 text-2xl font-semibold">{team.name} 팬 허브</h2>
    </section>
  );
}
