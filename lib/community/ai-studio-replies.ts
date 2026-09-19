import "server-only";
import { createSupabaseAdminClient } from "../supabase/admin.ts";
import { studioHash } from "./ai-studio-publication.ts";
import { ensureStudioMemberAuthor, studioMemberAuthor, StudioPublishError } from "./ai-studio-authors.ts";
import { screenCommunityText } from "./ai-moderation.ts";
import { assertStudioVocabulary, normalizeStudioPunctuation } from "./ai-studio-style.ts";
import { studioReplyGenerationRequest, STUDIO_REPLY_PERSONAS } from "./ai-studio-reply-prompt.ts";

type AutomaticReplyClaim = { activity_version: number; generation_token: string };

async function replyContext(eventId: string) {
  const client = createSupabaseAdminClient();
  const event = await client.from("community_ai_studio_inbox").select("id,post_id,comment_id,status,context_hash,response_persona,response_text,activity_version,generation_token").eq("id", eventId).single();
  if (event.error || !event.data) throw new StudioPublishError("검토 대상을 찾지 못했습니다.", 404);
  const [post, comments] = await Promise.all([
    client.from("community_posts").select("id,title,content,deleted_at,blinded_at").eq("id", event.data.post_id).single(),
    client.from("community_comments").select("id,parent_id,content,author_id,created_at").eq("post_id", event.data.post_id).is("deleted_at", null).is("blinded_at", null).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(40),
  ]);
  if (post.error || comments.error || post.data.deleted_at || post.data.blinded_at) throw new StudioPublishError("게시글 또는 댓글을 확인하지 못했습니다.", 409);
  const context = { post: post.data, comments: comments.data, targetCommentId: event.data.comment_id };
  return { client, event: event.data, context, hash: studioHash(context) };
}

export async function draftStudioReply(eventId: string, claim?: AutomaticReplyClaim) {
  const { client, event, context, hash } = await replyContext(eventId);
  if (!["pending", "drafted"].includes(event.status)) throw new StudioPublishError("이미 처리한 검토입니다.", 409);
  if (claim ? event.activity_version !== claim.activity_version || event.generation_token !== claim.generation_token : event.generation_token !== null) throw new StudioPublishError("대화가 바뀌었거나 자동 답변 생성 중입니다.", 409);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new StudioPublishError("AI 연결 설정이 필요합니다.", 503);
  const personas = STUDIO_REPLY_PERSONAS;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(45_000),
    body: JSON.stringify(studioReplyGenerationRequest(context, process.env.OPENAI_COMMUNITY_STUDIO_SEARCH_MODEL ?? "gpt-5.4-mini")),
  });
  if (!response.ok) throw new StudioPublishError("답변 후보 생성에 실패했습니다.");
  const raw = await response.json() as { status?: string; output?: { content?: { type?: string; text?: string }[] }[] };
  if (raw.status !== "completed") throw new StudioPublishError("답변 생성이 완료되지 않았습니다.");
  const result = JSON.parse(raw.output?.flatMap(o => o.content ?? []).filter(c => c.type === "output_text").map(c => c.text).join("") ?? "") as { shouldReply: boolean; personaId: string; content: string; reason: string };
  if (typeof result.shouldReply !== "boolean" || !personas.some(p => p.id === result.personaId) || typeof result.content !== "string" || result.content.length > 380 || (result.shouldReply && !result.content.trim())) throw new StudioPublishError("답변 후보 형식이 올바르지 않습니다.");
  result.content = normalizeStudioPunctuation(result.content, result.personaId);
  if (result.shouldReply && !result.content) throw new StudioPublishError("답변 후보가 비어 있습니다.");
  if (result.shouldReply) {
    try { assertStudioVocabulary(result.content); }
    catch { throw new StudioPublishError("답변 후보에 사용하지 않는 표현이 포함됐습니다. 다시 생성해 주세요."); }
  }
  const current = await replyContext(eventId);
  if (current.hash !== hash) throw new StudioPublishError("대화가 바뀌었습니다. 최신 댓글로 다시 생성해 주세요.", 409);
  let save = client.from("community_ai_studio_inbox").update({ status: result.shouldReply ? "drafted" : "pending", response_persona: result.personaId, response_text: result.shouldReply ? result.content : `답변 보류: ${String(result.reason).slice(0, 500)}`, context_hash: hash }).eq("id", eventId).eq("activity_version", event.activity_version).in("status", ["pending", "drafted"]);
  save = claim ? save.eq("generation_token", claim.generation_token) : save.is("generation_token", null);
  const saved = await save.select("id").single();
  if (saved.error) throw new StudioPublishError("다른 관리자가 검토를 변경했습니다. 새로고침해 주세요.", 409);
  return { ...result, hash };
}

