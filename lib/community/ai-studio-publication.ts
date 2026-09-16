import "server-only";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "../supabase/admin.ts";
import { parseStudioDraft, DEFAULT_STUDIO_PERSONAS, type StudioDraft } from "./ai-studio.ts";
import { publishStudioPost, studioGuestKey, studioGuestNickname } from "./ai-studio-publisher.ts";
import { studioMemberAuthor, ensureStudioMemberAuthor, StudioPublishError } from "./ai-studio-authors.ts";
import { archiveStudioMedia } from "./ai-studio-media-storage.ts";
import { screenCommunityText } from "./ai-moderation.ts";

export const studioHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function studioQueueItems(draft: StudioDraft, guestKey: string, start = Date.now()) {
  const ids = draft.comments.map(() => randomUUID());
  const roots: number[] = [];
  let due = start;
  return draft.comments.map((comment, ordinal) => {
    const guest = comment.personaId === "unaffiliated-baiter";
    roots[ordinal] = comment.replyTo === null ? ordinal : roots[comment.replyTo];
    const target = comment.replyTo === null ? null : draft.comments[comment.replyTo];
    const prefix = target && target.replyTo !== null ? `@${DEFAULT_STUDIO_PERSONAS.find(p => p.id === target.personaId)?.name} ` : "";
    const content = prefix + comment.content;
    if (content.length > 600) throw new StudioPublishError("답글 대상 이름을 포함해 댓글을 600자 이하로 줄여 주세요.", 400);
    due += randomInt(ordinal === 0 ? 120 : 180, ordinal === 0 ? 301 : 601) * 1000;
    return { id: ids[ordinal], ordinal, persona_id: comment.personaId, author_id: guest ? null : studioMemberAuthor(comment.personaId).id,
      guest_key: guest ? guestKey : null, guest_nickname: guest ? studioGuestNickname(guestKey) : null, content,
      parent_id: comment.replyTo === null ? null : ids[roots[comment.replyTo]], due_at: new Date(due).toISOString() };
  });
}

export async function publishStudioCampaign(value: unknown) {
  let draft: StudioDraft;
  try { draft = parseStudioDraft(value); } catch (e) { throw new StudioPublishError(e instanceof Error ? e.message : "초안 형식을 확인해 주세요.", 400); }
  if (draft.source.media?.some(m => ["youtube", "video"].includes(m.kind)) && !draft.source.mediaContext?.trim()) throw new StudioPublishError("영상 분석 또는 맥락 입력 후 새 초안을 생성해 주세요.", 422);
  const hash = studioHash(draft);
  const client = createSupabaseAdminClient();
  const existing = await client.from("community_ai_studio_campaigns").select("draft_hash").eq("post_id", draft.id).maybeSingle();
  if (existing.error) throw new StudioPublishError("댓글 예약 설정을 확인하지 못했습니다.");
  if (existing.data) {
    if (existing.data.draft_hash !== hash) throw new StudioPublishError("이미 게시된 초안입니다. 예약 댓글은 아래 예약 관리에서 수정해 주세요.", 409);
    const post = await client.from("community_posts").select("id,deleted_at,blinded_at").eq("id", draft.id).single();
    if (post.error || post.data.deleted_at || post.data.blinded_at) throw new StudioPublishError("이미 게시된 글이 삭제·블라인드되었거나 조회할 수 없습니다.", 409);
    return { postId: draft.id, created: false };
  }
  for (const comment of draft.comments) if ((await screenCommunityText({ text: comment.content })).flagged) throw new StudioPublishError("댓글의 광고·스팸 내용을 확인해 주세요.", 422);
  for (const id of new Set(draft.comments.map(c => c.personaId))) if (id !== "unaffiliated-baiter") await ensureStudioMemberAuthor(client, studioMemberAuthor(id));
  const guestKey = studioGuestKey();
  const settings = await client.from("community_ai_studio_settings").update({ guest_key: guestKey }).eq("singleton", true).select("singleton").single();
  if (settings.error) throw new StudioPublishError("비회원 AI 예약 설정을 저장하지 못했습니다.");
  const items = studioQueueItems(draft, guestKey);
  const media = await archiveStudioMedia(draft.source.media ?? []);
  const result = await publishStudioPost({ ...draft, source: { ...draft.source, media } });
  const queued = await client.rpc("community_ai_studio_enqueue", { p_post: result.postId, p_hash: hash, p_items: items });
  if (queued.error) throw new StudioPublishError(`글은 게시됐지만 댓글 예약에 실패했습니다. /community/post/${result.postId} 에서 확인하고 같은 초안으로 게시를 다시 눌러 주세요.`, 502);
  return result;
}

