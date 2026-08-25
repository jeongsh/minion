import type { MobileCommunityPollDto } from "@/packages/contracts/src/mobile-v1";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileAuth } from "@/lib/mobile/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ pollId: string }> };

async function tally(pollId: string, userId?: string): Promise<MobileCommunityPollDto> {
  const { data, error } = await createSupabaseAdminClient().from("post_poll_votes").select("option_id, user_id").eq("poll_id", pollId);
  if (error) throw error;
  const counts: Record<string, number> = {};
  let myOptionId: string | null = null;
  for (const row of data ?? []) {
    counts[row.option_id] = (counts[row.option_id] ?? 0) + 1;
    if (userId && row.user_id === userId) myOptionId = row.option_id;
  }
  return { counts, myOptionId, signedIn: Boolean(userId), total: data?.length ?? 0 };
}

export async function GET(request: Request, context: Context) {
  const { pollId } = await context.params;
  if (!UUID.test(pollId)) return mobileError("BAD_REQUEST", "투표를 찾을 수 없습니다.", 400);
  const auth = await getMobileAuth(request);
  try {
    return mobileSuccess(await tally(pollId, auth?.user.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return mobileError("INTERNAL", "투표 결과를 불러오지 못했습니다.", 500);
  }
}

export async function POST(request: Request, context: Context) {
  const { pollId } = await context.params;
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const optionId = typeof body?.optionId === "string" ? body.optionId : "";
  if (!UUID.test(pollId) || !UUID.test(optionId)) return mobileError("BAD_REQUEST", "투표 선택지를 확인해 주세요.", 400);
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.from("post_poll_votes").select("option_id").eq("poll_id", pollId).eq("user_id", auth.user.id).maybeSingle();
  const result = existing?.option_id === optionId
    ? await supabase.from("post_poll_votes").delete().eq("poll_id", pollId).eq("user_id", auth.user.id)
    : await supabase.from("post_poll_votes").upsert({ option_id: optionId, poll_id: pollId, updated_at: new Date().toISOString(), user_id: auth.user.id }, { onConflict: "poll_id,user_id" });
  if (result.error) return mobileError("INTERNAL", "투표를 처리하지 못했습니다.", 500);
  return mobileSuccess(await tally(pollId, auth.user.id), { headers: { "Cache-Control": "private, no-store" } });
}
