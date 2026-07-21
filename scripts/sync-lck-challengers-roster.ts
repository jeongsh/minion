/**
 * LCK 각 팀의 2군(LCK CL/챌린저스) 로스터를 리그피디아에서 가져와 players 테이블에 반영한다.
 * imported_scope='challengers'로 표시되며, 공개 화면에는 노출되지 않고 어드민 선수 관리의
 * "2군" 토글에서만 보인다.
 *
 * 실행: npx tsx scripts/sync-lck-challengers-roster.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { syncLckChallengersRosters } from "../lib/sync/leaguepedia-challengers-roster.ts";

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
    // 이미 설정된 경우 무시
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  loadEnvFile();

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  const summary = await syncLckChallengersRosters(supabase, {
    onRetry: (waitMs) => console.log(`레이트리밋, ${waitMs}ms 대기 후 재시도...`),
  });

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
