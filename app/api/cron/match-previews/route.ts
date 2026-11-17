import { matchBriefingSample } from "@/lib/match-briefing-stats";
import { refreshMissingUpcomingMatchAiPreviews } from "@/lib/match-preview-ai";
import { cleanupStaleMiniconUploads } from "@/lib/minicons/cleanup";
import { getAllTeams, getMatches, getPlayerBenchmarkStatLines, getSets } from "@/lib/data/lck";
import { refreshTeamBriefingSources } from "@/lib/data/team-briefing-sources";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 해외팀 최근 세트 수집은 Leaguepedia 요청 간격이 길어 프리뷰 생성과 병렬로 조금씩 갱신한다.
    const [previewResult, cleanupResult, sourceResult] = await Promise.allSettled([
      refreshMissingUpcomingMatchAiPreviews({
        concurrency: 3,
        limit: 3,
      }),
      cleanupStaleMiniconUploads(),
      Promise.all([getAllTeams(), getMatches(), getSets()])
        .then(async ([teams, matches, sets]) => {
          const now = Date.now();
          const upcoming = matches.filter(match => match.status !== "completed" && Date.parse(match.matchDate) > now - 6 * 3_600_000 && Date.parse(match.matchDate) < now + 14 * 86_400_000);
          if (!upcoming.length) return { candidates: 0, refreshed: [], failed: [] };
          const ids = [...new Set(upcoming.flatMap(match => matchBriefingSample(match, matches, sets).setIds))];
          const playerStats = await getPlayerBenchmarkStatLines(ids);
          return refreshTeamBriefingSources({ teams, matches, sets, playerStats });
        }),
    ]);

    if (previewResult.status === "rejected") throw previewResult.reason;
    const summary = previewResult.value;
    const miniconCleanup = cleanupResult.status === "fulfilled"
      ? cleanupResult.value
      : { error: cleanupResult.reason instanceof Error ? cleanupResult.reason.message : "Unknown minicon cleanup error" };
    if (cleanupResult.status === "rejected") {
      console.error("[minicons] upload cleanup cron failed", cleanupResult.reason);
    }
    const teamBriefingSources = sourceResult.status === "fulfilled"
      ? sourceResult.value
      : { error: sourceResult.reason instanceof Error ? sourceResult.reason.message : "Unknown team briefing source error" };
    if (sourceResult.status === "rejected") {
      console.error("[match-briefing] team source refresh failed", sourceResult.reason);
    }
    const ok = summary.failed.length === 0 && cleanupResult.status === "fulfilled";
    return Response.json({
      ok,
      ...summary,
      miniconCleanup,
      teamBriefingSources,
    }, { status: ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown match preview automation error";
    console.error("[match-ai-preview]", error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
