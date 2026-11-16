import "server-only";
import { getVerifiedAuth } from "@/lib/auth/verified-user";

export type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  sender: { nickname: string } | null;
  recipient: { nickname: string } | null;
};

export async function getMailbox(box: "inbox" | "sent", page: number) {
  const auth = await getVerifiedAuth();
  if (!auth) throw new Error("로그인이 필요합니다.");
  const received = box === "inbox";
  const [list, unread] = await Promise.all([
    auth.supabase.from("direct_messages")
      .select("id,sender_id,recipient_id,body,created_at,read_at,sender:profiles!direct_messages_sender_id_fkey(nickname),recipient:profiles!direct_messages_recipient_id_fkey(nickname)", { count: "exact" })
      .eq(received ? "recipient_id" : "sender_id", auth.user.id)
      .is(received ? "recipient_deleted_at" : "sender_deleted_at", null)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range((page - 1) * 20, page * 20 - 1),
    auth.supabase.from("direct_messages").select("id", { count: "exact", head: true })
      .eq("recipient_id", auth.user.id).is("recipient_deleted_at", null).is("read_at", null),
  ]);
  if (list.error || unread.error) throw new Error("쪽지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
  return { messages: (list.data ?? []) as unknown as DirectMessage[], total: list.count ?? 0, unread: unread.count ?? 0 };
}
