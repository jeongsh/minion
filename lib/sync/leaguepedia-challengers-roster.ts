import type { SupabaseClient } from "@supabase/supabase-js";

import { displayNameFromLeaguepediaPage, leaguepediaSourceId } from "../leaguepedia-identity.ts";
import { fetchAuthenticatedLeaguepediaApi } from "./leaguepedia-api.ts";

const REQUEST_DELAY_MS = 2500;
const MAX_RETRIES = 8;

type PlayerPosition = "TOP" | "JGL" | "MID" | "BOT" | "SUP";

// LCK CL(챌린저스 리그)에서 각 LCK 팀의 2군이 사용하는 리그피디아 팀 페이지명.
// 실제 출전 이력(MatchSchedule)에서 확인한 이름이며, 시즌이 바뀌면 갱신이 필요할 수 있다.
export const CHALLENGERS_TEAM_PAGES: Record<string, string> = {
  t1: "T1 Esports Academy",
  geng: "Gen.G Global Academy",
  dk: "Dplus Kia Challengers",
  kt: "KT Rolster Challengers",
  hle: "Hanwha Life Esports Challengers",
  bro: "HANJIN BRION Challengers",
  ns: "Nongshim Esports Academy",
  drx: "Kiwoom DRX Challengers",
  soop: "DN SOOPers Challengers",
  fox: "BNK FEARX Youth",
};

export const CHALLENGERS_SCOPE = "challengers";

function sleep(ms: number) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function makePlayerSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function normalizeRole(role: string | undefined): PlayerPosition | null {
  const r = String(role ?? "").trim().toLowerCase();
  if (r === "top") return "TOP";
  if (r === "jungle" || r === "jgl") return "JGL";
  if (r === "mid" || r === "middle") return "MID";
  if (r === "bot" || r === "bottom" || r === "adc") return "BOT";
  if (r === "support" || r === "sup") return "SUP";
  return null;
}

function realNameFromPage(page: string) {
  const match = page.match(/\(([^)]+)\)\s*$/);
  return match ? match[1].trim() : null;
}

type CargoPlayerRow = { Player?: string; Team?: string; Role?: string; Name?: string };

async function cargoQuery(
  params: Record<string, string>,
  onRetry?: (waitMs: number) => void,
): Promise<CargoPlayerRow[]> {
  const search = new URLSearchParams({ action: "cargoquery", format: "json", limit: "500", ...params });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    const response = await fetchAuthenticatedLeaguepediaApi(search);
    if (!response.ok) {
      throw new Error(`Leaguepedia fetch failed: ${response.status}`);
    }

    const body = (await response.json()) as {
      cargoquery?: Array<{ title: CargoPlayerRow }>;
      error?: { code?: string; info?: string };
    };

    if (body.error?.code === "ratelimited") {
      const waitMs = REQUEST_DELAY_MS * (attempt + 2);
      onRetry?.(waitMs);
      await sleep(waitMs);
      continue;
    }

    if (body.error) {
      throw new Error(`Leaguepedia cargo error: ${body.error.info ?? body.error.code}`);
    }

    return (body.cargoquery ?? []).map((entry) => entry.title);
  }

  throw new Error("Leaguepedia rate limit retries exhausted.");
}

export type ChallengersSyncSummary = {
  teamsQueried: number;
  playersFetched: number;
  playersInserted: number;
  playersUpdated: number;
  skipped: Array<{ player: string; team: string; reason: string }>;
};

// 이미 'lck' 스코프로 분류된 선수는 실제 1군 경기 출전 이력이 있어서 그렇게 분류됐을 가능성이 높다
// (kespa_cup 스코프 분리 마이그레이션 참고). 공개 화면 노출 여부를 임의로 바꾸지 않기 위해
// 이런 선수는 건드리지 않고 그대로 둔다 — 2군 로스터 동기화는 kespa_cup 스코프이거나
// 아직 DB에 없는 선수만 대상으로 한다.
const PROTECTED_SCOPES = new Set(["lck", "international_event", "manual"]);

export async function syncLckChallengersRosters(
  supabase: SupabaseClient,
  options: { onRetry?: (waitMs: number) => void } = {},
): Promise<ChallengersSyncSummary> {
  const teamPages = Object.values(CHALLENGERS_TEAM_PAGES);
  const where = teamPages.map((page) => `P.Team="${page.replace(/"/g, '\\"')}"`).join(" OR ");

  const rows = await cargoQuery(
    { tables: "Players=P", fields: "P.Player,P.Team,P.Role,P.Name", where: `(${where})` },
    options.onRetry,
  );

  const { data: teamRows, error: teamsError } = await supabase
    .from("teams")
    .select("id, slug");
  if (teamsError) throw teamsError;

  const teamIdBySlug = new Map((teamRows ?? []).map((t) => [t.slug, t.id]));
  const teamIdByLeaguepediaPage = new Map(
    Object.entries(CHALLENGERS_TEAM_PAGES).map(([slug, page]) => [page, teamIdBySlug.get(slug)]),
  );

  const summary: ChallengersSyncSummary = {
    teamsQueried: teamPages.length,
    playersFetched: rows.length,
    playersInserted: 0,
    playersUpdated: 0,
    skipped: [],
  };

  const candidates = rows
    .map((row) => {
      const page = row.Player?.trim();
      const teamPage = row.Team?.trim();
      const position = normalizeRole(row.Role);
      const nativeName = row.Name?.trim() || null;
      if (!page || !teamPage) return null;
      return { page, teamPage, position, nativeName };
    })
    .filter(
      (v): v is { page: string; teamPage: string; position: PlayerPosition | null; nativeName: string | null } =>
        v !== null,
    );

  for (const { page, teamPage, position, nativeName } of candidates) {
    if (!position) {
      // 코치/스태프 등 선수 포지션이 아닌 행은 건너뛴다.
      continue;
    }

    const teamId = teamIdByLeaguepediaPage.get(teamPage);
    if (!teamId) {
      summary.skipped.push({ player: page, team: teamPage, reason: "team_not_found" });
      continue;
    }

    const displayName = displayNameFromLeaguepediaPage(page);
    const slug = makePlayerSlug(displayName);
    if (!slug) {
      summary.skipped.push({ player: page, team: teamPage, reason: "empty_slug" });
      continue;
    }
    const realName = nativeName ?? realNameFromPage(page);

    const { data: existing, error: existingError } = await supabase
      .from("players")
      .select("id, imported_scope")
      .eq("slug", slug)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      if (PROTECTED_SCOPES.has(existing.imported_scope)) {
        summary.skipped.push({
          player: page,
          team: teamPage,
          reason: `already_tracked_as_${existing.imported_scope}`,
        });
        continue;
      }

      const { error } = await supabase
        .from("players")
        .update({
          team_id: teamId,
          position,
          real_name: realName,
          imported_scope: CHALLENGERS_SCOPE,
          is_lck_player: true,
          is_active: true,
          leaguepedia_page: page,
          source_player_id: leaguepediaSourceId(page),
        })
        .eq("id", existing.id);
      if (error) throw error;
      summary.playersUpdated += 1;
      continue;
    }

    const { error } = await supabase.from("players").insert({
      slug,
      name: displayName,
      real_name: realName,
      team_id: teamId,
      position,
      is_starter: false,
      is_lck_player: true,
      imported_scope: CHALLENGERS_SCOPE,
      is_active: true,
      leaguepedia_page: page,
      source_player_id: leaguepediaSourceId(page),
    });
    if (error) throw error;
    summary.playersInserted += 1;
  }

  return summary;
}
