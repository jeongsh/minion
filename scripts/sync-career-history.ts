import { createClient } from "@supabase/supabase-js";
import { syncCareerHistories } from "../lib/sync/leaguepedia-career-history.ts";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("환경 변수 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const skipExisting = !process.argv.includes("--all");
console.log(`경력 이력 동기화 시작... (skipExisting=${skipExisting})`);
if (skipExisting) {
  console.log("  ※ 이미 경력 데이터가 있는 선수는 건너뜁니다. 전체 재동기화: --all");
}

const summary = await syncCareerHistories(supabase, { skipExisting });

console.log("\n=== 동기화 완료 ===");
console.log(`처리됨: ${summary.playersProcessed}명`);
console.log(`건너뜀: ${summary.playersSkipped}명 (기존 데이터 있음)`);
console.log(`저장된 경력: ${summary.recordsInserted}개`);
if (summary.errors.length > 0) {
  console.log(`오류 ${summary.errors.length}건:`);
  for (const e of summary.errors) {
    console.log(`  - ${e.player}: ${e.reason}`);
  }
}
