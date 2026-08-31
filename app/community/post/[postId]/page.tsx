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

export default async function HubPostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const [post, comments, user] = await Promise.all([
    getPostByIdAndIncrementView(postId),
    getPostComments(postId),
    getCurrentUser(),
  ]);
  if (!post || post.siteScope !== "hub") notFound();

  const [reaction, commentReactions, posts, canSetNotice, currentGuestKey, miniconPacks] = await Promise.all([
    getPostReactionState(postId),
    getCommentReactionStates(comments.map((c) => c.id)),
    getBoardPosts({ scope: "hub", hotOnly: true, limit: 30 }),
    isCurrentUserAdmin(),
    getExistingGuestKey(),
    getUserMiniconPacks(user?.id),
  ]);

  return (
    <main className="subpage min-h-screen">
      <div className="layout-wide flex flex-col gap-0 py-0 sm:gap-5 sm:py-8">
        <h1 className="sr-only">게시글</h1>
        <CommunityContentLayout posts={posts} scope="hub" currentPostId={post.id}>
          <PostView
            post={post}
            comments={comments}
            reaction={reaction}
            commentReactions={commentReactions}
            scope="hub"
            canManage={post.authorId === user?.id}
            canSetNotice={canSetNotice}
            viewerId={user?.id}
            currentGuestKey={currentGuestKey}
            miniconPacks={miniconPacks}
          />
        </CommunityContentLayout>
      </div>
    </main>
  );
}
