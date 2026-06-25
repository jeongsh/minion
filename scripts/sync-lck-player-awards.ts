import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { syncLckPlayerAwards } from "../lib/sync/liquipedia-lck-awards.ts";

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

  const yearsArg = process.argv.find((a) => a.startsWith("--years="))?.split("=")[1];
  const years = yearsArg
    ? yearsArg.split(",").map(Number)
    : [new Date().getFullYear()];
  const force = process.argv.includes("--force");

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  console.log(`LCK 개인 수상 동기화 시작 (연도: ${years.join(", ")}, force: ${force})`);

  const summary = await syncLckPlayerAwards(supabase, {
    years,
    force,
    onProgress: (msg) => console.log(msg),
  });

  console.log("\n=== 결과 ===");
  console.log(`처리 연도: ${summary.yearsProcessed.join(", ")}`);
  console.log(`추가: ${summary.inserted}건`);
  if (summary.skipped.length > 0) {
    console.log(`스킵: ${summary.skipped.length}건`);
    for (const s of summary.skipped) {
      console.log(`  - [${s.reason}] ${s.year} ${s.award} / ${s.player}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
