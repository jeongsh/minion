import Link from "next/link";
import type { ReactNode } from "react";

import { PageHeader } from "@/components/ui/page-header";

export function PolicyPage({
  title,
  description,
  effectiveDate,
  children,
}: {
  title: string;
  description: string;
  effectiveDate: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen text-[var(--ui-text)]">
      <div className="layout-wide max-w-4xl pb-20 pt-6 sm:pt-10">
        <PageHeader title={title} breadcrumbs={[{ label: "정책", href: "/policies" }, { label: title }]} />
        <div className="mt-6 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-5 sm:p-6">
          <p className="text-[12px] font-medium leading-5 text-[var(--ui-text)] md:text-[13px] md:leading-[1.625rem] lg:text-sm lg:leading-6">{description}</p>
          <p className="mt-2 text-[11px] text-[var(--ui-muted)] md:text-xs lg:text-[13px]">시행일: {effectiveDate}</p>
        </div>
        <article className="policy-content mt-8 flex flex-col gap-9 text-[13px] leading-[1.65] text-[var(--ui-text)] md:text-sm md:leading-[1.7] lg:text-[15px] lg:leading-7 [&_a]:font-semibold [&_a]:text-[var(--ui-ink)] [&_a]:underline [&_a]:underline-offset-4 [&_h2]:text-[17px] [&_h2]:font-black [&_h2]:tracking-tight [&_h2]:text-[var(--ui-ink)] md:[&_h2]:text-lg lg:[&_h2]:text-xl [&_h3]:mt-5 [&_h3]:font-bold [&_h3]:text-[var(--ui-ink)] [&_li]:pl-1 [&_p]:mt-3 [&_table]:mt-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[var(--ui-border)] [&_td]:p-3 [&_td]:align-top [&_th]:border [&_th]:border-[var(--ui-border)] [&_th]:bg-[var(--ui-surface-muted)] [&_th]:p-3 [&_th]:text-left [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
          {children}
        </article>
        <nav className="mt-12 flex flex-wrap gap-2 border-t border-[var(--ui-border)] pt-6 text-xs font-medium md:text-[13px] lg:text-sm" aria-label="정책 문서">
          <Link href="/privacy" className="rounded-full border border-[var(--ui-border)] px-4 py-2">개인정보처리방침</Link>
          <Link href="/terms" className="rounded-full border border-[var(--ui-border)] px-4 py-2">이용약관</Link>
          <Link href="/advertising" className="rounded-full border border-[var(--ui-border)] px-4 py-2">광고 및 제휴 문의</Link>
        </nav>
      </div>
    </main>
  );
}
