import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { syncCareerHistories } from "../lib/sync/leaguepedia-career-history.ts";

try {
  const content = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...rest] = trimmed.split("=");
    if (!process.env[key]) process.env[key] = rest.join("=");
  }
} catch { /* .env.local 없으면 무시 */ }

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("환경 변수 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log("경력 이력 동기화 시작... (기존 레코드는 유지, 새 정보만 추가)");

const summary = await syncCareerHistories(supabase, {
  onProgress: (msg) => console.log(msg),
});

console.log("\n=== 동기화 완료 ===");
console.log(`처리됨: ${summary.playersProcessed}명`);
console.log(`스킵 (변경 없음): ${summary.playersSkipped}명`);
console.log(`신규 저장: ${summary.recordsInserted}개`);
if (summary.errors.length > 0) {
  console.log(`오류 ${summary.errors.length}건:`);
  for (const e of summary.errors) {
    console.log(`  - ${e.player}: ${e.reason}`);
  }
}
