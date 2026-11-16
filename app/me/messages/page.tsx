import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { UnderlineNav } from "@/components/ui/tabs";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCommunityUserSummary } from "@/lib/data/community-users";
import { getMailbox } from "@/lib/messages/queries";
import { Mailbox } from "./mailbox";

export const metadata = { title: "쪽지함", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ box?: string; page?: string; to?: string }> }) {
  const user = await getCurrentUser();
  const params = await searchParams;
  const to = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.to ?? "") ? params.to : undefined;
  if (!user) redirect(`/login?next=${encodeURIComponent(`/me/messages${to ? `?to=${to}` : ""}`)}`);
  const box = params.box === "sent" ? "sent" : "inbox";
  const parsedPage = Number(params.page ?? 1);
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10000) : 1;
  const [mailbox, recipient] = await Promise.all([
    getMailbox(box, page),
    to && to !== user.id ? getCommunityUserSummary(to) : null,
  ]);
  return (
    <main className="layout-form space-y-5 py-5 sm:py-8">
      <PageHeader title="쪽지함" breadcrumbs={[{ label: "내 계정", href: "/me" }, { label: "쪽지함" }]} />
      <UnderlineNav ariaLabel="쪽지함" activeKey={box} items={[
        { key: "inbox", label: `받은 쪽지${mailbox.unread ? ` (${mailbox.unread})` : ""}`, href: "/me/messages" },
        { key: "sent", label: "보낸 쪽지", href: "/me/messages?box=sent" },
      ]} />
      {to && !recipient ? <p role="alert" className="text-base text-[var(--ui-muted)]">쪽지를 보낼 수 없는 사용자입니다.</p> : null}
      <Mailbox key={`${box}:${page}:${to ?? ""}`} box={box} messages={mailbox.messages} recipient={recipient ? { id: recipient.id, nickname: recipient.nickname } : null} />
      {mailbox.total > 20 || page > 1 ? (
        <nav aria-label="쪽지 페이지" className="flex min-h-11 items-center justify-center gap-5 text-sm font-medium">
          {page > 1 ? <Link href={`/me/messages?box=${box}&page=${page - 1}`}>이전</Link> : null}
          <span className="text-[var(--ui-muted)]">{page} / {Math.max(1, Math.ceil(mailbox.total / 20))}</span>
          {page * 20 < mailbox.total ? <Link href={`/me/messages?box=${box}&page=${page + 1}`}>다음</Link> : null}
        </nav>
      ) : null}
    </main>
  );
}
