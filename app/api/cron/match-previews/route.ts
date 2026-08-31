import { refreshMissingUpcomingMatchAiPreviews } from "@/lib/match-preview-ai";
import { cleanupStaleMiniconUploads } from "@/lib/minicons/cleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [previewResult, cleanupResult] = await Promise.allSettled([
      refreshMissingUpcomingMatchAiPreviews({
        concurrency: 3,
        limit: 3,
      }),
      cleanupStaleMiniconUploads(),
    ]);

    if (previewResult.status === "rejected") throw previewResult.reason;
    const summary = previewResult.value;
    const miniconCleanup = cleanupResult.status === "fulfilled"
      ? cleanupResult.value
      : { error: cleanupResult.reason instanceof Error ? cleanupResult.reason.message : "Unknown minicon cleanup error" };
    if (cleanupResult.status === "rejected") {
      console.error("[minicons] upload cleanup cron failed", cleanupResult.reason);
    }
    const ok = summary.failed.length === 0 && cleanupResult.status === "fulfilled";
    return Response.json({
      ok,
      ...summary,
      miniconCleanup,
    }, { status: ok ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown match preview automation error";
    console.error("[match-ai-preview]", error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
