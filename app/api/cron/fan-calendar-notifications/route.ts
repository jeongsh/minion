import { processDueFanCalendarSubmissionNotifications } from "@/lib/calendar/submission-notifications";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await processDueFanCalendarSubmissionNotifications();
    return Response.json({
      ok: summary.deferred === 0,
      ...summary,
    });
  } catch {
    console.error("[fan-calendar] notification cron failed");
    return Response.json(
      { ok: false, error: "fan_calendar_notification_processing_failed" },
      { status: 500 },
    );
  }
}