/** Short, leased jobs survive browser closure and retry on subsequent cron runs. */
export async function processAutomaticStudioReplies() {
  const client = createSupabaseAdminClient();
  const claimed = await client.rpc("community_ai_studio_claim_replies", { p_limit: 3 });
  if (claimed.error) throw new StudioPublishError("자동 답변 작업 조회에 실패했습니다.");
  const jobs = (claimed.data ?? []) as (AutomaticReplyClaim & { id: string })[];
  const outcomes = await Promise.all(jobs.map(async job => {
    const finish = { p_event: job.id, p_version: job.activity_version, p_token: job.generation_token };
    try {
      const draft = await draftStudioReply(job.id, job);
      if (!draft.shouldReply || (await screenCommunityText({ text: draft.content })).flagged) {
        const skipped = await client.rpc("community_ai_studio_finish_reply", finish);
        if (skipped.error) throw new StudioPublishError("답변 보류 저장 실패");
        return skipped.data ? "skipped" : "superseded";
      }
      const author = studioMemberAuthor(draft.personaId);
      await ensureStudioMemberAuthor(client, author);
      const current = await replyContext(job.id);
      if (current.hash !== draft.hash) throw new StudioPublishError("대화 변경으로 자동 재생성 대기", 409);
      const saved = await client.rpc("community_ai_studio_finish_reply", { ...finish, p_author: author.id,
        p_persona: author.personaId, p_text: draft.content, p_hash: draft.hash });
      if (saved.error) throw new StudioPublishError("자동 답변 예약 저장 실패");
      return saved.data ? "scheduled" : "superseded";
    } catch (error) {
      const retry = await client.rpc("community_ai_studio_finish_reply", { ...finish,
        p_error: error instanceof StudioPublishError ? error.message : "자동 답변 생성 오류 · 잠시 후 재시도합니다." });
      if (retry.error) console.error("[ai-studio] retry state save failed");
      return "deferred";
    }
  }));
  return { claimed: jobs.length, scheduled: outcomes.filter(x => x === "scheduled").length,
    skipped: outcomes.filter(x => x === "skipped").length, deferred: outcomes.filter(x => x === "deferred").length };
}

export async function approveStudioReply(eventId: string, text: unknown) {
  const { client, event, hash } = await replyContext(eventId);
  if (event.status === "approved") return;
  if (hash !== event.context_hash || event.status !== "drafted") throw new StudioPublishError("대화가 바뀌었습니다. 최신 댓글로 답변을 다시 생성해 주세요.", 409);
  if (typeof text !== "string" || !text.trim() || text.length > 380 || (await screenCommunityText({ text })).flagged) throw new StudioPublishError("답변 내용을 확인해 주세요.", 422);
  const author = studioMemberAuthor(event.response_persona);
  await ensureStudioMemberAuthor(client, author);
  const result = await client.rpc("community_ai_studio_approve_reply", { p_event: eventId, p_author: author.id, p_persona: author.personaId, p_text: text.trim(), p_hash: hash });
  if (result.error) throw new StudioPublishError("답변 승인을 저장하지 못했습니다. 대상을 새로고침해 주세요.", 409);
}

export async function dismissStudioReply(eventId: string) {
  const result = await createSupabaseAdminClient().from("community_ai_studio_inbox").update({ status: "dismissed" }).eq("id", eventId).in("status", ["pending", "drafted"]);
  if (result.error) throw new StudioPublishError("검토를 닫지 못했습니다.");
}

