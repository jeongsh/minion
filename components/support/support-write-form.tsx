"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { submitSupportInquiryAction } from "@/lib/support/actions";

const MESSAGE_MAX = 2000;

export function SupportWriteForm({ defaultEmail, isGuest }: { defaultEmail?: string | null; isGuest: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [contactEmail, setContactEmail] = useState(defaultEmail ?? "");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // 로그인 작성자는 비공개 글을 볼 때 계정만으로 자동 통과하니 비밀번호 자체를 받지 않는다
  // (선택도 아님). 비회원은 계정이 없어 비밀번호가 유일한 잠금 수단이라 필수다.
  const showPasswordFields = isPrivate && isGuest;
  const passwordMismatch = showPasswordFields && password.length > 0 && password !== passwordConfirm;
  const passwordTooShort = showPasswordFields && password.length > 0 && password.length < 4;
  const canSubmit =
    subject.trim() &&
    message.trim() &&
    !(isGuest && !contactEmail.trim()) &&
    !(showPasswordFields && (!password || passwordTooShort || passwordMismatch));

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (showPasswordFields && password !== passwordConfirm) {
      setError("비밀번호가 서로 달라요.");
      return;
    }
    startTransition(async () => {
      const result = await submitSupportInquiryAction({ contactEmail, subject, message, isPrivate, password });
      if (result.ok && result.id) {
        showToast({ title: "문의 접수 완료", description: "게시판에서 답변을 확인할 수 있어요.", tone: "success" });
        router.push(`/support/${result.id}`);
      } else {
        setError(result.error ?? "문의 접수에 실패했어요.");
        showToast({ title: "접수 실패", description: result.error, tone: "error" });
      }
    });
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="support-email" className="text-[13px] font-semibold text-[var(--ui-ink)]">
          연락 이메일{" "}
          {isGuest ? null : <span className="font-normal text-[var(--ui-muted)]">(선택)</span>}
        </label>
        <input
          id="support-email"
          type="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          required={isGuest}
          placeholder="you@example.com"
          className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5 text-[14px] text-[var(--ui-text)] outline-none focus:border-[var(--ui-muted)]"
        />
        <p className="text-[12px] text-[var(--ui-muted)]">
          {isGuest ? "비회원은 문의를 다시 찾을 수 있도록 이메일이 꼭 필요해요." : "게시판 글의 답변으로 확인할 수 있어요."}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="support-subject" className="text-[13px] font-semibold text-[var(--ui-ink)]">
          제목
        </label>
        <input
          id="support-subject"
          type="text"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          required
          maxLength={100}
          placeholder="문의 제목을 입력해주세요."
          className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5 text-[14px] text-[var(--ui-text)] outline-none focus:border-[var(--ui-muted)]"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="support-message" className="text-[13px] font-semibold text-[var(--ui-ink)]">
          내용
        </label>
        <textarea
          id="support-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          rows={7}
          maxLength={MESSAGE_MAX}
          placeholder="문의 유형(버그 신고, 계정 문의, 신고 처리 결과, 기타 등)과 문제가 발생한 페이지, 구체적인 상황을 알려주시면 빠르게 확인할 수 있어요."
          className="resize-none rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] px-3 py-2.5 text-[14px] leading-6 text-[var(--ui-text)] outline-none focus:border-[var(--ui-muted)]"
        />
        <span className="self-end text-[12px] tabular-nums text-[var(--ui-muted)]">
          {message.length.toLocaleString("ko-KR")}/{MESSAGE_MAX.toLocaleString("ko-KR")}자
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4">
        <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ui-ink)]">
          <input
            type="checkbox"
            checked={isPrivate}
            onChange={(event) => {
              setIsPrivate(event.target.checked);
              if (!event.target.checked) {
                setPassword("");
                setPasswordConfirm("");
              }
            }}
            className="h-4 w-4 rounded border-[var(--ui-border)]"
          />
          비공개로 작성 (비밀번호로만 열람)
        </label>
        <p className="text-[12px] text-[var(--ui-muted)]">
          {isGuest
            ? "체크하면 비밀번호를 아는 사람만 내용을 볼 수 있어요. 체크하지 않으면 누구나 이 게시판에서 제목과 내용을 볼 수 있어요."
            : "체크하면 로그인한 본인 계정으로만 볼 수 있어요(비밀번호 없이 자동으로 확인돼요). 체크하지 않으면 누구나 이 게시판에서 제목과 내용을 볼 수 있어요."}
        </p>

        {showPasswordFields ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="support-password" className="text-[12px] font-semibold text-[var(--ui-ink)]">비밀번호</label>
              <input
                id="support-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={4}
                maxLength={32}
                placeholder="4자 이상"
                className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 text-[14px] text-[var(--ui-text)] outline-none focus:border-[var(--ui-muted)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="support-password-confirm" className="text-[12px] font-semibold text-[var(--ui-ink)]">비밀번호 확인</label>
              <input
                id="support-password-confirm"
                type="password"
                value={passwordConfirm}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                required
                maxLength={32}
                placeholder="다시 입력"
                className="rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 text-[14px] text-[var(--ui-text)] outline-none focus:border-[var(--ui-muted)]"
              />
            </div>
            {passwordTooShort ? <p className="text-[12px] font-medium text-red-500 sm:col-span-2">비밀번호는 4자 이상이어야 해요.</p> : null}
            {passwordMismatch ? <p className="text-[12px] font-medium text-red-500 sm:col-span-2">비밀번호가 서로 달라요.</p> : null}
          </div>
        ) : null}
      </div>

      {error ? <p className="text-[13px] font-medium text-red-500">{error}</p> : null}

      <Button type="submit" disabled={pending || !canSubmit} className="self-end">
        {pending ? "접수 중" : "접수하기"}
      </Button>
    </form>
  );
}
