import { AdminPagination } from "@/components/admin/pagination";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import { listSupportInquiries } from "@/lib/data/support-admin";

import { SupportInquiryRow } from "./inquiry-row";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page } = await searchParams;
  const listPage = await listSupportInquiries(page);
  const inquiries = listPage.rows;
  const openCount = listPage.totalCount;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <div className="flex flex-col gap-2">
        <Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "고객센터 문의" }]} />
        <SectionHeader title="고객센터 문의" />
      </div>

      <h2 className="text-lg font-bold">
        미처리 <span className="text-red-500">{openCount}</span>
      </h2>

      <AdminPagination pathname="/admin/support" {...listPage} />
      {inquiries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-300 py-10 text-center text-sm text-neutral-500 dark:border-neutral-700">
          접수된 문의가 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {inquiries.map((inquiry) => (
            <SupportInquiryRow key={inquiry.id} inquiry={inquiry} />
          ))}
        </ul>
      )}
    </main>
  );
}
