import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeSocialUrl, type PlayerSocialField } from "../player-social.ts";

const CARGO_API = "https://lol.fandom.com/api.php";
const USER_AGENT = "LCKHubMinion/0.1 (player social sync; contact: local-dev)";
const REQUEST_DELAY_MS = 3000;
const MAX_RETRIES = 10;
const CARGO_CHUNK_SIZE = 40;

type CargoPlayerSocialRow = {
  ID?: string;
  Twitter?: string;
  Instagram?: string;
  Youtube?: string;
  Facebook?: string;
  Discord?: string;
  Stream?: string;
};

const FIELD_MAP: Array<{ cargo: keyof CargoPlayerSocialRow; db: string; kind: PlayerSocialField }> = [
  { cargo: "Twitter", db: "twitter_url", kind: "twitterUrl" },
  { cargo: "Instagram", db: "instagram_url", kind: "instagramUrl" },
  { cargo: "Youtube", db: "youtube_url", kind: "youtubeUrl" },
  { cargo: "Facebook", db: "facebook_url", kind: "facebookUrl" },
  { cargo: "Discord", db: "discord_url", kind: "discordUrl" },
  { cargo: "Stream", db: "stream_url", kind: "streamUrl" },
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function cargoQuery<T extends Record<string, string | undefined>>(params: Record<string, string>) {
  const searchParams = new URLSearchParams({
    action: "cargoquery",
    format: "json",
    ...params,
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const response = await fetch(`${CARGO_API}?${searchParams}`, {
      headers: { "user-agent": USER_AGENT },
    });

    if (!response.ok) {
      throw new Error(`Leaguepedia fetch failed: ${response.status}`);
    }

    const body = (await response.json()) as {
      cargoquery?: Array<{ title: T }>;
      error?: { code?: string; info?: string };
    };

    if (body.error?.code === "ratelimited") {
      const waitMs = Math.min((attempt + 1) * 20_000, 120_000);
      console.warn(`Rate limited. Retrying in ${waitMs}ms...`);
      await sleep(waitMs);
      continue;
    }

    if (body.error) {
      throw new Error(`Cargo error [${body.error.code}]: ${body.error.info}`);
    }

    await sleep(REQUEST_DELAY_MS);
    return (body.cargoquery ?? []).map((entry) => entry.title);
  }

  throw new Error("Leaguepedia cargo query: rate limit retries exhausted.");
}

async function fetchPlayerSocialByPages(pageNames: string[]) {
  const result = new Map<string, Record<string, string | null>>();

  for (let index = 0; index < pageNames.length; index += CARGO_CHUNK_SIZE) {
    const chunk = pageNames.slice(index, index + CARGO_CHUNK_SIZE);
    const escaped = chunk.map((name) => name.replace(/'/g, "\\'"));
    const rows = await cargoQuery<CargoPlayerSocialRow>({
      tables: "Players",
      fields: "ID,Twitter,Instagram,Youtube,Facebook,Discord,Stream",
      where: `ID IN ('${escaped.join("','")}')`,
      limit: String(CARGO_CHUNK_SIZE + 10),
    });

    for (const row of rows) {
      const page = row.ID?.trim();
      if (!page) continue;

      const payload: Record<string, string | null> = {};
      for (const { cargo, db, kind } of FIELD_MAP) {
        payload[db] = normalizeSocialUrl(row[cargo], kind);
      }
      result.set(page, payload);
    }
  }

  return result;
}

export type PlayerSocialSyncSummary = {
  playersChecked: number;
  playersUpdated: number;
  skipped: Array<{ player: string; reason: string }>;
};

export async function syncPlayerSocialLinks(
  supabase: SupabaseClient,
  options: {
    playerIds?: string[];
    onProgress?: (message: string) => void;
  } = {},
): Promise<PlayerSocialSyncSummary> {
  let query = supabase
    .from("players")
    .select("id, name, leaguepedia_page")
    .not("leaguepedia_page", "is", null)
    .neq("leaguepedia_page", "");

  if (options.playerIds?.length) {
    query = query.in("id", options.playerIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const players = data ?? [];
  const summary: PlayerSocialSyncSummary = {
    playersChecked: players.length,
    playersUpdated: 0,
    skipped: [],
  };

  if (players.length === 0) {
    options.onProgress?.("No players with Leaguepedia page found.");
    return summary;
  }

  options.onProgress?.(`Fetching Leaguepedia SNS for ${players.length} player(s)...`);

  const pageNames = [...new Set(players.map((player) => player.leaguepedia_page!).filter(Boolean))];
  const socialByPage = await fetchPlayerSocialByPages(pageNames);

  for (const player of players) {
    const page = player.leaguepedia_page?.trim();
    if (!page) {
      summary.skipped.push({ player: player.name, reason: "missing_leaguepedia_page" });
      continue;
    }

    const social = socialByPage.get(page);
    if (!social) {
      summary.skipped.push({ player: player.name, reason: "no_social_in_leaguepedia" });
      continue;
    }

    const hasAny = Object.values(social).some(Boolean);
    if (!hasAny) {
      summary.skipped.push({ player: player.name, reason: "empty_social_fields" });
      continue;
    }

    const { error: updateError } = await supabase.from("players").update(social).eq("id", player.id);
    if (updateError) throw updateError;
    summary.playersUpdated++;
  }

  options.onProgress?.(`Updated SNS for ${summary.playersUpdated} player(s).`);
  return summary;
}

export async function fetchPlayerSocialForPage(pageName: string) {
  const map = await fetchPlayerSocialByPages([pageName]);
  return map.get(pageName) ?? null;
}
