"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminActionClient, createSupabaseAdminClient } from "@/lib/auth/admin";
import { fetchAuthenticatedLeaguepediaApi } from "@/lib/sync/leaguepedia-api";

function revalidate() {
  revalidatePath("/admin/players");
  revalidatePath("/players");
}

export async function createPlayerAction(formData: FormData) {
  const name = (formData.get("name") as string).trim();
  const realName = (formData.get("real_name") as string).trim();
  const teamId = formData.get("team_id") as string | null;
  const position = formData.get("position") as string;
  const isStarter = formData.get("is_starter") === "true";

  if (!name || !position) return;

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const supabase = await createSupabaseAdminActionClient();

  // 주전 설정 시 같은 팀·포지션의 기존 주전을 서브로 내림
  if (isStarter && teamId && position) {
    await supabase
      .from("players")
      .update({ is_starter: false })
      .eq("team_id", teamId)
      .eq("position", position)
      .eq("is_starter", true);
  }

  await supabase.from("players").insert({
    name,
    slug,
    real_name: realName || null,
    team_id: teamId || null,
    position,
    is_starter: isStarter,
  });

  revalidate();
}

export async function updatePlayerAction(formData: FormData) {
  const id = formData.get("id") as string;
  const name = (formData.get("name") as string).trim();
  const realName = (formData.get("real_name") as string).trim();
  const teamId = formData.get("team_id") as string | null;
  const isStarter = formData.get("is_starter") === "true";
  const position = formData.get("position") as string;

  if (!id || !name) return;

  const supabase = await createSupabaseAdminActionClient();

  // 주전 설정 시 같은 팀·포지션의 기존 주전을 서브로 내림
  if (isStarter && teamId && position) {
    await supabase
      .from("players")
      .update({ is_starter: false })
      .eq("team_id", teamId)
      .eq("position", position)
      .eq("is_starter", true)
      .neq("id", id);
  }

  await supabase
    .from("players")
    .update({ name, real_name: realName || null, team_id: teamId || null, is_starter: isStarter })
    .eq("id", id);

  revalidate();
}

export async function deletePlayerAction(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createSupabaseAdminActionClient();
  await supabase.from("players").delete().eq("id", id);

  revalidate();
}

export async function retirePlayerAction(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createSupabaseAdminActionClient();

  // 현재 팀 정보 조회 후 경력 기록에 자동 추가
  const { data: player } = await supabase
    .from("players")
    .select("team_id, position")
    .eq("id", id)
    .single();

  if (player?.team_id) {
    // 해당 팀에 아직 종료 날짜 없는 경력이 있으면 종료 처리
    const { data: openEntry } = await supabase
      .from("player_career_history")
      .select("id")
      .eq("player_id", id)
      .eq("team_id", player.team_id)
      .is("end_date", null)
      .maybeSingle();

    if (openEntry) {
      await supabase
        .from("player_career_history")
        .update({ end_date: today })
        .eq("id", openEntry.id);
    }
  }

  await supabase
    .from("players")
    .update({ is_active: false, retired_at: today, team_id: null, is_starter: false })
    .eq("id", id);

  revalidate();
}

export async function setPlayerDivisionAction(formData: FormData) {
  const id = formData.get("id") as string;
  const division = formData.get("division") as string;
  if (!id || (division !== "first" && division !== "challengers")) return;

  const supabase = await createSupabaseAdminActionClient();
  await supabase
    .from("players")
    .update({ imported_scope: division === "first" ? "lck" : "challengers" })
    .eq("id", id);

  revalidate();
}

export async function reactivatePlayerAction(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createSupabaseAdminActionClient();
  await supabase
    .from("players")
    .update({ is_active: true, retired_at: null })
    .eq("id", id);

  revalidate();
}

export async function addCareerHistoryAction(formData: FormData) {
  const playerId = formData.get("player_id") as string;
  const teamId = (formData.get("team_id") as string) || null;
  const teamName = (formData.get("team_name") as string)?.trim() || null;
  const position = formData.get("position") as string;
  const startDate = formData.get("start_date") as string;
  const endDate = (formData.get("end_date") as string) || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!playerId || !position || !startDate) return;

  const supabase = await createSupabaseAdminActionClient();
  await supabase.from("player_career_history").insert({
    player_id: playerId,
    team_id: teamId,
    team_name: teamName,
    position,
    start_date: startDate,
    end_date: endDate,
    notes,
  });

  revalidate();
}

export async function deleteCareerHistoryAction(formData: FormData) {
  const id = formData.get("id") as string;
  if (!id) return;

  const supabase = await createSupabaseAdminActionClient();
  await supabase.from("player_career_history").delete().eq("id", id);

  revalidate();
}

const RATE_LIMIT_BASE_MS = 20000;
const MAX_RETRIES = 5;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchContractExpiries(pageNames: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>();
  const CHUNK = 40;

  for (let i = 0; i < pageNames.length; i += CHUNK) {
    const chunk = pageNames.slice(i, i + CHUNK);
    const escaped = chunk.map((n) => n.replace(/'/g, "\\'"));
    const params = new URLSearchParams({
      action: "cargoquery",
      format: "json",
      tables: "Players",
      fields: "ID,Contract",
      where: `ID IN ('${escaped.join("','")}')`,
      limit: String(CHUNK + 10),
    });

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const res = await fetchAuthenticatedLeaguepediaApi(params);
      if (!res.ok) throw new Error(`Leaguepedia fetch failed: ${res.status}`);

      const body = await res.json() as {
        cargoquery?: Array<{ title: { ID?: string; Contract?: string } }>;
        error?: { code?: string; info?: string };
      };

      if (body.error?.code === "ratelimited") {
        if (attempt === MAX_RETRIES - 1) {
          throw new Error("Leaguepedia rate limited. 잠시 후 다시 시도해주세요.");
        }
        await sleep(RATE_LIMIT_BASE_MS * (attempt + 1));
        continue;
      }
      if (body.error) {
        throw new Error(`Leaguepedia 오류: ${body.error.info}`);
      }

      for (const entry of body.cargoquery ?? []) {
        const id = entry.title.ID?.trim();
        const expiry = entry.title.Contract?.trim() || null;
        if (id) result.set(id, expiry);
      }
      break;
    }

    if (i + CHUNK < pageNames.length) {
      await sleep(2000);
    }
  }

  return result;
}

export async function syncContractExpiryAction(): Promise<{ updated: number; skipped: number; error?: string }> {
  const supabase = await createSupabaseAdminActionClient();

  const { data, error } = await supabase
    .from("players")
    .select("id, name, leaguepedia_page")
    .not("leaguepedia_page", "is", null)
    .neq("leaguepedia_page", "");

  if (error) throw new Error(error.message);

  const players = data ?? [];
  const pageNames = [...new Set(players.map((p) => p.leaguepedia_page!))];

  let contractMap: Map<string, string | null>;
  try {
    contractMap = await fetchContractExpiries(pageNames);
  } catch (e) {
    return { updated: 0, skipped: players.length, error: (e as Error).message };
  }

  let updated = 0;
  let skipped = 0;

  for (const player of players) {
    const page = player.leaguepedia_page!;
    if (!contractMap.has(page)) { skipped++; continue; }

    const expiry = contractMap.get(page) ?? null;
    const { error: upErr } = await supabase
      .from("players")
      .update({ contract_expiry: expiry })
      .eq("id", player.id);

    if (upErr) { skipped++; continue; }
    updated++;
  }

  revalidate();
  revalidatePath("/teams");
  return { updated, skipped };
}
