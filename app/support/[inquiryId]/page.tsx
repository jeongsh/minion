import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { SupportDetail } from "@/components/support/support-detail";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSupportInquiryDetail } from "@/lib/data/support";

// 본인만 보는 1:1 문의 상세. 검색 색인 대상 아님.
export const metadata: Metadata = { title: "문의 상세", robots: { index: false } };

export default async function SupportInquiryPage({
  params,
}: {
  params: Promise<{ inquiryId: string }>;
}) {
  const { inquiryId } = await params;
  const user = await getCurrentUser();
  const detail = await getSupportInquiryDetail(inquiryId, user?.id ?? null);
  if (!detail) notFound();

  return (
    <main className="min-h-screen text-[var(--ui-text)]">
      <div className="layout-wide max-w-4xl pb-20 pt-6 sm:pt-10">
        <Link href="/support" className="inline-flex items-center gap-1 text-sm font-normal text-[var(--tp)] hover:opacity-70">
          <ArrowLeft size={16} strokeWidth={2} />목록으로
        </Link>
        <div className="mt-4">
          <PageHeader title="문의 상세" />
        </div>
        <div className="mt-8">
          <SupportDetail detail={detail} />
        </div>
      </div>
    </main>
  );
}
