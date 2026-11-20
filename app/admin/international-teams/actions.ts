"use server";

import { revalidatePath, updateTag } from "next/cache";

import { createSupabaseAdminActionClient, createSupabaseAdminClient } from "@/lib/auth/admin";
import { HOME_PUBLIC_DATA_TAG } from "@/lib/data/home-cache";
import { normalizeLeaguepediaKey } from "@/lib/leaguepedia-identity";
import { isR2Configured } from "@/lib/storage/r2";
import { prepareTeamLogoFile, storeLeaguepediaTeamLogo, storeTeamLogo } from "@/lib/storage/team-logo";
import { resolveLeaguepediaImageUrl } from "@/lib/sync/leaguepedia-images";
import { leaguepediaTeamPayload, queryLeaguepediaTeams, quoteCargoValue } from "@/lib/sync/leaguepedia-team-cargo";
import { getTransferTeams } from "@/lib/transfers/teams";

function findRegisteredTeam(page: string, teams: Awaited<ReturnType<typeof getTransferTeams>>) {
  const key = normalizeLeaguepediaKey(page);
  return teams.find((team) => [
    team.leaguepedia_page,
    team.source_team_id,
    ...team.aliases,
    // Some older teams were entered manually without a source page.
    team.leaguepedia_page ? null : team.name,
  ].some((value) => normalizeLeaguepediaKey(value) === key));
}

