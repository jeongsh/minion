import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import { kstWeekStart, selectWeeklyFanHeaders } from "../lib/sync/fan-header-selection.ts";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

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
    // .env.local is optional when env vars are already set.
  }
}

async function main() {
  loadEnvFile();
  const supabase = createSupabaseAdminClient();
  const weekStart = kstWeekStart();

  if (dryRun) {
    // 확정하지 않고 각 팀의 현재 1위만 출력한다.
    const { data: teams } = await supabase.from("teams").select("id, short_name");
    for (const team of teams ?? []) {
      const { data: winner } = await supabase
        .from("fan_header_candidates")
        .select("id, vote_count")
        .eq("team_id", team.id)
        .is("deleted_at", null)
        .is("blinded_at", null)
        .gt("vote_count", 0)
        .order("vote_count", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (winner) console.log(`[dry-run] ${team.short_name}: ${winner.id} (${winner.vote_count}표)`);
    }
    console.log(`[dry-run] week_start=${weekStart} — 아무것도 쓰지 않았습니다.`);
    return;
  }

  const selected = await selectWeeklyFanHeaders(supabase, weekStart);
  console.log(`[fan-headers] week_start=${weekStart}, 확정 ${selected.length}팀`);
  for (const item of selected) {
    console.log(`  ${item.teamId} → ${item.candidateId} (${item.voteCount}표)`);
  }
}

main().catch((error) => {
  console.error("[fan-headers]", error);
  process.exit(1);
});
