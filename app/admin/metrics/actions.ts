"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/admin";
import { refreshSiteMetrics, type SiteMetricSourceResult } from "@/lib/site-metrics";

export async function refreshSiteMetricsAction(): Promise<SiteMetricSourceResult[]> {
  await requireAdmin();
  const results = await refreshSiteMetrics();
  revalidatePath("/admin/metrics");
  // 설정 누락 안내에는 환경변수 이름만 담겨 있어 관리자 화면에 그대로 보여도 된다.
  return results;
}
