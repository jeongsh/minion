import { after } from "next/server";
import { getCurrentIpKey } from "@/lib/community/guest-identity";
import { hasAdPostContent } from "@/lib/ads-policy";
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
  getPostById,
  recordPostView,
  getBoardPosts,
  getPostComments,
} from "@/lib/data/community";
import { getUserMiniconPacks } from "@/lib/data/minicons";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

// 팬 반응이 확인된 팬톡 게시글(인기글 또는 좋아요+댓글 3개 이상)만 색인한다.
// 반응 없는 짧은 글과 블라인드·삭제 글은 저품질 페이지로 보지 않도록 noindex로 둔다.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ teamSlug: string; postId: string }>;
}): Promise<Metadata> {
  const { teamSlug, postId } = await params;
  const [team, post] = await Promise.all([
    getTeamByFanSiteHost(teamSlug).then((found) => found ?? getTeamBySlug(teamSlug)),
    getPostById(postId),
  ]);
  if (!team || !post || post.siteScope !== "team" || post.teamId !== team.id) return { title: "게시글", robots: { index: false } };
  if (post.blindedAt || post.deletedAt) return { title: "게시글", robots: { index: false } };
  const indexable = Boolean(post.hotAt) || post.likeCount + post.commentCount >= 3;
  const fanSlug = team.fanSiteHost || teamSlug;
  const description = (post.excerpt || `${team.name} 팬톡 게시글`).replace(/\s+/g, " ").trim().slice(0, 150);
  return {
    title: `${post.title} - 팬톡`,
    description,
    alternates: { canonical: `/fan/${fanSlug}/community/post/${post.id}` },
    robots: indexable ? undefined : { index: false, follow: true },
    openGraph: { title: post.title, description, type: "article", images: post.thumbnailUrl ? [post.thumbnailUrl] : ["/images/minion-og-20260829.png"] },
  };
}

export default async function FanPostDetailPage({
  params,
}: {
  params: Promise<{ teamSlug: string; postId: string }>;
}) {
  const { teamSlug, postId } = await params;
  const team = (await getTeamByFanSiteHost(teamSlug)) ?? (await getTeamBySlug(teamSlug));
  if (!team) notFound();

  const [post, comments, user] = await Promise.all([
    getPostById(postId),
    getPostComments(postId),
    getCurrentUser(),
  ]);
  if (!post || post.siteScope !== "team" || post.teamId !== team.id) notFound();

  const viewerIpKey = await getCurrentIpKey().catch(() => null);
  after(() => recordPostView(postId, viewerIpKey));

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
      <CommunityContentLayout adsEnabled={!post.blindedAt && !post.deletedAt && hasAdPostContent(post.content)} posts={posts} scope="team" teamSlug={teamSlug} currentPostId={post.id}>
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
