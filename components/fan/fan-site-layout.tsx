import { notFound } from "next/navigation";
import { FanSiteNavigation } from "@/components/fan/fan-site-navigation";
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
    <div className="team-surface min-h-screen bg-[#f6f7fb]" style={style}>
      <FanSiteNavigation team={team} />
      {children}
    </div>
  );
}
