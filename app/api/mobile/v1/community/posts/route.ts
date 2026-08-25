import type { MobileCommunityPostMutationDto, MobileCommunityPostsDto } from "@/packages/contracts/src/mobile-v1";
import { categoriesForScope, type BoardScope } from "@/lib/community/boards";
import { extractPlainText } from "@/lib/community/extract-thumbnail";
import { guestRateLimitError, isCommunityGuestSanctioned } from "@/lib/data/community-guests";
import { isCommunityUserSanctioned } from "@/lib/data/community-users";
import { createPost, getBoardPostPage } from "@/lib/data/community";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import {
  getMobileCommunityActor,
  getMobileBlockedCommunityAuthors,
  isMobileCommunityAuthorBlocked,
  scheduleMobileCommunityModeration,
  toMobileCommunityPost,
  validateMobilePostInput,
} from "@/lib/mobile/community";
import { recordLpEvent } from "@/lib/rank/record-lp";

export const dynamic = "force-dynamic";

async function scopeContext(url: URL) {
  const teamSlug = url.searchParams.get("team")?.trim() || null;
  if (!teamSlug) return { scope: "hub" as const, teamId: null, teamSlug: null };
  const team = await getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug));
  return team ? { scope: "team" as const, teamId: team.id, teamSlug } : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const context = await scopeContext(url);
  if (!context) return mobileError("NOT_FOUND", "팀을 찾을 수 없습니다.", 404);
  const page = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const category = url.searchParams.get("cat")?.trim() || null;
  const search = url.searchParams.get("q")?.trim() || null;
  const hotOnly = url.searchParams.get("view") === "hot";

  try {
    const actor = await getMobileCommunityActor(request);
    const [result, blocked] = await Promise.all([
      getBoardPostPage({
        boardType: category,
        hotOnly,
        page,
        scope: context.scope,
        search,
        teamId: context.teamId,
      }),
      getMobileBlockedCommunityAuthors(actor.auth?.user.id),
    ]);
    const visible = (posts: typeof result.posts) => posts.filter((post) => !isMobileCommunityAuthorBlocked(post, blocked));
    const data: MobileCommunityPostsDto = {
      categories: categoriesForScope(context.scope).map(({ label, slug }) => ({ label, slug })),
      items: visible(result.posts).map(toMobileCommunityPost),
      notices: visible(result.notices).map(toMobileCommunityPost),
      page: result.page,
      popular: visible(result.popularPosts).map(toMobileCommunityPost),
      totalCount: result.totalCount,
      totalPages: result.totalPages,
    };
    return mobileSuccess(data, { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } });
  } catch {
    return mobileError("INTERNAL", "커뮤니티 글을 불러오지 못했습니다.", 500);
  }
}

export async function POST(request: Request) {
  const actor = await getMobileCommunityActor(request).catch(() => null);
  if (!actor) return mobileError("BAD_REQUEST", "비회원 ID를 확인하지 못했습니다.", 400);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const scope: BoardScope = body?.scope === "team" ? "team" : "hub";
  const boardType = typeof body?.boardType === "string" ? body.boardType : "";
  const validated = validateMobilePostInput({ boardType, content: body?.content, scope, title: body?.title });
  if (!validated.ok) return mobileError("BAD_REQUEST", validated.error, 400);

  if (actor.auth && await isCommunityUserSanctioned(actor.auth.user.id)) {
    return mobileError("FORBIDDEN", "커뮤니티 이용이 영구 제한된 계정입니다.", 403);
  }
  if (!actor.auth) {
    if (await isCommunityGuestSanctioned(actor.guest.key, actor.guest.ipKey)) {
      return mobileError("FORBIDDEN", "이 비회원 ID 또는 접속 환경은 커뮤니티 이용이 제한되었습니다.", 403);
    }
    const rateError = await guestRateLimitError(actor.guest.ipKey, "post");
    if (rateError) return mobileError("RATE_LIMITED", rateError, 429);
  }

  let teamId: string | null = null;
  if (scope === "team") {
    const teamSlug = typeof body?.teamSlug === "string" ? body.teamSlug : "";
    const team = await getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug));
    if (!team) return mobileError("NOT_FOUND", "팀을 찾을 수 없습니다.", 404);
    teamId = team.id;
  }

  try {
    const created = await createPost({
      authorId: actor.auth?.user.id ?? null,
      boardType,
      content: validated.content,
      guest: actor.auth ? undefined : actor.guest,
      scope,
      teamId,
      title: validated.title,
    });
    if (actor.auth) await recordLpEvent({ postId: created.id, reason: "post_created", userId: actor.auth.user.id });
    scheduleMobileCommunityModeration({
      postId: created.id,
      text: extractPlainText(validated.content, 1_000_000),
      title: validated.title,
    });
    const data: MobileCommunityPostMutationDto = { id: created.id, message: "글 발사 완료. 게시판에 착지했어요." };
    return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" }, status: 201 });
  } catch {
    return mobileError("INTERNAL", "게시글을 등록하지 못했습니다.", 500);
  }
}
