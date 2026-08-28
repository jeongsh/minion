import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SupportWriteForm } from "@/components/support/support-write-form";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentUser } from "@/lib/auth/current-user";

export const metadata: Metadata = {
  title: "문의하기",
  description: "MINION 고객센터에 문의를 등록합니다.",
};

export default async function SupportNewPage() {
  const user = await getCurrentUser();

  return (
    <main className="min-h-screen text-[var(--ui-text)]">
      <div className="layout-wide max-w-4xl pb-20 pt-6 sm:pt-10">
        <Link href="/support" className="inline-flex items-center gap-1 text-sm font-normal text-[var(--tp)] hover:opacity-70">
          <ArrowLeft size={16} strokeWidth={2} />목록으로
        </Link>
        <div className="mt-4">
          <PageHeader title="문의하기" />
        </div>

        <div className="mt-8 flex flex-col gap-9 text-[13px] leading-[1.65] text-[var(--ui-text)] md:text-sm md:leading-[1.7] lg:text-[15px] lg:leading-7">
          <section>
            <h2 className="text-[17px] font-black tracking-tight text-[var(--ui-ink)]">문의할 때 알려주세요</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5">
              <li className="pl-1">문의 유형(버그 신고, 계정 문의, 신고 처리 결과, 기타 등)</li>
              <li className="pl-1">문제가 발생한 페이지 주소 또는 화면</li>
              <li className="pl-1">겪고 있는 문제에 대한 구체적인 설명</li>
            </ul>
          </section>
          <SupportWriteForm defaultEmail={user?.email} isGuest={!user} />
        </div>
      </div>
    </main>
  );
}
