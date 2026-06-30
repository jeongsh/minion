import { notFound } from "next/navigation";

import { NewPostPage } from "@/components/community/new-post-page";
import { getTeamBoard } from "@/lib/community/boards";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

export default async function FanNewPostPage({
  params,
}: {
  params: Promise<{ teamSlug: string; board: string }>;
}) {
  const { teamSlug, board: boardSlug } = await params;
  const board = getTeamBoard(boardSlug);
  if (!board) notFound();

  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  return (
    <NewPostPage
      scope="team"
      boardSlug={board.slug}
      boardLabel={board.label}
      eyebrow={`${team.shortName} 커뮤니티`}
      teamId={team.id}
      teamSlug={teamSlug}
    />
  );
}
