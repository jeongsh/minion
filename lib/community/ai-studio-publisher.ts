import "server-only";

import { createHmac } from "node:crypto";
import { createSupabaseAdminClient } from "../supabase/admin.ts";
import { DEFAULT_STUDIO_PERSONAS, parseStudioDraft } from "./ai-studio.ts";
import { STUDIO_PERSONA_AVATARS } from "./ai-studio-avatars.ts";
import { studioMediaNodes } from "./ai-studio-media.ts";
import { screenCommunityText } from "./ai-moderation.ts";
import { nicknameFromKey } from "./guest-nickname.ts";
import { ensureStudioMemberAuthor, studioMemberAuthor, StudioPublishError } from "./ai-studio-authors.ts";

export { provisionStudioAuthors, STUDIO_MEMBER_AUTHOR_IDS, StudioPublishError } from "./ai-studio-authors.ts";
export type { StudioProvisionedAuthor } from "./ai-studio-authors.ts";

const GUEST_PERSONA_ID = "unaffiliated-baiter";
const POST_COLUMNS = "id,author_id,title,content,site_scope,board_type,team_id,guest_nickname,guest_ip_label,guest_key,is_notice,deleted_at,blinded_at";
const CREDENTIAL_COLUMNS = "post_id,guest_key,ip_key,ip_label";
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
export type StudioPublishResult = { postId: string; authorId: string | null; authorName: string; authorType: "member" | "guest"; created: boolean };

export function studioGuestKey(): string {
  const secret = process.env.COMMUNITY_GUEST_IP_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || secret.length < 16) throw new StudioPublishError("비회원 AI 작성에 필요한 서버 비밀키를 확인해 주세요.", 503);
  // A dedicated service guest, not an invented visitor IP or somebody else's browser cookie.
  return createHmac("sha256", secret).update(`guest:community-studio:${GUEST_PERSONA_ID}`).digest("hex");
}

export function studioGuestNickname(guestKey = studioGuestKey()): string {
  return nicknameFromKey(guestKey);
}

async function checkGuestLimits(client: AdminClient, guestKey: string, alreadyPublished: boolean): Promise<void> {
  const sanction = await client.from("community_guest_sanctions").select("id").eq("guest_key", guestKey).is("lifted_at", null).limit(1).maybeSingle();
  if (sanction.error) throw new StudioPublishError("비회원 AI의 커뮤니티 이용 제한을 확인하지 못했습니다.");
  if (sanction.data) throw new StudioPublishError("커뮤니티 이용이 제한된 비회원 AI는 게시할 수 없습니다.", 403);
  if (alreadyPublished) return;
  // No browser IP exists in CLI jobs. Apply the regular guest limits to this dedicated key.
  const [recent, windowed] = await Promise.all([30, 600].map((seconds) => client.from("community_guest_post_credentials")
    .select("created_at", { count: "exact", head: true }).eq("guest_key", guestKey).gte("created_at", new Date(Date.now() - seconds * 1_000).toISOString())));
  if (recent.error || windowed.error) throw new StudioPublishError("비회원 AI 작성 간격을 확인하지 못했습니다.");
  if ((recent.count ?? 0) > 0) throw new StudioPublishError("비회원 AI 글은 30초 후에 다시 작성해 주세요.", 429);
  if ((windowed.count ?? 0) >= 5) throw new StudioPublishError("비회원 AI는 10분 동안 5개까지 작성할 수 있습니다.", 429);
}

async function verifyGuestCredential(client: AdminClient, postId: string, guestKey: string): Promise<void> {
  const credential = await client.from("community_guest_post_credentials").select(CREDENTIAL_COLUMNS).eq("post_id", postId).single();
  if (credential.error || credential.data?.post_id !== postId || credential.data.guest_key !== guestKey
    || credential.data.ip_key !== null || credential.data.ip_label !== null) throw new StudioPublishError("비회원 AI 게시글의 자격정보가 일치하지 않아 작업을 중단했습니다.", 409);
}

async function createGuestCredential(client: AdminClient, postId: string, guestKey: string): Promise<void> {
  try {
    const credential = await client.from("community_guest_post_credentials").insert({ post_id: postId, guest_key: guestKey, ip_key: null, ip_label: null });
    if (credential.error) throw new StudioPublishError("비회원 AI 자격정보를 저장하지 못했습니다.");
    await verifyGuestCredential(client, postId, guestKey);
  } catch {
    // This is called only after this invocation inserted the new post. Never recover an existing row.
    try {
      const hidden = await client.from("community_posts").update({ deleted_at: new Date().toISOString() })
        .eq("id", postId).is("author_id", null).eq("guest_key", guestKey).is("deleted_at", null).select("id,deleted_at").single();
      if (hidden.error || hidden.data?.id !== postId || !hidden.data.deleted_at) throw new Error();
    } catch {
      throw new StudioPublishError("비회원 자격정보 저장과 새 글 숨김 확인에 실패했습니다. 관리자 확인이 필요합니다.");
    }
    throw new StudioPublishError("비회원 자격정보 저장에 실패해 새 글을 숨겼습니다. 새 초안을 만들기 전에 관리자에게 확인해 주세요.");
  }
}

