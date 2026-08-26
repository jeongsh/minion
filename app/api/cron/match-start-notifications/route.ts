import { runMatchStartNotificationAutomation } from "@/lib/notify/match-start-automation";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runMatchStartNotificationAutomation();
    return Response.json({ ok: true, ...summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown automation error";
    console.error("[match-start-notifications]", error);
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
