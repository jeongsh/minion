import { refreshSiteMetrics } from "@/lib/site-metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const results = await refreshSiteMetrics();
  // 연결하지 않은 소스는 실패로 보지 않는다.
  const ok = results.every((result) => result.status !== "error");
  return Response.json({ ok, results }, { status: ok ? 200 : 500 });
}
