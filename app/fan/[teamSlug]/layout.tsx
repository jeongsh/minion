import { FanSiteLayout } from "@/components/fan/fan-site-layout";
import { FanChannelNavigation } from "@/components/fan/fan-channel-navigation";
import { fanSiteHosts, getTeamByRouteKey } from "@/lib/team-themes";

export function generateStaticParams() {
  return fanSiteHosts.map((teamSlug) => ({ teamSlug }));
}

export default async function FanTeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = getTeamByRouteKey(teamSlug);

  return (
    <FanSiteLayout teamSlug={teamSlug}>
      <FanChannelNavigation teamSlug={team?.fanSiteHost ?? teamSlug} />
      {children}
    </FanSiteLayout>
  );
}
