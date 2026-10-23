// node --env-file=.env.local --experimental-strip-types scripts/backfill-match-briefing-snapshots.ts [--write] [--all]
// 기본값은 예정 경기의 누락 자료만 수집하는 dry run. OpenAI는 호출하지 않는다.
import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import { fetchLeaguepediaBriefingRows } from "../lib/sync/leaguepedia-briefing.ts";
import { createMatchBriefingSnapshot } from "../lib/match-briefing-data.ts";
import { backfillMatchBriefingSnapshot } from "../lib/data/match-briefing-snapshot.ts";
import { parsePowerRankings, type MatchPowerRankings } from "../lib/power-rankings.ts";
import type { Match } from "../lib/types.ts";

const admin = createSupabaseAdminClient();
const { data: previews, error: previewError } = await admin.from("match_ai_previews").select("match_id,content");
if (previewError) throw previewError;
const ids = (previews ?? []).filter((item) => !item.content?.briefingData).map((item) => item.match_id);
if (!ids.length) {
  console.log("보충할 프리뷰 자료 없음");
  process.exit(0);
}
let query = admin.from("matches").select("id,match_date,team_a_id,team_b_id").in("id", ids).order("match_date");
if (!process.argv.includes("--all")) query = query.eq("status", "scheduled");
const { data: matches, error: matchError } = await query;
if (matchError) throw matchError;
const teamIds = [...new Set((matches ?? []).flatMap((match) => [match.team_a_id, match.team_b_id]))];
const { data: teams, error: teamError } = await admin.from("teams").select("id,leaguepedia_page,source_team_id").in("id", teamIds);
if (teamError) throw teamError;
const rankings = new Map<number, MatchPowerRankings>();
for (const row of matches ?? []) {
  const match = { id: row.id, matchDate: row.match_date, teamAId: row.team_a_id, teamBId: row.team_b_id } as Match;
  const pages = [match.teamAId, match.teamBId].map((id) => {
    const team = teams?.find((item) => item.id === id);
    const page = team?.leaguepedia_page || team?.source_team_id?.replace(/^lp:/, "");
    if (!page) throw new Error(`Leaguepedia 팀 페이지 없음: ${id}`);
    return page as string;
  });
  const rows = [];
  for (const page of pages) rows.push(await fetchLeaguepediaBriefingRows(page, match.matchDate));
  const year = new Date(match.matchDate).getUTCFullYear();
  if (!rankings.has(year)) {
    const sourceUrl = `https://lolesports.com/en-US/gpr/${year}/current`;
    const response = await fetch(sourceUrl, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`파워랭킹 응답 ${response.status}`);
    rankings.set(year, { status: "ready", sourceUrl, teams: parsePowerRankings(await response.text()) });
  }
  const snapshot = createMatchBriefingSnapshot(match, rows, rankings.get(year)!);
  const saved = process.argv.includes("--write") ? await backfillMatchBriefingSnapshot(snapshot) : false;
  console.log(JSON.stringify({ matchId: match.id, pages, saved, bytes: Buffer.byteLength(JSON.stringify(snapshot)) }));
}
