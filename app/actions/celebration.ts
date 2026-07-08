"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/auth/current-user";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CelebrationMessage } from "@/lib/calendar/events";

export type PostCelebrationResult =
  | { ok: true; message: CelebrationMessage }
  | { ok: false; error: string; requiresLogin?: boolean };

const MAX_LENGTH = 200;

/** 축하 메시지 작성. 로그인 유저만 가능, 200자 제한. */
export async function postCelebrationMessage(input: {
  eventKey: string;
  message: string;
}): Promise<PostCelebrationResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, error: "로그인이 필요해요.", requiresLogin: true };
  }

  const eventKey = input.eventKey?.trim();
  const message = input.message?.trim();
  if (!eventKey) return { ok: false, error: "잘못된 요청이에요." };
  if (!message) return { ok: false, error: "축하 메시지를 입력해 주세요." };
  if (message.length > MAX_LENGTH) {
    return { ok: false, error: `축하 메시지는 ${MAX_LENGTH}자까지 쓸 수 있어요.` };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("celebration_messages")
    .insert({
      event_key: eventKey,
      author_id: user.id,
      author_name: user.nickname,
      message,
    })
    .select("id, event_key, author_name, message, created_at")
    .single();

  if (error || !data) {
    return { ok: false, error: "잠시 후 다시 시도해 주세요." };
  }

  revalidatePath("/");

  return {
    ok: true,
    message: {
      id: data.id,
      eventKey: data.event_key,
      authorName: data.author_name,
      message: data.message,
      createdAt: data.created_at,
    },
  };
}
