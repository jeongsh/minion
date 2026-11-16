"use server";

import { revalidatePath } from "next/cache";
import { getVerifiedAuth } from "@/lib/auth/verified-user";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Result = { ok: true } | { ok: false; error: string };

export async function sendMessageAction(input: { recipientId: string; body: string }): Promise<Result> {
  const auth = await getVerifiedAuth();
  if (!auth) return { ok: false, error: "로그인이 필요합니다." };
  if (typeof input?.body !== "string" || typeof input?.recipientId !== "string" || !UUID.test(input.recipientId)) {
    return { ok: false, error: "받는 사람을 확인해주세요." };
  }
  const body = input.body.trim();
  if (!body || [...body].length > 2000) return { ok: false, error: "쪽지는 1자부터 2,000자까지 입력해주세요." };
  if (input.recipientId === auth.user.id) return { ok: false, error: "자신에게는 쪽지를 보낼 수 없습니다." };
  const { error } = await auth.supabase.from("direct_messages").insert({ recipient_id: input.recipientId, body });
  if (error) {
    console.error("[messages] send failed", error.code);
    return { ok: false, error: error.code === "P0001" ? error.message : error.code === "23503" ? "받는 사람을 찾을 수 없습니다." : "쪽지를 보내지 못했습니다. 다시 시도해주세요." };
  }
  revalidatePath("/me/messages");
  return { ok: true };
}

export async function updateMessageAction(input: { id: string; operation: "read" | "delete" }): Promise<Result> {
  const auth = await getVerifiedAuth();
  if (!auth) return { ok: false, error: "로그인이 필요합니다." };
  if (!UUID.test(input?.id ?? "") || !["read", "delete"].includes(input.operation)) return { ok: false, error: "쪽지를 확인해주세요." };
  const { data: message, error: readError } = await auth.supabase.from("direct_messages")
    .select("sender_id, recipient_id, sender_deleted_at, recipient_deleted_at").eq("id", input.id).maybeSingle();
  if (readError || !message) return { ok: false, error: "쪽지를 찾을 수 없습니다." };
  const received = message.recipient_id === auth.user.id;
  if ((received ? message.recipient_deleted_at : message.sender_deleted_at) || (input.operation === "read" && !received)) return { ok: false, error: "쪽지를 찾을 수 없습니다." };
  const column = input.operation === "read" ? "read_at" : received ? "recipient_deleted_at" : "sender_deleted_at";
  const { error } = await auth.supabase.from("direct_messages").update({ [column]: new Date().toISOString() }).eq("id", input.id);
  if (error) return { ok: false, error: "쪽지 상태를 변경하지 못했습니다. 다시 시도해주세요." };
  revalidatePath("/me/messages");
  return { ok: true };
}
