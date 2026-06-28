import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { syncInternationalMatches2026 } from "../lib/sync/leaguepedia-lck-2026.ts";
import { SEASON_2026_TOURNAMENTS } from "../lib/tournaments/season-2026.ts";

function loadEnvFile() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = valueParts.join("=");
    }
  } catch {
    // env vars already set
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  loadEnvFile();

  const mode = process.argv.includes("--full") ? "full" : "incremental";

  console.log(`국제대회 동기화 시작 (모드: ${mode})`);
  console.log(
    `대상: ${SEASON_2026_TOURNAMENTS.filter((t) => t.category === "international")
      .map((t) => t.name)
      .join(", ")}`,
  );

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const summary = await syncInternationalMatches2026(supabase, {
    mode,
    initialDelayMs: mode === "full" ? 5000 : 0,
    onRetry: (waitMs) => {
      console.warn(`Rate limited. Retrying in ${waitMs}ms...`);
    },
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
