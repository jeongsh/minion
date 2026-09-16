import "server-only";

import type { User } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../supabase/admin.ts";
import { DEFAULT_STUDIO_PERSONAS } from "./ai-studio.ts";

export const STUDIO_MEMBER_AUTHOR_IDS: Readonly<Record<string, string>> = {
  "t1-optimist": "b65144fe-b96a-4b13-87da-8ed876169c20",
  "geng-fan": "4f154eb1-de55-4255-8309-b8784adb7055",
  "t1-partisan": "26286111-78de-4cbb-bef8-306ad11b5314",
  "hle-kind": "09bda6df-2b13-4e0a-bc8e-530a5952ac3f",
  "neutral-analyst": "c20b62eb-07cd-4624-beaa-77ff85229727",
};
const BAN_DURATION_HOURS = 876_000;
type AdminClient = ReturnType<typeof createSupabaseAdminClient>;
export type StudioMemberAuthor = { id: string; personaId: string; name: string; email: string };
export type StudioProvisionedAuthor = { personaId: string; authorId: string; authorName: string; profileImageUrl: string | null; created: boolean };

export class StudioPublishError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "StudioPublishError";
    this.status = status;
  }
}

export function studioMemberAuthor(personaId: string): StudioMemberAuthor {
  const persona = DEFAULT_STUDIO_PERSONAS.find((item) => item.id === personaId);
  const id = STUDIO_MEMBER_AUTHOR_IDS[personaId];
  if (!persona || !id || (persona.authorType ?? "member") !== "member" || persona.name.length > 16) throw new StudioPublishError("등록된 회원형 AI 캐릭터가 아닙니다.", 400);
  return { id, personaId, name: persona.name, email: `${personaId}@community-ai.minion.invalid` };
}

function verifyAuthor(user: User | null, author: StudioMemberAuthor): void {
  const meta = user?.app_metadata ?? {};
  const roles = [meta.role, meta.minion_role, ...(Array.isArray(meta.roles) ? meta.roles : [meta.roles])];
  const privileged = meta.is_admin === true || meta.is_owner === true || roles.some((role) => typeof role === "string" && /admin|owner/i.test(role));
  const expectedBan = Date.parse(user?.created_at ?? "") + BAN_DURATION_HOURS * 3_600_000;
  const bannedUntil = Date.parse(user?.banned_until ?? "");
  if (!user || user.id !== author.id || user.email !== author.email || meta.is_ai !== true
    || meta.community_studio_persona_id !== author.personaId || privileged || user.role !== "authenticated"
    || meta.provider !== "email" || !Array.isArray(meta.providers) || meta.providers.length !== 1 || meta.providers[0] !== "email"
    || user.is_anonymous || user.phone || user.last_sign_in_at || !Number.isFinite(expectedBan)
    || !Number.isFinite(bannedUntil) || bannedUntil <= Date.now() || Math.abs(bannedUntil - expectedBan) > 3_600_000) {
    throw new StudioPublishError("AI 전용 계정의 소유권 또는 로그인 차단 상태가 일치하지 않아 작업을 중단했습니다.", 409);
  }
}