function verifyPost(row: Record<string, unknown>, expected: Record<string, unknown>): void {
  if (row.deleted_at !== null || row.blinded_at !== null || Object.entries(expected).some(([key, value]) => row[key] !== value)) {
    throw new StudioPublishError("같은 초안 ID의 게시글이 변경·삭제·블라인드되었거나 작성자가 달라 게시를 중단했습니다.", 409);
  }
}

/** Called only after administrator authorization. Publishes one post; never comments or LP awards. */
export async function publishStudioPost(value: unknown): Promise<StudioPublishResult> {
  try {
    const draft = parseStudioDraft(value);
    if (draft.source.media?.some(item => ["youtube", "video"].includes(item.kind)) && !draft.source.mediaContext?.trim()) throw new StudioPublishError("영상 분석 또는 맥락 입력 후 생성한 초안만 게시할 수 있습니다.", 422);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(draft.id)) throw new StudioPublishError("게시할 초안의 ID가 올바른 UUID가 아닙니다.", 400);
    const persona = DEFAULT_STUDIO_PERSONAS.find((item) => item.id === draft.post.personaId);
    if (!persona || draft.personas.length !== DEFAULT_STUDIO_PERSONAS.length
      || draft.personas.some((item) => !DEFAULT_STUDIO_PERSONAS.some((base) => base.id === item.id && base.name === item.name
        && (base.authorType ?? "member") === (item.authorType ?? "member")))) {
      throw new StudioPublishError("기본 AI 캐릭터 6명의 ID·이름·회원 유형을 유지한 초안만 게시할 수 있습니다.", 400);
    }
    const isGuest = persona.id === GUEST_PERSONA_ID;
    if ((persona.authorType ?? "member") !== (isGuest ? "guest" : "member")) throw new StudioPublishError("등록된 AI 캐릭터의 회원 유형이 일치하지 않습니다.", 400);
    const member = isGuest ? null : studioMemberAuthor(persona.id);
    const guestKey = isGuest ? studioGuestKey() : null;
    const authorName = guestKey ? studioGuestNickname(guestKey) : persona.name;
    if (persona.name.length > 16) throw new StudioPublishError("AI 표시 이름은 16자 이하여야 합니다.", 400);
    const paragraphs = draft.post.content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const content = JSON.stringify({ type: "doc", content: [...studioMediaNodes(draft.source.media), ...paragraphs.map((text) => ({ type: "paragraph", content: [{ type: "text", text }] }))] });
    const expected = {
      id: draft.id.toLowerCase(), author_id: member?.id ?? null, title: draft.post.title, content,
      site_scope: "hub", board_type: "free", team_id: null,
      guest_nickname: isGuest ? authorName : null, guest_ip_label: null, guest_key: guestKey, is_notice: false,
    };
    const client = createSupabaseAdminClient();
    const existing = await client.from("community_posts").select(POST_COLUMNS).eq("id", expected.id).maybeSingle();
    if (existing.error) throw new StudioPublishError("기존 게시글을 확인하지 못했습니다.");
    if (existing.data) verifyPost(existing.data, expected);
    if (guestKey) {
      await checkGuestLimits(client, guestKey, Boolean(existing.data));
      if (existing.data) await verifyGuestCredential(client, expected.id, guestKey);
    } else if (member) {
      const sanction = await client.from("community_user_sanctions").select("id").eq("user_id", member.id).is("lifted_at", null).limit(1).maybeSingle();
      if (sanction.error) throw new StudioPublishError("AI 계정의 커뮤니티 이용 제한을 확인하지 못했습니다.");
      if (sanction.data) throw new StudioPublishError("커뮤니티 이용이 제한된 AI 계정은 게시할 수 없습니다.", 403);
    }
    const verdict = await screenCommunityText({ title: draft.post.title, text: paragraphs.join("\n") });
    if (verdict.flagged) throw new StudioPublishError("현재 커뮤니티 광고·스팸 기준에 따라 게시를 중단했습니다.", 422);
    if (member) await ensureStudioMemberAuthor(client, member, STUDIO_PERSONA_AVATARS[persona.id]);
    const result = { postId: expected.id, authorId: member?.id ?? null, authorName, authorType: isGuest ? "guest" as const : "member" as const };
    if (existing.data) return { ...result, created: false };
    const inserted = await client.from("community_posts").insert(expected).select(POST_COLUMNS).single();
    if (inserted.error && inserted.error.code !== "23505") throw new StudioPublishError("AI 게시글을 저장하지 못했습니다. 같은 초안으로 다시 확인할 수 있습니다.");
    if (!inserted.error) {
      if (!inserted.data) throw new StudioPublishError("AI 게시글 저장 결과를 확인하지 못했습니다.");
      verifyPost(inserted.data, expected);
    }
    if (guestKey) {
      if (inserted.error) await verifyGuestCredential(client, expected.id, guestKey);
      else await createGuestCredential(client, expected.id, guestKey);
    }
    const saved = await client.from("community_posts").select(POST_COLUMNS).eq("id", expected.id).single();
    if (saved.error || !saved.data) throw new StudioPublishError("AI 게시글 저장 후 확인에 실패했습니다. 같은 초안으로 다시 확인할 수 있습니다.");
    verifyPost(saved.data, expected);
    return { ...result, created: !inserted.error };
  } catch (error) {
    if (error instanceof StudioPublishError) throw error;
    throw new StudioPublishError("AI 게시 요청을 처리하지 못했습니다. 초안과 서버 설정을 확인해 주세요.");
  }
}
