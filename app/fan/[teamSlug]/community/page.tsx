import { notFound } from "next/navigation";

import { CommunityFeedPage } from "@/components/community/community-feed-page";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

export default async function FanCommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ page?: string; cat?: string; q?: string; view?: string }>;
}) {
  const [{ teamSlug }, query] = await Promise.all([params, searchParams]);
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  return (
    <CommunityFeedPage
      scope="team"
      eyebrow="COMMUNITY"
      title="커뮤니티"
      teamId={team.id}
      teamSlug={teamSlug}
      page={Number(query.page) || 1}
      category={query.cat}
      search={query.q}
      hotOnly={query.view === "hot"}
    />
  );
}
