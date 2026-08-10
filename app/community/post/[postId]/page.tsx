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

export default async function HubPostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const [post, comments] = await Promise.all([
    getPostByIdAndIncrementView(postId),
    getPostComments(postId),
  ]);
  if (!post || post.siteScope !== "hub") notFound();

  const [reaction, commentReactions, user, posts, canSetNotice] = await Promise.all([
    getPostReactionState(postId),
    getCommentReactionStates(comments.map((c) => c.id)),
    getCurrentUser(),
    getBoardPosts({ scope: "hub" }),
    isCurrentUserAdmin(),
  ]);

  return (
    <main className="subpage min-h-screen">
      <div className="layout-wide flex flex-col gap-5 py-6 sm:py-8">
        <PageHeader
          title="게시글"
          breadcrumbs={[{ label: "커뮤니티", href: "/community" }, { label: "게시글" }]}
        />
        <CommunityContentLayout posts={posts} scope="hub" currentPostId={post.id}>
          <PostView
            post={post}
            comments={comments}
            reaction={reaction}
            commentReactions={commentReactions}
            scope="hub"
            canManage={post.authorId === user?.id}
            canSetNotice={canSetNotice}
          />
        </CommunityContentLayout>
      </div>
    </main>
  );
}
