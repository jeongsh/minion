import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PostView } from "@/components/community/post-view";
import { CommunityContentLayout } from "@/components/community/community-content-layout";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getExistingGuestKey } from "@/lib/community/guest-identity";
import {
  getCommentReactionStates,
  getPostReactionState,
} from "@/lib/community/actions";
import {
  getPostByIdAndIncrementView,
  getBoardPosts,
  getPostComments,
} from "@/lib/data/community";
import { getUserMiniconPacks } from "@/lib/data/minicons";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

// 사용자 생성 게시글이라 검색 색인 대상에서 제외한다.
export const metadata: Metadata = { title: "게시글", robots: { index: false } };

export default async function FanPostDetailPage({
  params,
}: {
  params: Promise<{ teamSlug: string; postId: string }>;
}) {
  const { teamSlug, postId } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  const [post, comments, user] = await Promise.all([
    getPostByIdAndIncrementView(postId),
    getPostComments(postId),
    getCurrentUser(),
  ]);
  if (!post || post.siteScope !== "team" || post.teamId !== team.id) notFound();

  const [reaction, commentReactions, posts, canSetNotice, currentGuestKey, miniconPacks] = await Promise.all([
    getPostReactionState(postId),
    getCommentReactionStates(comments.map((c) => c.id)),
    getBoardPosts({ scope: "team", teamId: team.id, hotOnly: true, limit: 30 }),
    isCurrentUserAdmin(),
    getExistingGuestKey(),
    getUserMiniconPacks(user?.id),
  ]);

  return (
    <main className="community-neutral fan-page-container flex flex-col gap-0 py-0 md:gap-5 md:py-9">
      <h1 className="sr-only">게시글</h1>
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
          viewerId={user?.id}
          currentGuestKey={currentGuestKey}
          miniconPacks={miniconPacks}
        />
      </CommunityContentLayout>
    </main>
  );
}