export async function searchInternationalTeamsAction(formData: FormData) {
  const client = await createSupabaseAdminActionClient();
  const query = textOrNull(formData.get("query"))?.replace(/_/g, " ").trim();
  if (!query || query.length < 2 || query.length > 160 || query.includes("%")) {
    return { error: "팀명 또는 약칭을 2자 이상 입력해 주세요." };
  }

  try {
    const exact = quoteCargoValue(query);
    const partial = quoteCargoValue("%" + query + "%");
    const [rows, teams] = await Promise.all([
      queryLeaguepediaTeams({
        where: '(T.Region IS NULL OR T.Region <> "Korea") AND (T._pageName LIKE ' + partial +
          " OR T.Name LIKE " + partial + " OR T.Short = " + exact + ")",
        order_by: "T._pageName = " + exact + " DESC,T.Short = " + exact + " DESC,T.IsDisbanded ASC,T.Name ASC",
        limit: "20",
      }),
      getTransferTeams(client),
    ]);
    const seen = new Set<string>();
    const results = rows.flatMap((row) => {
      if (!row.Page || !row.Name || seen.has(row.Page)) return [];
      seen.add(row.Page);
      const registered = findRegisteredTeam(row.Page, teams);
      if (registered?.is_lck_team) return [];
      return [{
        page: row.Page,
        name: row.Name,
        shortName: row.Short,
        region: row.Region,
        disbanded: row.IsDisbanded === "1",
        teamId: registered?.id ?? null,
      }];
    });
    return { results };
  } catch (error) {
    console.error("Leaguepedia team search failed", error);
    return { error: "Leaguepedia 팀을 검색하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

export async function addInternationalTeamAction(page: string) {
  const client = await createSupabaseAdminActionClient();
  if (typeof page !== "string" || !page.trim() || page.length > 255) {
    return { error: "추가할 팀을 검색 결과에서 선택해 주세요." };
  }

  try {
    const teams = await getTransferTeams(client);
    const registered = findRegisteredTeam(page, teams);
    if (registered) {
      return registered.is_lck_team
        ? { error: "이미 LCK 팀으로 등록되어 있습니다." }
        : { teamId: registered.id, created: false };
    }

    const rows = await queryLeaguepediaTeams({ where: "T._pageName = " + quoteCargoValue(page), limit: "10" });
    const row = rows.find((entry) => entry.Page === page && entry.Name);
    if (!row || row.Region?.toLowerCase() === "korea") {
      return { error: "Leaguepedia에서 추가할 해외팀을 찾지 못했습니다." };
    }

    const payload = leaguepediaTeamPayload(row, null);
    if (!payload.slug) return { error: "팀 주소를 만들 수 없어 추가하지 못했습니다." };

    const logoUrl = isR2Configured()
      ? await resolveLeaguepediaImageUrl(row.Image, { maxAttempts: 1 })
        .then((source) => source ? storeLeaguepediaTeamLogo(source) : null)
        .catch((error) => {
          console.error("Leaguepedia team logo import failed", error);
          return null;
        })
      : null;
    const { data, error } = await client.from("teams")
      .upsert({ ...payload, region: row.Region || null, logo_url: logoUrl }, { onConflict: "slug", ignoreDuplicates: true })
      .select("id").maybeSingle();
    if (error) throw error;

    if (!data) {
      const existing = findRegisteredTeam(row.Page, await getTransferTeams(client));
      if (existing && !existing.is_lck_team) return { teamId: existing.id, created: false };
      return { error: "같은 주소를 사용하는 팀이 이미 있어 추가하지 못했습니다." };
    }

    updateTag("lck-all-teams");
    revalidatePath("/admin/international-teams");
    revalidatePath("/admin/teams");
    revalidatePath("/teams");
    return { teamId: data.id as string, created: true, hasLogo: Boolean(logoUrl) };
  } catch (error) {
    console.error("Leaguepedia team import failed", error);
    return { error: "팀을 추가하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}

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

function checkboxValue(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

type TeamMediaState = { error?: string; saved?: boolean };

export async function updateInternationalTeamMediaAction(_previous: TeamMediaState, formData: FormData): Promise<TeamMediaState> {
  const client = await createSupabaseAdminActionClient();
  const teamId = requiredText(formData, "teamId", "팀 ID");
  const useWhiteLogoOnDark = checkboxValue(formData, "useWhiteLogoOnDark");
  const profileImageUrl = textOrNull(formData.get("profileImageUrl"));

  const { data: team, error: lookupError } = await client.from("teams").select("slug")
    .eq("id", teamId).eq("is_lck_team", false).maybeSingle();
  if (lookupError) {
    console.error("International team media lookup failed", lookupError);
    return { error: "팀 정보를 불러오지 못했습니다." };
  }

  if (!team) {
    return { error: "해외팀을 찾을 수 없습니다." };
  }

  let logo;
  let whiteLogo;
  try {
    [logo, whiteLogo] = await Promise.all([
      prepareTeamLogoFile(formData.get("logoFile")),
      prepareTeamLogoFile(formData.get("logoWhiteFile")),
    ]);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "로고 파일을 읽지 못했습니다." };
  }

  let logoUrl = textOrNull(formData.get("logoUrl"));
  let logoWhiteUrl = textOrNull(formData.get("logoWhiteUrl"));
  if (!logoUrl && !logo) return { error: "기본 로고 파일 또는 URL을 입력해 주세요." };

  if (logo || whiteLogo) {
    if (!isR2Configured()) return { error: "로고 저장소 설정을 확인해 주세요." };
    try {
      [logoUrl, logoWhiteUrl] = await Promise.all([
        logo ? storeTeamLogo(logo) : logoUrl,
        whiteLogo ? storeTeamLogo(whiteLogo) : logoWhiteUrl,
      ]);
    } catch (error) {
      console.error("International team logo upload failed", error);
      return { error: "로고를 올리지 못했습니다. 잠시 후 다시 시도해 주세요." };
    }
  }

  const { error } = await client
    .from("teams")
    .update({
      logo_url: logoUrl,
      logo_white_url: logoWhiteUrl,
      use_white_logo_on_dark: useWhiteLogoOnDark,
      profile_image_url: profileImageUrl,
    })
    .eq("id", teamId)
    .eq("is_lck_team", false);
  if (error) {
    console.error("International team media update failed", error);
    return { error: "팀 미디어를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }

  await refreshWeeklyReportTeamColor(client, team.slug);

  updateTag("lck-all-teams");
  updateTag(HOME_PUBLIC_DATA_TAG);
  revalidatePath("/");
  revalidatePath("/admin/international-teams");
  revalidatePath(`/admin/international-teams/${teamId}`);
  revalidatePath("/reports");
  revalidatePath("/admin/teams");
  revalidatePath("/teams");
  return { saved: true };
}

export async function updateInternationalTeamShortNameAction(formData: FormData) {
  const teamId = requiredText(formData, "teamId", "팀 ID");
  const shortName = requiredText(formData, "shortName", "약칭");

  const client = await createSupabaseAdminActionClient();
  const { data: team, error: lookupError } = await client.from("teams").select("slug").eq("id", teamId).maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!team) {
    throw new Error("???李얠쓣 ???놁뒿?덈떎.");
  }

  const { error } = await client.from("teams").update({ short_name: shortName }).eq("id", teamId);

  if (error) {
    throw new Error(error.message);
  }

  await refreshWeeklyReportTeamColor(client, team.slug);

  revalidatePath("/admin/international-teams");
  revalidatePath(`/admin/international-teams/${teamId}`);
  revalidatePath("/reports");
  revalidatePath("/teams");
  revalidatePath("/teams");
}

function requiredHexColor(formData: FormData, key: string, label: string) {
  const value = requiredText(formData, key, label);
  const normalized = value.startsWith("#") ? value : `#${value}`;
  if (!/^#[0-9a-fA-F]{6}$/.test(normalized) && !/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    throw new Error(`${label}은(는) #RRGGBB 형식이어야 합니다.`);
  }
  // #RGB → #RRGGBB 확장 (color input은 6자리만 다룬다)
  if (normalized.length === 4) {
    const [, r, g, b] = normalized;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return normalized.toUpperCase();
}

// 위클리 리포트 content에는 팀 색상이 비정규화돼 저장되므로, 색을 바꾸면 함께 갱신한다.
async function refreshWeeklyReportTeamColor(client: ReturnType<typeof createSupabaseAdminClient>, slug: string) {
  const { data: team } = await client
    .from("teams")
    .select("slug,name,short_name,logo_url,logo_white_url,primary_color")
    .eq("slug", slug)
    .maybeSingle();
  if (!team) return;

  const refresh = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(refresh);
      return;
    }
    if (!node || typeof node !== "object") return;
    const record = node as Record<string, unknown>;
    if (record.slug === slug && "color" in record && "shortName" in record) {
      record.color = team.primary_color;
      record.name = team.name;
      record.shortName = team.short_name;
      record.logoUrl = team.logo_url;
      record.logoWhiteUrl = team.logo_white_url;
    }
    Object.values(record).forEach(refresh);
  };

  const { data: reports } = await client.from("weekly_reports").select("id,content");
  for (const report of reports ?? []) {
    refresh(report.content);
    await client.from("weekly_reports").update({ content: report.content }).eq("id", report.id);
  }
}

export async function updateInternationalTeamColorsAction(formData: FormData) {
  const teamId = requiredText(formData, "teamId", "팀 ID");
  const primaryColor = requiredHexColor(formData, "primaryColor", "메인 컬러");
  const secondaryColor = requiredHexColor(formData, "secondaryColor", "보조 컬러");

  const client = await createSupabaseAdminActionClient();
  const { data: team, error: lookupError } = await client.from("teams").select("slug").eq("id", teamId).maybeSingle();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!team) {
    throw new Error("팀을 찾을 수 없습니다.");
  }

  const { error } = await client
    .from("teams")
    .update({ primary_color: primaryColor, secondary_color: secondaryColor })
    .eq("id", teamId);

  if (error) {
    throw new Error(error.message);
  }

  await refreshWeeklyReportTeamColor(client, team.slug);

  revalidatePath("/admin/international-teams");
  revalidatePath(`/admin/international-teams/${teamId}`);
  revalidatePath("/reports");
  revalidatePath("/teams");
}

export async function updateInternationalPlayerImageAction(formData: FormData) {
  const playerId = requiredText(formData, "playerId", "선수 ID");
  const profileImageUrl = textOrNull(formData.get("profileImageUrl"));

  const client = await createSupabaseAdminActionClient();
  const { data: player, error: lookupError } = await client
    .from("players")
    .select("slug, team_id, teams(slug)")
    .eq("id", playerId)
    .maybeSingle<{ slug: string; team_id: string | null; teams: { slug: string } | null }>();

  if (lookupError) {
    throw new Error(lookupError.message);
  }

  if (!player) {
    throw new Error("선수를 찾을 수 없습니다.");
  }

  const { error } = await client
    .from("players")
    .update({ profile_image_url: profileImageUrl })
    .eq("id", playerId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/international-teams");
  if (player.team_id) {
    revalidatePath(`/admin/international-teams/${player.team_id}`);
  }
  revalidatePath(`/players/${player.slug}`);
  if (player.teams?.slug) {
    revalidatePath("/teams");
  }
}
