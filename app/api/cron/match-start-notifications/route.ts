import { runPredictionResultNotificationAutomation } from "@/lib/notifications/prediction-results";
import { runMatchStartNotificationAutomation } from "@/lib/notify/match-start-automation";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  // 예측 결과 알림은 같은 1분 크론에 얹는다. 한쪽이 실패해도 다른 쪽 발송은 막지 않는다.
  const predictionResults = await runPredictionResultNotificationAutomation().catch((error) => {
    console.error("[prediction-result-notifications]", error);
    return null;
  });

  try {
    const summary = await runMatchStartNotificationAutomation();
    return Response.json({ ok: true, ...summary, predictionResults });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown automation error";
    console.error("[match-start-notifications]", error);
    return Response.json({ ok: false, error: message, predictionResults }, { status: 500 });
  }
}
