import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import {
  collectLeagueEvents,
  dateKeyKST,
  fetchSetVods,
  fetchVodThumbnail,
  loadLocalMatches,
  LOLESPORTS_LEAGUE_IDS,
  matchKey,
  type LolesportsEvent,
} from "../lib/sync/lolesports-vods.ts";

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

  const events: LolesportsEvent[] = [];
  for (const [league, leagueId] of Object.entries(LOLESPORTS_LEAGUE_IDS)) {
    try {
      const collected = await collectLeagueEvents(league, leagueId);
      console.log(`[lolesports] ${league}: ${collected.length} completed`);
      events.push(...collected);
    } catch (error) {
      console.error(`[error] ${league} ${(error as Error).message}`);
    }
  }

  const index = new Map<string, LolesportsEvent>();
  for (const event of events) {
    index.set(matchKey(dateKeyKST(event.startTime), event.teamCodes), event);
  }

  const matches = await loadLocalMatches(supabase);
  let linked = 0;
  let vodRows = 0;
  let setMisses = 0;
  let skipped = 0;
  const unmatched: string[] = [];

  for (const match of matches) {
    const key = matchKey(dateKeyKST(match.matchDate), match.teamCodes);
    const event = index.get(key);
    if (!event) {
      unmatched.push(match.label);
      continue;
    }

    linked += 1;

    if (!dryRun && match.lolesportsMatchId !== event.matchId) {
      const { error } = await supabase
        .from("matches")
        .update({ lolesports_match_id: event.matchId })
        .eq("id", match.id);
      if (error) throw error;
    }

    let vods;
    try {
      vods = await fetchSetVods(event.matchId);
    } catch (error) {
      console.error(`[error] vods ${match.label} ${(error as Error).message}`);
      continue;
    }
    if (vods.length === 0) continue;

    const { data: sets, error: setsError } = await supabase
      .from("sets")
      .select("id, set_number")
      .eq("match_id", match.id);
    if (setsError) throw setsError;

    const setByNumber = new Map((sets ?? []).map((row: { id: string; set_number: number }) => [row.set_number, row.id]));

    for (const vod of vods) {
      const setId = setByNumber.get(vod.setNumber);
      if (!setId) {
        setMisses += 1;
        continue;
      }

      if (dryRun) {
        vodRows += 1;
        continue;
      }

      const { error } = await supabase
        .from("sets")
        .update({
          vod_url: vod.url,
          vod_provider: vod.provider,
          vod_start_seconds: vod.startSeconds,
          vod_synced_at: new Date().toISOString(),
        })
        .eq("id", setId);

      // 승자 없이 finished 로 남은 기존 세트가 체크 제약에 걸린다.
      // VOD 동기화와 무관한 데이터 문제이므로 건너뛰고 계속 진행한다.
      if (error) {
        skipped += 1;
        console.warn(`[skip] ${match.label} set ${vod.setNumber}: ${error.message}`);
        continue;
      }

      vodRows += 1;
    }
  }

  // 썸네일이 아직 없는 세트를 채운다. VOD 페이지를 하나씩 읽어야 해서 별도 패스로 돈다.
  let thumbs = 0;
  if (!dryRun) {
    const { data: pending, error: pendingError } = await supabase
      .from("sets")
      .select("id, vod_url")
      .not("vod_url", "is", null)
      .is("vod_thumbnail_url", null);
    if (pendingError) throw pendingError;

    const queue = (pending ?? []) as Array<{ id: string; vod_url: string }>;
    console.log(`\n썸네일 수집 대상: ${queue.length}`);

    const CONCURRENCY = 6;
    for (let start = 0; start < queue.length; start += CONCURRENCY) {
      const batch = queue.slice(start, start + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (row) => ({ id: row.id, thumb: await fetchVodThumbnail(row.vod_url) })),
      );

      for (const { id, thumb } of results) {
        if (!thumb) continue;
        const { error } = await supabase.from("sets").update({ vod_thumbnail_url: thumb }).eq("id", id);
        if (!error) thumbs += 1;
      }

      if ((start / CONCURRENCY) % 20 === 0) {
        console.log(`  ... ${Math.min(start + CONCURRENCY, queue.length)}/${queue.length}`);
      }
    }
  }

  console.log("\n=== 결과 ===");
  console.log(`완료 경기: ${matches.length}`);
  console.log(`롤이스포츠 매칭: ${linked} (${((linked / matches.length) * 100).toFixed(1)}%)`);
  console.log(`VOD 연결된 세트: ${vodRows}`);
  console.log(`세트 번호 불일치로 건너뜀: ${setMisses}`);
  console.log(`쓰기 실패로 건너뜀: ${skipped}`);
  console.log(`썸네일 수집: ${thumbs}`);
  console.log(`미매칭 경기: ${unmatched.length}`);
  for (const label of unmatched.slice(0, 20)) console.log("  -", label);
  if (unmatched.length > 20) console.log(`  ... 외 ${unmatched.length - 20}건`);
  console.log(`\ndryRun=${dryRun}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
