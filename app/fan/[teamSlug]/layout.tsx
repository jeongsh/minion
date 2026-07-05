import { FanSiteLayout } from "@/components/fan/fan-site-layout";
import { FanChannelHeader } from "@/components/fan/fan-channel-header";
import { fanSiteHosts } from "@/lib/team-themes";

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

  return (
    <FanSiteLayout teamSlug={teamSlug}>
      <FanChannelHeader teamSlug={teamSlug} />
      {children}
    </FanSiteLayout>
  );
}
