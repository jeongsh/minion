import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

type Position = "TOP" | "JGL" | "MID" | "BOT" | "SUP";

type InternationalRosterManifest = {
  events: Array<{
    event: "first-stand" | "msi" | "ewc" | "worlds" | string;
    sourceUrl?: string;
    teams: Array<{
      name: string;
      shortName?: string;
      region?: string;
      league?: string;
      leaguepediaPage?: string;
      players?: Array<{
        name: string;
        realName?: string;
        position: Position;
        nationality?: string;
        leaguepediaPage?: string;
      }>;
    }>;
  }>;
};

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");

  try {
    const content = readFileSync(envPath, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) {
        process.env[key] = valueParts.join("=");
      }
    }
  } catch {
    // .env.local is optional when the script is executed with env vars already set.
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function readManifest(filePath: string): InternationalRosterManifest {
  if (!existsSync(filePath)) {
    throw new Error(
      `Roster manifest not found: ${filePath}\n` +
        "Create data/international-rosters-2026.json or pass a manifest path, e.g.:\n" +
        "npm run sync:international-rosters -- data/international-rosters-2026.example.json",
    );
  }

  const manifest = JSON.parse(readFileSync(filePath, "utf8")) as InternationalRosterManifest;

  if (!Array.isArray(manifest.events)) {
    throw new Error("Manifest must contain an events array.");
  }

  return manifest;
}

async function main() {
  loadEnvFile();

  const dryRun = process.argv.includes("--dry-run");
  const manifestArg = process.argv.find((arg) => !arg.startsWith("--") && arg !== process.argv[0] && arg !== process.argv[1]);
  const manifestPath = resolve(
    process.cwd(),
    manifestArg ?? "data/international-rosters-2026.json",
  );
  const manifest = readManifest(manifestPath);
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );

  const summary = {
    teamsCreatedOrUpdated: 0,
    playersCreatedOrUpdated: 0,
    skipped: [] as Array<{ name: string; reason: string }>,
  };

  for (const event of manifest.events) {
    for (const team of event.teams) {
      const slug = slugify(team.leaguepediaPage ?? team.name);
      if (!slug) {
        summary.skipped.push({ name: team.name, reason: "invalid_team_slug" });
        continue;
      }

      if (dryRun) {
        summary.teamsCreatedOrUpdated += 1;
        summary.playersCreatedOrUpdated += team.players?.length ?? 0;
        continue;
      }

      // 기존 팀은 수동 관리 필드(primary/secondary_color, 로고 등)를 절대 덮어쓰지 않는다.
      // 과거 무조건 upsert 방식이 관리자가 넣어둔 팀 색상을 기본 회색으로 리셋하는 사고가 있었다.
      const { data: existingTeam, error: existingError } = await supabase
        .from("teams")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (existingError) {
        throw existingError;
      }

      let teamRow: { id: string };
      if (existingTeam) {
        const { data, error: updateError } = await supabase
          .from("teams")
          .update({
            name: team.name,
            short_name: team.shortName ?? team.name,
            leaguepedia_page: team.leaguepediaPage ?? team.name,
            source_team_id: `lp:${team.leaguepediaPage ?? team.name}`,
            is_active: true,
          })
          .eq("id", existingTeam.id)
          .select("id")
          .single();
        if (updateError) {
          throw updateError;
        }
        teamRow = data;
      } else {
        const { data, error: insertError } = await supabase
          .from("teams")
          .insert({
            slug,
            name: team.name,
            short_name: team.shortName ?? team.name,
            primary_color: "#52525B",
            secondary_color: "#18181B",
            fan_site_host: null,
            leaguepedia_page: team.leaguepediaPage ?? team.name,
            source_team_id: `lp:${team.leaguepediaPage ?? team.name}`,
            is_lck_team: false,
            imported_scope: "international_event",
            is_active: true,
          })
          .select("id")
          .single();
        if (insertError) {
          throw insertError;
        }
        teamRow = data;
      }
      summary.teamsCreatedOrUpdated += 1;

      for (const player of team.players ?? []) {
        const playerSlug = slugify(player.leaguepediaPage ?? player.name);
        if (!playerSlug) {
          summary.skipped.push({ name: player.name, reason: "invalid_player_slug" });
          continue;
        }

        const { error: playerError } = await supabase.from("players").upsert(
          {
            slug: playerSlug,
            name: player.name,
            real_name: player.realName ?? null,
            team_id: teamRow.id,
            position: player.position,
            nationality: player.nationality ?? null,
            leaguepedia_page: player.leaguepediaPage ?? player.name,
            source_player_id: `lp:${player.leaguepediaPage ?? player.name}`,
            is_lck_player: false,
            imported_scope: "international_event",
            is_active: true,
          },
          { onConflict: "slug" },
        );

        if (playerError) {
          throw playerError;
        }
        summary.playersCreatedOrUpdated += 1;
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