export async function ensureStudioMemberAuthor(client: AdminClient, author: StudioMemberAuthor, avatar?: string): Promise<StudioProvisionedAuthor> {
  const existing = await client.auth.admin.getUserById(author.id);
  let user = existing.data.user;
  let created = false;
  if (existing.error && existing.error.status !== 404 && existing.error.code !== "user_not_found") throw new StudioPublishError("AI 전용 계정을 확인하지 못했습니다.");
  if (!user) {
    if (!existing.error) throw new StudioPublishError("AI 전용 계정 조회 결과를 확인하지 못했습니다.");
    const result = await client.auth.admin.createUser({
      id: author.id, email: author.email, email_confirm: true, role: "authenticated", ban_duration: `${BAN_DURATION_HOURS}h`,
      app_metadata: { provider: "email", providers: ["email"], is_ai: true, community_studio_persona_id: author.personaId },
      user_metadata: { nickname: author.name },
    });
    if (result.error || !result.data.user) {
      const raced = await client.auth.admin.getUserById(author.id);
      if (raced.error || !raced.data.user) throw new StudioPublishError("AI 전용 계정을 생성하지 못했습니다. 기존 계정은 변경하지 않았습니다.");
      user = raced.data.user;
    } else {
      user = result.data.user;
      created = true;
    }
  }
  verifyAuthor(user, author);
  const profile = await client.from("profiles").select("id,nickname,profile_image_url").eq("id", author.id).maybeSingle();
  if (profile.error || !profile.data || profile.data.id !== author.id) throw new StudioPublishError("AI 전용 프로필을 확인하지 못했습니다.");
  if (profile.data.nickname !== author.name) {
    const collision = await client.from("profiles").select("id").eq("nickname", author.name).neq("id", author.id).limit(1).maybeSingle();
    if (collision.error) throw new StudioPublishError("AI 닉네임 사용 여부를 확인하지 못했습니다.");
    if (collision.data) throw new StudioPublishError("AI 닉네임을 다른 계정이 사용하고 있어 작업을 중단했습니다.", 409);
  }
  const profileImageUrl = avatar ?? profile.data.profile_image_url ?? null;
  if (profile.data.nickname !== author.name || (avatar !== undefined && profile.data.profile_image_url !== avatar)) {
    const patch = { nickname: author.name, ...(avatar !== undefined ? { profile_image_url: avatar } : {}) };
    // Only this Auth-verified dedicated account is renamed; no other profile is changed.
    const updated = await client.from("profiles").update(patch).eq("id", author.id).select("id,nickname,profile_image_url").single();
    if (updated.error || updated.data?.id !== author.id || updated.data.nickname !== author.name
      || (avatar !== undefined && updated.data.profile_image_url !== avatar)) throw new StudioPublishError("AI 프로필 표시 정보를 확인하지 못했습니다.");
  }
  return { personaId: author.personaId, authorId: author.id, authorName: author.name, profileImageUrl, created };
}

/** Server/CLI only. Creates the five member accounts; the guest persona has no Auth/profile row. */
export async function provisionStudioAuthors(options: { avatars?: Record<string, string> } = {}): Promise<StudioProvisionedAuthor[]> {
  try {
    const avatars: Record<string, string> = {};
    if (options.avatars !== undefined && (!options.avatars || typeof options.avatars !== "object" || Array.isArray(options.avatars))) throw new StudioPublishError("프로필 이미지 설정 형식이 올바르지 않습니다.", 400);
    for (const [personaId, value] of Object.entries(options.avatars ?? {})) {
      const author = studioMemberAuthor(personaId);
      if (typeof value !== "string" || value.length > 2_000) throw new StudioPublishError("프로필 이미지 주소가 올바르지 않습니다.", 400);
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password || url.href.length > 2_000) throw new StudioPublishError("프로필 이미지는 로그인 정보가 없는 https 주소여야 합니다.", 400);
      const storageOrigin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
      const ownerPrefix = `/storage/v1/object/public/profile-avatars/${author.id}/`;
      if (url.origin !== storageOrigin || !url.pathname.startsWith(ownerPrefix) || url.pathname.length === ownerPrefix.length || url.search || url.hash) {
        throw new StudioPublishError("해당 AI 계정의 프로필 저장 경로에 있는 이미지만 적용할 수 있습니다.", 400);
      }
      avatars[personaId] = url.href;
    }
    const authors = Object.keys(STUDIO_MEMBER_AUTHOR_IDS).map(studioMemberAuthor);
    const client = createSupabaseAdminClient();
    const results: StudioProvisionedAuthor[] = [];
    for (const author of authors) results.push(await ensureStudioMemberAuthor(client, author, avatars[author.personaId]));
    return results;
  } catch (error) {
    if (error instanceof StudioPublishError) throw error;
    throw new StudioPublishError("AI 계정 준비를 완료하지 못했습니다. 서버 설정과 프로필 정보를 확인해 주세요.");
  }
}
