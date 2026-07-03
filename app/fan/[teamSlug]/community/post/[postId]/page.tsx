import { notFound } from "next/navigation";

import { PostView } from "@/components/community/post-view";
import {
  getCommentReactionStates,
  getPostReactionState,
} from "@/lib/community/actions";
import {
  getPostByIdAndIncrementView,
  getPostComments,
} from "@/lib/data/community";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

export default async function FanPostDetailPage({
  params,
}: {
  params: Promise<{ teamSlug: string; postId: string }>;
}) {
  const { teamSlug, postId } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  const post = await getPostByIdAndIncrementView(postId);
  if (!post || post.siteScope !== "team" || post.teamId !== team.id) notFound();

  const comments = await getPostComments(postId);
  const [reaction, commentReactions] = await Promise.all([
    getPostReactionState(postId),
    getCommentReactionStates(comments.map((c) => c.id)),
  ]);

  return (
    <main className="community-neutral fan-page-container py-7 md:py-9">
      <PostView
        post={post}
        comments={comments}
        reaction={reaction}
        commentReactions={commentReactions}
        scope="team"
        teamSlug={teamSlug}
      />
    </main>
  );
}
