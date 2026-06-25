import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { syncLckAwards } from "../lib/sync/leaguepedia-awards.ts";

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

  const fromYearArg = process.argv.find((a) => a.startsWith("--from-year="))?.split("=")[1];
  const fromYear = fromYearArg ? parseInt(fromYearArg, 10) : 2012;
  const force = process.argv.includes("--force");

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  console.log(`LCK Awards 동기화 시작 (from: ${fromYear}, force: ${force})`);

  const summary = await syncLckAwards(supabase, {
    fromYear,
    force,
    onRetry: (waitMs) => {
      console.warn(`Rate limited. Retrying in ${waitMs}ms...`);
    },
    onProgress: (message) => {
      console.log(message);
    },
  });

  console.log("\n=== 결과 ===");
  console.log(`조회: ${summary.fetched}건`);
  console.log(`추가: ${summary.inserted}건`);
  if (summary.skipped.length > 0) {
    console.log(`스킵: ${summary.skipped.length}건`);
    for (const s of summary.skipped) {
      console.log(`  - [${s.reason}] ${s.tournament} ${s.place}위 ${s.team}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
