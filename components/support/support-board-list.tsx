import { Lock, MessageSquarePlus } from "lucide-react";
import Link from "next/link";

import { Pagination } from "@/components/ui/pagination";
import type { SupportBoardPage } from "@/lib/data/support";

const STATUS_LABEL = { open: "답변 대기", answered: "답변완료", closed: "종료" } as const;
const STATUS_CLASS = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  answered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  closed: "bg-[var(--ui-surface-muted)] text-[var(--ui-muted)]",
} as const;

function formatDate(value: string) {
  // 웹 목록은 "2026.08.28 17:29"처럼 연 4자리 + 24시간제로 보여준다. locale 기본
  // 구분자(점+공백, 끝점, 오전/오후)에 기대지 않도록 parts를 직접 뽑아 조립한다.
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")} ${get("hour")}:${get("minute")}`;
}

export function SupportBoardList({ board }: { board: SupportBoardPage }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[17px] font-black tracking-tight text-[var(--ui-ink)]">문의 게시판</h2>
        <Link
          href="/support/new"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--ui-control-radius)] bg-[var(--ui-ink)] px-3.5 text-[13px] font-semibold text-[var(--ui-surface)] transition-opacity hover:opacity-85"
        >
          <MessageSquarePlus size={15} strokeWidth={2} />문의하기
        </Link>
      </div>

      {board.items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--ui-border)] py-14 text-center text-[13px] text-[var(--ui-muted)]">
          아직 등록된 문의가 없어요.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-[var(--ui-card-radius)] border border-[var(--ui-border)] bg-[var(--ui-surface)]">
          {board.items.map((item) => (
            <li key={item.id} className="relative border-b border-[var(--ui-border)] last:border-b-0">
              <Link
                href={`/support/${item.id}`}
                className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--tp)]"
                aria-label={`${item.subject} 보기`}
              />
              <div className="pointer-events-none relative z-[1] flex min-h-[58px] items-center gap-3 px-3 py-2.5 sm:px-4">
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium ${STATUS_CLASS[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  {item.isPrivate ? <Lock size={13} strokeWidth={1.8} className="shrink-0 text-[var(--ui-muted)]" /> : null}
                  <span className="truncate text-[14px] font-medium text-[var(--ui-ink)] sm:text-base">
                    {item.subject}
                  </span>
                </div>
                <span className="hidden shrink-0 text-[13px] text-[var(--ui-muted)] sm:inline">{item.authorLabel}</span>
                <span className="shrink-0 text-[12px] text-[var(--ui-muted)]">{formatDate(item.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {board.totalPages > 1 ? (
        <Pagination page={board.page} totalPages={board.totalPages} getHref={(page) => (page > 1 ? `/support?page=${page}` : "/support")} />
      ) : null}
    </div>
  );
}
