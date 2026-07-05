import { notFound } from "next/navigation";

import { CommunityFeedPage } from "@/components/community/community-feed-page";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

export default async function FanCommunityPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  return (
    <CommunityFeedPage
      scope="team"
      eyebrow={`${team.shortName} Community`}
      title="커뮤니티"
      teamId={team.id}
      teamSlug={teamSlug}
    />
  );
}
