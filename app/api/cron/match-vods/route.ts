import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { runMatchVodAutomation } from "@/lib/sync/match-vods";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const mode = new URL(request.url).searchParams.get("mode") === "backfill" ? "backfill" : "recent";

  try {
    const summary = await runMatchVodAutomation(createSupabaseAdminClient(), {
      lookbackHours: mode === "backfill" ? 24 * 30 : 48,
      minAgeHours: 3,
      limit: mode === "backfill" ? 12 : 8,
    });
    return Response.json({ ok: true, mode, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown VOD automation error";
    console.error("[match-vods]", error);
    return Response.json({ ok: false, mode, error: message }, { status: 500 });
  }
}
