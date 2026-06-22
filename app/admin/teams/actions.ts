"use server";

import { revalidatePath } from "next/cache";

import { fanSiteHosts } from "@/lib/team-themes";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function textOrNull(value: FormDataEntryValue | null) {
  const text = typeof value === "string" ? value.trim() : "";
  return text.length > 0 ? text : null;
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = textOrNull(formData.get(key));

  if (!value) {
    throw new Error(`${label} 값은 필수입니다.`);
  }

  return value;
}

function ensureFanSiteHost(value: string) {
  if (!fanSiteHosts.includes(value as (typeof fanSiteHosts)[number])) {
    throw new Error("팬사이트 호스트는 고정 10개 값 중 하나만 사용할 수 있습니다.");
  }
}

function teamPayload(formData: FormData) {
  const fanSiteHost = requiredText(formData, "fanSiteHost", "팬사이트 호스트");
  ensureFanSiteHost(fanSiteHost);

  return {
    slug: requiredText(formData, "slug", "팀 상세 slug"),
    name: requiredText(formData, "name", "팀명"),
    short_name: requiredText(formData, "shortName", "축약명"),
    logo_url: textOrNull(formData.get("logoUrl")),
    logo_white_url: textOrNull(formData.get("logoWhiteUrl")),
    background_url: textOrNull(formData.get("backgroundUrl")),
    primary_color: requiredText(formData, "primaryColor", "기본 색상"),
    secondary_color: requiredText(formData, "secondaryColor", "보조 색상"),
    fan_site_host: fanSiteHost,
    official_homepage_url: textOrNull(formData.get("officialHomepageUrl")),
    official_youtube_url: textOrNull(formData.get("officialYoutubeUrl")),
    official_x_url: textOrNull(formData.get("officialXUrl")),
    official_instagram_url: textOrNull(formData.get("officialInstagramUrl")),
    leaguepedia_page: textOrNull(formData.get("leaguepediaPage")),
    source_team_id: textOrNull(formData.get("sourceTeamId")),
    head_coach: textOrNull(formData.get("headCoach")),
    coaches: textOrNull(formData.get("coaches")),
    global_power_rank: (() => {
      const v = textOrNull(formData.get("globalPowerRank"));
      return v ? parseInt(v, 10) : null;
    })(),
  };
}

export async function createTeamAction(formData: FormData) {
  const payload = teamPayload(formData);
  const supabase = createSupabaseAdminClient();

  const [slugCheck, hostCheck] = await Promise.all([
    supabase.from("teams").select("id").eq("slug", payload.slug).maybeSingle(),
    supabase.from("teams").select("id").eq("fan_site_host", payload.fan_site_host).maybeSingle(),
  ]);

  if (slugCheck.data) throw new Error(`slug '${payload.slug}'는 이미 사용 중입니다.`);
  if (hostCheck.data) throw new Error(`팬사이트 호스트 '${payload.fan_site_host}'는 이미 사용 중입니다.`);

  const { error } = await supabase.from("teams").insert(payload);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/teams");
  revalidatePath("/teams");
}

export async function updateTeamAction(formData: FormData) {
  const teamId = requiredText(formData, "teamId", "팀 ID");
  const payload = teamPayload(formData);
  const supabase = createSupabaseAdminClient();

  const [slugCheck, hostCheck] = await Promise.all([
    supabase.from("teams").select("id").eq("slug", payload.slug).neq("id", teamId).maybeSingle(),
    supabase.from("teams").select("id").eq("fan_site_host", payload.fan_site_host).neq("id", teamId).maybeSingle(),
  ]);

  if (slugCheck.data) throw new Error(`slug '${payload.slug}'는 다른 팀이 이미 사용 중입니다.`);
  if (hostCheck.data) throw new Error(`팬사이트 호스트 '${payload.fan_site_host}'는 다른 팀이 이미 사용 중입니다.`);

  const { error } = await supabase.from("teams").update(payload).eq("id", teamId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${teamId}`);
  revalidatePath("/teams");
  revalidatePath(`/teams/${payload.slug}`);
}

export async function createTeamIdentityHistoryAction(formData: FormData) {
  const teamId = requiredText(formData, "teamId", "팀 ID");
  const effectiveFrom = requiredText(formData, "effectiveFrom", "적용 시작일");
  const effectiveTo = textOrNull(formData.get("effectiveTo"));

  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw new Error("적용 종료일은 시작일보다 빠를 수 없습니다.");
  }

  // 기존 이력과 구간 충돌 검증
  const supabase = createSupabaseAdminClient();
  const { data: existingHistories } = await supabase
    .from("team_identity_histories")
    .select("effective_from, effective_to")
    .eq("team_id", teamId);

  const FAR_FUTURE = "9999-12-31";
  const newFrom = effectiveFrom;
  const newTo = effectiveTo ?? FAR_FUTURE;

  for (const h of existingHistories ?? []) {
    const hFrom = h.effective_from as string;
    const hTo = (h.effective_to as string | null) ?? FAR_FUTURE;
    const overlaps = newFrom <= hTo && hFrom <= newTo;
    if (overlaps) {
      throw new Error(
        `입력한 적용 구간이 기존 이력(${hFrom} ~ ${h.effective_to ?? "현재"})과 겹칩니다.`,
      );
    }
  }

  const { error } = await supabase.from("team_identity_histories").insert({
    team_id: teamId,
    name: requiredText(formData, "historyName", "변경 이력 팀명"),
    short_name: requiredText(formData, "historyShortName", "변경 이력 축약명"),
    slug: requiredText(formData, "historySlug", "변경 이력 slug"),
    logo_url: textOrNull(formData.get("historyLogoUrl")),
    sponsor_name: textOrNull(formData.get("sponsorName")),
    effective_from: effectiveFrom,
    effective_to: effectiveTo,
    note: textOrNull(formData.get("note")),
  });

  if (error) throw new Error(error.message);

  revalidatePath("/admin/teams");
  revalidatePath(`/admin/teams/${teamId}`);
}
