import { CommunityRules } from "@/components/community/community-rules";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "커뮤니티 이용 규칙" };

export default function CommunityRulesPage() {
  return (
    <main className="subpage community-neutral min-h-screen !bg-[var(--ui-surface)]">
      <div className="layout-wide flex max-w-3xl flex-col gap-5 py-6 sm:py-8">
        <PageHeader
          eyebrow="COMMUNITY"
          title="이용 규칙"
          breadcrumbs={[{ label: "커뮤니티", href: "/community" }, { label: "이용 규칙" }]}
        />
        <CommunityRules />
      </div>
    </main>
  );
}
