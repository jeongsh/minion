import { notFound } from "next/navigation";

import { NewPostPage } from "@/components/community/new-post-page";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

export default async function FanNewPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ teamSlug: string }>;
  searchParams: Promise<{ cat?: string }>;
}) {
  const { teamSlug } = await params;
  const { cat } = await searchParams;

  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  return (
    <NewPostPage
      scope="team"
      eyebrow={`${team.shortName} 커뮤니티`}
      initialCategory={cat}
      teamId={team.id}
      teamSlug={teamSlug}
    />
  );
}
