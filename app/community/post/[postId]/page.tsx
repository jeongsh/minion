import { notFound } from "next/navigation";

import { PostView } from "@/components/community/post-view";
import { CommunityContentLayout } from "@/components/community/community-content-layout";
import { PageHeader } from "@/components/ui/page-header";
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
  const post = await getPostByIdAndIncrementView(postId);
  if (!post || post.siteScope !== "hub") notFound();

  const comments = await getPostComments(postId);
  const [reaction, commentReactions, user, posts] = await Promise.all([
    getPostReactionState(postId),
    getCommentReactionStates(comments.map((c) => c.id)),
    getCurrentUser(),
    getBoardPosts({ scope: "hub" }),
  ]);

  return (
    <main className="subpage min-h-screen !bg-[var(--ui-surface)]">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-10 py-8 max-md:px-5">
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
          />
        </CommunityContentLayout>
      </div>
    </main>
  );
}
