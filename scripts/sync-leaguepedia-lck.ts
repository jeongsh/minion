import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { syncLeaguepediaLck2026 } from "../lib/sync/leaguepedia-lck-2026.ts";
import { syncMatchDataForRecentCompletedMatches } from "../lib/sync/match-data-bulk.ts";
import { SEASON_2025_TOURNAMENTS } from "../lib/tournaments/season-2025.ts";
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

  const yearArg = process.argv.find((a) => a.startsWith("--year="))?.split("=")[1];
  const year = yearArg ? parseInt(yearArg, 10) : new Date().getFullYear();
  const mode = process.argv.includes("--full") ? "full" : "incremental";

  const tournaments =
    year === 2025 ? SEASON_2025_TOURNAMENTS :
    year === 2026 ? SEASON_2026_TOURNAMENTS :
    null;

  if (!tournaments) {
    console.error(`지원하지 않는 연도: ${year} (지원: 2025, 2026)`);
    process.exit(1);
  }

  console.log(`LCK ${year} 동기화 시작 (모드: ${mode})`);

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const summary = await syncLeaguepediaLck2026(supabase, {
    mode,
    tournaments,
    initialDelayMs: mode === "full" ? 5000 : 0,
    onRetry: (waitMs) => {
      console.warn(`Rate limited. Retrying in ${waitMs}ms...`);
    },
  });

  console.log(JSON.stringify(summary, null, 2));

  // 일정 동기화는 스코어/일정만 채운다. 세트 결과·밴픽·선수 스탯·타임라인(골드 그래프)·
  // 공식 POM은 매치별로 따로 동기화해야 했는데, 최근 종료된 경기에 한해 여기서 이어서
  // 자동으로 채워준다(관리자가 매치마다 "경기 데이터 동기화" 버튼을 눌러줄 필요 없게).
  console.log("최근 종료 경기 데이터(세트/타임라인/POM) 동기화 시작");
  const matchDataSummary = await syncMatchDataForRecentCompletedMatches(supabase, {
    onProgress: (message) => console.log(message),
  });
  console.log(JSON.stringify(matchDataSummary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
