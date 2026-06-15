import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { syncLeaguepediaLck2026 } from "../lib/sync/leaguepedia-lck-2026.ts";
import { SEASON_2025_TOURNAMENTS } from "../lib/tournaments/season-2025.ts";

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
    // .env.local is optional when env vars are already set.
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

async function main() {
  loadEnvFile();

  const mode = process.argv.includes("--full") ? "full" : "incremental";
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

  const summary = await syncLeaguepediaLck2026(supabase, {
    mode,
    tournaments: SEASON_2025_TOURNAMENTS,
    initialDelayMs: mode === "full" ? 5000 : 0,
    onRetry: (waitMs) => {
      console.warn(`Rate limited by Leaguepedia. Retrying in ${waitMs}ms...`);
    },
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
