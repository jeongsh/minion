"use client";

import { useState, useTransition } from "react";

import { useToast } from "@/components/ui/toast";
import type { AdminSupportInquiry } from "@/lib/data/support-admin";

import { replySupportInquiryAction, updateSupportInquiryStatusAction } from "./actions";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const STATUS_LABEL = { open: "미처리", answered: "답변완료", closed: "종료" } as const;
const STATUS_TONE = {
  open: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  answered: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  closed: "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300",
} as const;

export function SupportInquiryRow({ inquiry }: { inquiry: AdminSupportInquiry }) {
  const { showToast } = useToast();
  const [reply, setReply] = useState(inquiry.reply ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function copyEmail(email: string) {
    navigator.clipboard.writeText(email)
      .then(() => showToast({ title: "이메일 복사됨", description: email, tone: "success" }))
      .catch(() => showToast({ title: "복사 실패", description: "클립보드에 접근하지 못했어요.", tone: "error" }));
  }

  function submitReply() {
    setError(null);
    startTransition(async () => {
      const result = await replySupportInquiryAction(inquiry.id, reply);
      if (!result.ok) setError(result.error ?? "답변 등록에 실패했어요.");
    });
  }

  function setStatus(status: "open" | "closed") {
    setError(null);
    startTransition(async () => {
      const result = await updateSupportInquiryStatusAction(inquiry.id, status);
      if (!result.ok) setError(result.error ?? "처리에 실패했어요.");
    });
  }

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-700">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[12px] font-medium ${STATUS_TONE[inquiry.status]}`}>
          {STATUS_LABEL[inquiry.status]}
        </span>
        {inquiry.isPrivate ? (
          <span className="shrink-0 rounded-full bg-neutral-200 px-2 py-0.5 text-[12px] font-medium text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
            비공개
          </span>
        ) : null}
        <span className="text-[13px] font-medium text-neutral-500">
          {inquiry.authorNickname ?? "비회원"}
          {inquiry.contactEmail ? (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => copyEmail(inquiry.contactEmail!)}
                title="클릭해서 이메일 복사"
                className="underline decoration-dotted underline-offset-2 hover:text-neutral-900 dark:hover:text-white"
              >
                {inquiry.contactEmail}
              </button>
            </>
          ) : null}
          {" · "}{formatDate(inquiry.createdAt)}
        </span>
      </div>

      <div>
        <p className="font-semibold">{inquiry.subject}</p>
        <p className="mt-1 whitespace-pre-wrap text-[13px] text-neutral-600 dark:text-neutral-300">{inquiry.message}</p>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800/50">
        <label className="text-[12px] font-semibold text-neutral-500">이용자에게 보이는 답변</label>
        <textarea
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          rows={3}
          placeholder="답변을 입력하면 이용자가 고객센터 페이지에서 바로 확인할 수 있어요."
          className="resize-none rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-[13px] leading-5 dark:border-neutral-600 dark:bg-neutral-900"
        />
        <button
          type="button"
          disabled={pending || !reply.trim()}
          onClick={submitReply}
          className="self-end rounded-lg bg-neutral-900 px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {inquiry.reply ? "답변 수정" : "답변 등록"}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {inquiry.status !== "closed" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("closed")}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[13px] font-semibold text-neutral-700 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-200"
          >
            종료
          </button>
        ) : null}
        {inquiry.status !== "open" ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => setStatus("open")}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-[13px] font-semibold text-neutral-700 disabled:opacity-50 dark:border-neutral-600 dark:text-neutral-200"
          >
            미처리로 되돌리기
          </button>
        ) : null}
      </div>

      {error ? <p className="text-[12px] font-medium text-red-500">{error}</p> : null}
    </li>
  );
}
