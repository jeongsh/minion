import { notFound } from "next/navigation";

import { PostView } from "@/components/community/post-view";
import { CommunityContentLayout } from "@/components/community/community-content-layout";
import { PageHeader } from "@/components/ui/page-header";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getCommentReactionStates,
  getPostReactionState,
} from "@/lib/community/actions";
import {
  getPostByIdAndIncrementView,
  getBoardPosts,
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

  const [post, comments] = await Promise.all([
    getPostByIdAndIncrementView(postId),
    getPostComments(postId),
  ]);
  if (!post || post.siteScope !== "team" || post.teamId !== team.id) notFound();

  const [reaction, commentReactions, user, posts, canSetNotice] = await Promise.all([
    getPostReactionState(postId),
    getCommentReactionStates(comments.map((c) => c.id)),
    getCurrentUser(),
    getBoardPosts({ scope: "team", teamId: team.id }),
    isCurrentUserAdmin(),
  ]);

  return (
    <main className="community-neutral fan-page-container flex flex-col gap-5 py-7 md:py-9">
      <PageHeader
        title="게시글"
        breadcrumbs={[
          { label: "커뮤니티", href: `/fan/${teamSlug}/community` },
          { label: "게시글" },
        ]}
      />
      <CommunityContentLayout posts={posts} scope="team" teamSlug={teamSlug} currentPostId={post.id}>
        <PostView
          post={post}
          comments={comments}
          reaction={reaction}
          commentReactions={commentReactions}
          scope="team"
          teamSlug={teamSlug}
          canManage={post.authorId === user?.id}
          canSetNotice={canSetNotice}
        />
      </CommunityContentLayout>
    </main>
  );
}
