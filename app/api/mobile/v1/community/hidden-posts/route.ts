import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileAuth } from "@/lib/mobile/auth";
import { getMobileBlockedCommunityAuthors, isMobileCommunityAuthorBlocked } from "@/lib/mobile/community";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_IDS = 50;
const UUID_PATTERN = /^[0-9a-f-]{36}$/i;

// 공개 캐시되는 홈 목록에서 로그인 사용자가 차단한 작성자의 글을 가리기 위한 ID 목록을 돌려준다.
export async function GET(request: Request) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const ids = [...new Set((new URL(request.url).searchParams.get("ids") ?? "").split(",").map((id) => id.trim()).filter((id) => UUID_PATTERN.test(id)))].slice(0, MAX_IDS);
  const headers = { "Cache-Control": "private, no-store" };
  if (ids.length === 0) return mobileSuccess({ postIds: [] as string[] }, { headers });
  const blocked = await getMobileBlockedCommunityAuthors(auth.user.id);
  if (blocked.users.size === 0 && blocked.guests.size === 0) return mobileSuccess({ postIds: [] as string[] }, { headers });
  const { data, error } = await createSupabaseAdminClient().from("community_posts").select("id, author_id, guest_key").in("id", ids);
  if (error) return mobileError("INTERNAL", "차단 목록을 확인하지 못했습니다.", 500);
  const postIds = (data ?? [])
    .filter((post) => isMobileCommunityAuthorBlocked({ authorId: post.author_id, guestKey: post.guest_key }, blocked))
    .map((post) => post.id as string);
  return mobileSuccess({ postIds }, { headers });
}
