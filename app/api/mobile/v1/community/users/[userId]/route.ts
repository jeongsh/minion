import type { MobileCommunityUserDto } from "@/packages/contracts/src/mobile-v1";
import {
  getCommentsByAuthorCount,
  getCommentsByAuthorPage,
  getPostsByAuthorCount,
  getPostsByAuthorPage,
} from "@/lib/data/community";
import { getCommunityUserSummary } from "@/lib/data/community-users";
import { getTeamById } from "@/lib/data/lck";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import {
  getMobileBlockedCommunityAuthors,
  isMobileCommunityAuthorBlocked,
  toMobileCommunityPost,
} from "@/lib/mobile/community";
import { getMobileAuth } from "@/lib/mobile/auth";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ userId: string }> };

export async function GET(request: Request, context: Context) {
  const { userId } = await context.params;
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") === "comments" ? "comments" : "posts";
  const requestedPage = Math.min(10_000, Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1));
  const auth = await getMobileAuth(request);

  try {
    const blocked = await getMobileBlockedCommunityAuthors(auth?.user.id);
    if (isMobileCommunityAuthorBlocked({ authorId: userId }, blocked)) {
      return mobileError("NOT_FOUND", "사용자를 찾을 수 없습니다.", 404);
    }
    const [profile, postsPage, commentsPage] = tab === "posts"
      ? await Promise.all([
          getCommunityUserSummary(userId),
          getPostsByAuthorPage(userId, requestedPage),
          getCommentsByAuthorCount(userId).then((totalCount) => ({ items: [], page: 1, totalCount, totalPages: 1 })),
        ])
      : await Promise.all([
          getCommunityUserSummary(userId),
          getPostsByAuthorCount(userId).then((totalCount) => ({ items: [], page: 1, totalCount, totalPages: 1 })),
          getCommentsByAuthorPage(userId, requestedPage),
        ]);
    if (!profile) return mobileError("NOT_FOUND", "사용자를 찾을 수 없습니다.", 404);

    const teamIds = [...new Set([
      ...postsPage.items.flatMap((post) => post.teamId ? [post.teamId] : []),
      ...commentsPage.items.flatMap((comment) => comment.postTeamId ? [comment.postTeamId] : []),
    ])];
    const teams = new Map(
      (await Promise.all(teamIds.map((id) => getTeamById(id))))
        .filter((team) => Boolean(team))
        .map((team) => [team!.id, team!]),
    );
    const teamSlug = (teamId: string | null) => {
      const team = teamId ? teams.get(teamId) : null;
      return team ? team.fanSiteHost || team.slug : null;
    };
    const activePage = tab === "posts" ? postsPage : commentsPage;
    const isSelf = auth?.user.id === userId;
    const data: MobileCommunityUserDto = {
      commentCount: commentsPage.totalCount,
      comments: commentsPage.items.map((comment) => ({
        blindedSource: comment.blindedSource,
        content: comment.content,
        createdAt: comment.createdAt,
        id: comment.id,
        isBlinded: Boolean(comment.blindedAt),
        postId: comment.postId,
        postScope: comment.postSiteScope,
        postTeamSlug: teamSlug(comment.postTeamId),
        postTitle: comment.postTitle,
      })),
      page: activePage.page,
      permissions: { canBlock: Boolean(auth && !isSelf), canReport: Boolean(auth && !isSelf), isSelf },
      postCount: postsPage.totalCount,
      posts: postsPage.items.map((post) => ({ ...toMobileCommunityPost(post), teamSlug: teamSlug(post.teamId) })),
      profile: {
        createdAt: profile.createdAt,
        guestIpLabel: null,
        id: profile.id,
        nickname: profile.nickname,
        profileImage: profile.profileImageUrl ? { url: profile.profileImageUrl } : null,
        tier: profile.tier,
      },
      tab,
      totalPages: activePage.totalPages,
    };
    return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return mobileError("INTERNAL", "사용자 활동을 불러오지 못했습니다.", 500);
  }
}
