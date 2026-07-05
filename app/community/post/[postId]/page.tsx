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

export default async function HubPostDetailPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  const post = await getPostByIdAndIncrementView(postId);
  if (!post || post.siteScope !== "hub") notFound();

  const comments = await getPostComments(postId);
  const [reaction, commentReactions] = await Promise.all([
    getPostReactionState(postId),
    getCommentReactionStates(comments.map((c) => c.id)),
  ]);

  return (
    <main className="subpage min-h-screen !bg-[var(--ui-surface)]">
      <div className="px-10 py-9 max-md:px-5">
        <PostView
          post={post}
          comments={comments}
          reaction={reaction}
          commentReactions={commentReactions}
          scope="hub"
        />
      </div>
    </main>
  );
}
