import type { MobileCommunityPollDto } from "@/packages/contracts/src/mobile-v1";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileGuestIdentity } from "@/lib/community/guest-identity";
import { getMobileAuth } from "@/lib/mobile/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Context = { params: Promise<{ pollId: string }> };

async function pollIdentity(request: Request) {
  const auth = await getMobileAuth(request);
  if (auth) return { signedIn: true, userId: auth.user.id, voterKey: `account:${auth.user.id}` };
  const guest = getMobileGuestIdentity(request);
  return { signedIn: false, userId: null, voterKey: `guest:${guest.key}` };
}

async function tally(pollId: string, voterKey: string, signedIn: boolean): Promise<MobileCommunityPollDto> {
  const { data, error } = await createSupabaseAdminClient().from("post_poll_votes").select("option_id, voter_key").eq("poll_id", pollId);
  if (error) throw error;
  const counts: Record<string, number> = {};
  let myOptionId: string | null = null;
  for (const row of data ?? []) {
    counts[row.option_id] = (counts[row.option_id] ?? 0) + 1;
    if (row.voter_key === voterKey) myOptionId = row.option_id;
  }
  return { counts, myOptionId, signedIn, total: data?.length ?? 0 };
}

export async function GET(request: Request, context: Context) {
  const { pollId } = await context.params;
  if (!UUID.test(pollId)) return mobileError("BAD_REQUEST", "투표를 찾을 수 없습니다.", 400);
  try {
    const identity = await pollIdentity(request);
    return mobileSuccess(await tally(pollId, identity.voterKey, identity.signedIn), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return mobileError("INTERNAL", "투표 결과를 불러오지 못했습니다.", 500);
  }
}

export async function POST(request: Request, context: Context) {
  const { pollId } = await context.params;
  const identity = await pollIdentity(request).catch(() => null);
  if (!identity) return mobileError("BAD_REQUEST", "비회원 ID를 확인하지 못했습니다.", 400);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const optionId = typeof body?.optionId === "string" ? body.optionId : "";
  if (!UUID.test(pollId) || !UUID.test(optionId)) return mobileError("BAD_REQUEST", "투표 선택지를 확인해 주세요.", 400);
  const supabase = createSupabaseAdminClient();
  const { data: existing } = await supabase.from("post_poll_votes").select("option_id").eq("poll_id", pollId).eq("voter_key", identity.voterKey).maybeSingle();
  const result = existing?.option_id === optionId
    ? await supabase.from("post_poll_votes").delete().eq("poll_id", pollId).eq("voter_key", identity.voterKey)
    : await supabase.from("post_poll_votes").upsert({ option_id: optionId, poll_id: pollId, updated_at: new Date().toISOString(), user_id: identity.userId, voter_key: identity.voterKey }, { onConflict: "poll_id,voter_key" });
  if (result.error) return mobileError("INTERNAL", "투표를 처리하지 못했습니다.", 500);
  return mobileSuccess(await tally(pollId, identity.voterKey, identity.signedIn), { headers: { "Cache-Control": "private, no-store" } });
}
