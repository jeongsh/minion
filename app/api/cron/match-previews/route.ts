import { refreshMissingUpcomingMatchAiPreviews } from "@/lib/match-preview-ai";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await refreshMissingUpcomingMatchAiPreviews({
      concurrency: 3,
      limit: 3,
    });
    return Response.json({
      ok: summary.failed.length === 0,
      ...summary,
    }, { status: summary.failed.length === 0 ? 200 : 500 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown match preview automation error";
    console.error("[match-ai-preview]", error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
