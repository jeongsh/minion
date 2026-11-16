import { NextResponse } from "next/server";
import { getVerifiedAuth } from "@/lib/auth/verified-user";

export async function GET() {
  const auth = await getVerifiedAuth();
  if (!auth) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  const { count, error } = await auth.supabase.from("direct_messages").select("id", { count: "exact", head: true })
    .eq("recipient_id", auth.user.id).is("recipient_deleted_at", null).is("read_at", null);
  if (error) return NextResponse.json({ error: "쪽지 수를 불러오지 못했습니다." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ count: count ?? 0 }, { headers: { "Cache-Control": "private, no-store" } });
}