export async function studioDashboard() {
  const client = createSupabaseAdminClient();
  const campaigns = await client.from("community_ai_studio_campaigns").select("post_id,state,created_at,community_posts(title)").order("created_at", { ascending: false }).limit(30);
  if (campaigns.error) throw new StudioPublishError("예약 목록을 불러오지 못했습니다.");
  const results = await Promise.all([
    campaigns.data.length ? client.from("community_ai_studio_queue").select("id,post_id,ordinal,persona_id,content,parent_id,due_at,status,error,published_at").in("post_id", campaigns.data.map(c => c.post_id)).order("ordinal").limit(1000) : Promise.resolve({ data: [], error: null }),
    client.from("community_ai_studio_inbox").select("id,post_id,comment_id,status,event_type,response_persona,response_text,created_at,community_posts(title)").in("status", ["pending", "drafted"]).order("created_at", { ascending: false }).limit(40),
    client.from("community_ai_studio_settings").select("watch_enabled").eq("singleton", true).single(),
  ]);
  if (results.some(r => r.error)) throw new StudioPublishError("예약·검토 목록을 불러오지 못했습니다. DB 설정을 확인해 주세요.");
  return { campaigns: campaigns.data, queue: results[0].data, inbox: results[1].data, settings: results[2].data };
}

export async function controlStudioQueue(value: Record<string, unknown>) {
  const client = createSupabaseAdminClient();
  if (value.action === "watch") {
    if (typeof value.enabled !== "boolean") throw new StudioPublishError("설정을 확인해 주세요.", 400);
    const result = await client.from("community_ai_studio_settings").update({ watch_enabled: value.enabled }).eq("singleton", true);
    if (result.error) throw new StudioPublishError("검토 알림 설정을 저장하지 못했습니다.");
    return;
  }
  if (value.action === "pause_all") {
    const rows = await client.from("community_ai_studio_campaigns").select("post_id").eq("state", "active");
    if (rows.error) throw new StudioPublishError("예약 목록 조회에 실패했습니다.");
    for (const row of rows.data) { const result = await client.rpc("community_ai_studio_control", { p_post: row.post_id, p_action: "pause" }); if (result.error) throw new StudioPublishError("일부 예약을 중단하지 못했습니다. 목록을 새로고침해 주세요."); }
    return;
  }
  if (!["pause", "resume", "cancel", "edit", "cancel_item"].includes(String(value.action)) || typeof value.postId !== "string") throw new StudioPublishError("예약 관리 요청이 올바르지 않습니다.", 400);
  if (value.action === "edit" && (typeof value.text !== "string" || (await screenCommunityText({ text: value.text })).flagged)) throw new StudioPublishError("댓글 내용을 확인해 주세요.", 422);
  const result = await client.rpc("community_ai_studio_control", { p_post: value.postId, p_action: value.action, p_queue: value.queueId ?? null, p_due: value.dueAt ?? null, p_text: value.text ?? null });
  if (result.error) throw new StudioPublishError("예약을 변경하지 못했습니다. 게시 여부와 예약 시간을 확인해 주세요.", 409);
}
