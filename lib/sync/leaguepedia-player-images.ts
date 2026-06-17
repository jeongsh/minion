import type { SupabaseClient } from "@supabase/supabase-js";

import { leaguepediaImageFilename, resolveLeaguepediaImageUrls } from "./leaguepedia-images.ts";
import {
  isValidPlayerImageFilename,
  pickProfileImageFilename,
  type PlayerImageCandidate,
} from "./leaguepedia-player-image-source.ts";

const CARGO_API = "https://lol.fandom.com/api.php";
const USER_AGENT = "LCKHubMinion/0.1 (player image sync; contact: local-dev)";
const REQUEST_DELAY_MS = 3000;
const MAX_RETRIES = 10;
const CARGO_CHUNK_SIZE = 40;

const PLAYER_IMAGE_FIELDS = "PI.Link,PI.FileName,PI.IsProfileImage,PI.SortDate,PI.Tournament";

type PlayerRow = {
  id: string;
  name: string;
  leaguepedia_page: string | null;
  profile_image_url: string | null;
};

type PlayerRedirectRow = {
  OverviewPage?: string;
  AllName?: string;
};

type PlayerImageFieldRow = {
  ID?: string;
  Image?: string;
};

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

async function fetchPlayerImagesByPages(pageNames: string[]) {
  const result = new Map<string, string>();

  for (let index = 0; index < pageNames.length; index += CARGO_CHUNK_SIZE) {
    const chunk = pageNames.slice(index, index + CARGO_CHUNK_SIZE);
    const escaped = chunk.map((name) => name.replace(/'/g, "\\'"));

    const playerRows = await cargoQuery<PlayerImageFieldRow>({
      tables: "Players",
      fields: "ID,Image",
      where: `ID IN ('${escaped.join("','")}')`,
      limit: String(CARGO_CHUNK_SIZE + 10),
    });

    const playerImageByPage = new Map(
      playerRows
        .map((row) => [row.ID?.trim(), row.Image?.trim()] as const)
        .filter(([page, image]) => !!page && isValidPlayerImageFilename(image)),
    );

    const imageRows = await cargoQuery<PlayerImageCandidate>({
      tables: "PlayerImages=PI",
      fields: PLAYER_IMAGE_FIELDS,
      where: `PI.Link IN ('${escaped.join("','")}')`,
      limit: "500",
    });

    for (const page of chunk) {
      const best = pickProfileImageFilename(playerImageByPage.get(page), imageRows, [page]);
      if (best) result.set(page, best);
    }

    const missing = chunk.filter((name) => !result.has(name));
    if (missing.length > 0) {
      const missingEscaped = missing.map((name) => name.replace(/'/g, "\\'"));
      const redirectRows = await cargoQuery<PlayerRedirectRow>({
        tables: "PlayerRedirects=PR",
        fields: "PR.OverviewPage,PR.AllName",
        where: `PR.OverviewPage IN ('${missingEscaped.join("','")}')`,
        limit: "500",
      });

      const redirectNamesByOverview = new Map<string, string[]>();
      for (const redirect of redirectRows) {
        const overviewPage = redirect.OverviewPage?.trim();
        const allName = redirect.AllName?.trim();
        if (!overviewPage || !allName) continue;
        const names = redirectNamesByOverview.get(overviewPage) ?? [];
        names.push(allName);
        redirectNamesByOverview.set(overviewPage, names);
      }

      const redirectNames = [
        ...new Set([...redirectNamesByOverview.values()].flat()),
      ];
      if (redirectNames.length > 0) {
        const redirectEscaped = redirectNames.map((name) => name.replace(/'/g, "\\'"));
        const redirectImages = await cargoQuery<PlayerImageCandidate>({
          tables: "PlayerImages=PI",
          fields: PLAYER_IMAGE_FIELDS,
          where: `PI.Link IN ('${redirectEscaped.join("','")}')`,
          limit: "500",
        });

        for (const [overviewPage, names] of redirectNamesByOverview) {
          const best = pickProfileImageFilename(
            playerImageByPage.get(overviewPage),
            redirectImages,
            names,
          );
          if (best) result.set(overviewPage, best);
        }
      }
    }
  }

  return result;
}

export type PlayerImageSyncSummary = {
  playersChecked: number;
  imagesFetched: number;
  playersUpdated: number;
  skipped: Array<{ player: string; reason: string }>;
};

export async function syncPlayerProfileImages(
  supabase: SupabaseClient,
  options: {
    onlyMissing?: boolean;
    onProgress?: (message: string) => void;
  } = {},
): Promise<PlayerImageSyncSummary> {
  const onlyMissing = options.onlyMissing ?? true;
  const { onProgress } = options;

  const { data, error } = await supabase
    .from("players")
    .select("id, name, leaguepedia_page, profile_image_url")
    .not("leaguepedia_page", "is", null)
    .neq("leaguepedia_page", "");

  if (error) throw error;

  const players = ((data ?? []) as PlayerRow[]).filter(
    (player) => !onlyMissing || !player.profile_image_url?.trim(),
  );
  const summary: PlayerImageSyncSummary = {
    playersChecked: players.length,
    imagesFetched: 0,
    playersUpdated: 0,
    skipped: [],
  };

  if (players.length === 0) {
    onProgress?.("No players need profile image sync.");
    return summary;
  }

  onProgress?.(`Fetching Leaguepedia images for ${players.length} player(s)...`);

  const pageNames = [...new Set(players.map((player) => player.leaguepedia_page!).filter(Boolean))];
  const imageByPage = await fetchPlayerImagesByPages(pageNames);
  summary.imagesFetched = imageByPage.size;

  const imageUrls = await resolveLeaguepediaImageUrls([...imageByPage.values()], {
    onRetry: (waitMs) => {
      console.warn(`Image URL rate limited. Retrying in ${waitMs}ms...`);
    },
  });

  for (const player of players) {
    const page = player.leaguepedia_page?.trim();
    if (!page) {
      summary.skipped.push({ player: player.name, reason: "missing_leaguepedia_page" });
      continue;
    }

    const imageFilename = imageByPage.get(page);
    if (!imageFilename) {
      summary.skipped.push({ player: player.name, reason: "no_image_in_leaguepedia" });
      continue;
    }

    const normalizedFilename = leaguepediaImageFilename(imageFilename);
    const profileImageUrl = normalizedFilename ? imageUrls.get(normalizedFilename) ?? null : null;

    if (!profileImageUrl) {
      summary.skipped.push({ player: player.name, reason: "image_url_unresolved" });
      continue;
    }

    const { error: updateError } = await supabase
      .from("players")
      .update({ profile_image_url: profileImageUrl })
      .eq("id", player.id);

    if (updateError) throw updateError;
    summary.playersUpdated++;
  }

  onProgress?.(`Updated ${summary.playersUpdated} player profile image(s).`);
  return summary;
}
