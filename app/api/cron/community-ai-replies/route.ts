import { processAutomaticStudioReplies } from "@/lib/community/ai-studio-replies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await processAutomaticStudioReplies();
    return Response.json({ ok: summary.deferred === 0, ...summary });
  } catch {
    console.error("[ai-studio] automatic reply cron failed");
    return Response.json({ ok: false, error: "automatic_reply_processing_failed" }, { status: 500 });
  }
}
