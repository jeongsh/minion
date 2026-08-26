import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getGuestIdentity } from "@/lib/community/guest-identity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** poll_id/option_id는 본문 JSON에서 온 값이라 형식만 검증한다(FK가 없다). */
function invalidId(value: unknown): value is string {
  return typeof value !== "string" || !UUID.test(value);
}

async function pollIdentity() {
  const user = await getCurrentUser();
  if (user) return { signedIn: true, userId: user.id, voterKey: `account:${user.id}` };
  const guest = await getGuestIdentity();
  return { signedIn: false, userId: null, voterKey: `guest:${guest.key}` };
}

async function readTally(pollId: string, voterKey: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("post_poll_votes").select("option_id, voter_key").eq("poll_id", pollId);
  if (error) throw error;

  const counts: Record<string, number> = {};
  let myOptionId: string | null = null;
  for (const row of data ?? []) {
    counts[row.option_id] = (counts[row.option_id] ?? 0) + 1;
    if (row.voter_key === voterKey) myOptionId = row.option_id;
  }

  return { counts, total: data?.length ?? 0, myOptionId };
}

export async function GET(_request: Request, context: { params: Promise<{ pollId: string }> }) {
  const { pollId } = await context.params;
  if (invalidId(pollId)) return NextResponse.json({ error: "Invalid poll id." }, { status: 400 });

  try {
    const identity = await pollIdentity();
    return NextResponse.json({ ...(await readTally(pollId, identity.voterKey)), signedIn: identity.signedIn });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ pollId: string }> }) {
  const { pollId } = await context.params;
  if (invalidId(pollId)) return NextResponse.json({ error: "Invalid poll id." }, { status: 400 });

  const body = await request.json().catch(() => null);
  const optionId = body?.optionId;
  if (invalidId(optionId)) return NextResponse.json({ error: "Invalid option id." }, { status: 400 });

  const identity = await pollIdentity().catch(() => null);
  if (!identity) return NextResponse.json({ error: "비회원 정보를 확인하지 못했습니다." }, { status: 400 });
  const supabase = createSupabaseAdminClient();

  // 같은 선택지를 다시 누르면 투표를 취소한다.
  const { data: existing } = await supabase
    .from("post_poll_votes")
    .select("option_id")
    .eq("poll_id", pollId)
    .eq("voter_key", identity.voterKey)
    .maybeSingle();

  if (existing?.option_id === optionId) {
    const { error } = await supabase.from("post_poll_votes").delete().eq("poll_id", pollId).eq("voter_key", identity.voterKey);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("post_poll_votes").upsert(
      { poll_id: pollId, user_id: identity.userId, voter_key: identity.voterKey, option_id: optionId, updated_at: new Date().toISOString() },
      { onConflict: "poll_id,voter_key" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  try {
    return NextResponse.json({ ...(await readTally(pollId, identity.voterKey)), signedIn: identity.signedIn });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
