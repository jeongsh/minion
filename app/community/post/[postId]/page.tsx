import Link from "next/link";
import { notFound } from "next/navigation";

import { PostView } from "@/components/community/post-view";
import { getHonorState } from "@/lib/community/actions";
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

  const [comments, honored] = await Promise.all([
    getPostComments(postId),
    getHonorState(postId),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <Link
        href={`/community`}
        className="text-sm font-semibold text-accent hover:underline"
      >
        ← 커뮤니티 · {boardLabel("hub", post.boardType)}
      </Link>
      <PostView post={post} comments={comments} honored={honored} scope="hub" />
    </main>
  );
}
