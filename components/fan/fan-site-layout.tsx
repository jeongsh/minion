import Link from "next/link";
import { notFound } from "next/navigation";
import { fanNavItems } from "@/lib/navigation";
import { getTeamByRouteKey } from "@/lib/team-themes";

type TeamStyle = React.CSSProperties & {
  "--team-primary": string;
  "--team-secondary": string;
};

export function FanSiteLayout({
  teamSlug,
  children,
}: {
  teamSlug: string;
  children: React.ReactNode;
}) {
  const team = getTeamByRouteKey(teamSlug);

  if (!team) {
    notFound();
  }

  const style: TeamStyle = {
    "--team-primary": team.primaryColor,
    "--team-secondary": team.secondaryColor,
  };

  return (
    <div className="team-surface border-b border-border" style={style}>
      <div className="bg-[linear-gradient(120deg,var(--team-secondary),var(--team-primary))] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-[var(--page-inline)] py-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm opacity-80">팀별 팬 사이트</p>
              <h1 className="text-3xl font-semibold">{team.name}</h1>
            </div>
            <Link
              href={`/teams/${team.slug}`}
              className="w-fit rounded-md border border-white/30 px-3 py-2 text-sm font-semibold hover:bg-white/10"
            >
              LCK 허브 팀 상세
            </Link>
          </div>
          <nav aria-label={`${team.name} 팬 사이트 메뉴`} className="flex flex-wrap gap-2">
            {fanNavItems(team.fanSiteHost).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold hover:bg-white/10"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      {children}
    </div>
  );
}
