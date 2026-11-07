import { PageHeader } from "@/components/ui/page-header";
import { getSiteMetricsDashboard, getSiteMetricSourceConfig } from "@/lib/site-metrics";

import { MetricsDashboard } from "./metrics-dashboard";

export const dynamic = "force-dynamic";

export default async function AdminMetricsPage() {
  const dashboard = await getSiteMetricsDashboard();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <PageHeader
        title="사이트 지표"
        breadcrumbs={[{ label: "관리자", href: "/admin" }, { label: "사이트 지표" }]}
      />
      <MetricsDashboard dashboard={dashboard} configured={getSiteMetricSourceConfig()} />
    </main>
  );
}
