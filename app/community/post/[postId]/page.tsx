import Link from "next/link";
import { notFound } from "next/navigation";

import { PostView } from "@/components/community/post-view";
import {
  getCommentReactionStates,
  getPostReactionState,
} from "@/lib/community/actions";
import { boardLabel } from "@/lib/community/boards";
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
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <Link
        href={`/community`}
        className="text-sm font-semibold text-accent hover:underline"
      >
        ← 커뮤니티 · {boardLabel("hub", post.boardType)}
      </Link>
      <PostView
        post={post}
        comments={comments}
        reaction={reaction}
        commentReactions={commentReactions}
        scope="hub"
      />
    </main>
  );
}
