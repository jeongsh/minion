import Link from "next/link";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SectionHeader } from "@/components/layout/section-header";
import { requireAdmin } from "@/lib/auth/admin";
import { createUserAction } from "../actions";

export const dynamic = "force-dynamic";
type Props = { searchParams: Promise<{ error?: string }> };

export default async function NewAdminUserPage({ searchParams }: Props) {
  await requireAdmin();
  const { error } = await searchParams;
  return <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-[var(--page-inline)] py-10">
    <div className="flex flex-col gap-2"><Breadcrumb items={[{ label: "관리자", href: "/admin" }, { label: "유저 관리", href: "/admin/users" }, { label: "유저 초대" }]} /><SectionHeader title="유저 초대" /></div>
    <p className="text-sm text-muted">입력한 이메일로 계정 설정 링크를 보냅니다.</p>
    {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : null}
    <form action={createUserAction} className="flex flex-col gap-4 rounded-xl border border-[var(--ui-border)] p-5">
      <label className="flex flex-col gap-2 text-sm font-medium">이메일<input required type="email" name="email" autoComplete="email" className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 font-normal" /></label>
      <label className="flex flex-col gap-2 text-sm font-medium">닉네임<input required name="nickname" minLength={2} maxLength={16} className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 font-normal" /></label>
      <div className="flex justify-end gap-3"><Link href="/admin/users" className="rounded-lg border border-[var(--ui-border)] px-4 py-2.5 text-sm font-medium">취소</Link><button className="rounded-lg bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">초대 메일 보내기</button></div>
    </form>
  </main>;
}
