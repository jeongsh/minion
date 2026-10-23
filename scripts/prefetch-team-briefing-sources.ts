// node --env-file=.env.local --experimental-strip-types scripts/prefetch-team-briefing-sources.ts [--write] [--days=14] [--teams=AL,ML]
// 2주 안에 경기가 잡힌 비LCK 팀의 최근 20세트 이상을 미리 저장하고, 비LCK 팀의 지역을 채운다. 기본값은 대상만 출력하는 dry run.
// 이후 갱신은 /api/cron/match-previews가 12시간 주기로 맡는다.
import { createSupabaseAdminClient } from "../lib/supabase/admin.ts";
import { fillMissingTeamRegions, storeTeamBriefingSource } from "../lib/sync/team-briefing-source.ts";

const write = process.argv.includes("--write");
const only = process.argv.find((arg) => arg.startsWith("--teams="))?.slice(8).split(",").filter(Boolean);
const days = Number(process.argv.find((arg) => arg.startsWith("--days="))?.slice(7) ?? 14);
const admin = createSupabaseAdminClient();
const now = Date.now();
const { data: matches, error: matchError } = await admin.from("matches").select("team_a_id,team_b_id")
  .neq("status", "completed")
  .gte("match_date", new Date(now - 6 * 60 * 60 * 1_000).toISOString())
  .lt("match_date", new Date(now + days * 24 * 60 * 60 * 1_000).toISOString());
if (matchError) throw matchError;
const teamIds = [...new Set((matches ?? []).flatMap((match) => [match.team_a_id, match.team_b_id]).filter(Boolean))];
const { data: teams, error: teamError } = await admin.from("teams").select("id,short_name,leaguepedia_page,source_team_id,is_lck_team").in("id", teamIds);
if (teamError) throw teamError;
const targets = (teams ?? []).filter((team) => !team.is_lck_team && (!only || only.includes(team.short_name)))
  .map((team) => ({ ...team, page: team.leaguepedia_page || team.source_team_id?.replace(/^lp:/, "") || null }));

for (const team of targets) {
  if (!team.page) {
    console.log(`${team.short_name}: Leaguepedia 페이지 없음`);
    continue;
  }
  if (!write) {
    console.log(`${team.short_name}: ${team.page} 수집 예정`);
    continue;
  }
  try {
    const result = await storeTeamBriefingSource(admin, team.id, team.page);
    console.log(`${team.short_name}: ${result.sets}세트, 게임 ${result.games}, 선수 기록 ${result.players}`);
  } catch (error) {
    console.error(`${team.short_name}: 실패`, error instanceof Error ? error.message : error);
  }
}

if (write) console.log(`지역 보충: ${await fillMissingTeamRegions(admin)}팀`);
