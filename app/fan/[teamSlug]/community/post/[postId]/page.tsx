import Link from "next/link";
import { notFound } from "next/navigation";

import { PostView } from "@/components/community/post-view";
import { getHonorState } from "@/lib/community/actions";
import { boardLabel } from "@/lib/community/boards";
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

  const [comments, honored] = await Promise.all([
    getPostComments(postId),
    getHonorState(postId),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <Link
        href={`/fan/${teamSlug}/community`}
        className="text-sm font-semibold text-accent hover:underline"
      >
        ← 커뮤니티 · {boardLabel("team", post.boardType)}
      </Link>
      <PostView
        post={post}
        comments={comments}
        honored={honored}
        scope="team"
        teamSlug={teamSlug}
      />
    </main>
  );
}
