"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DELETE_ACCOUNT_CONFIRM_TEXT,
  INITIAL_DELETE_ACCOUNT_STATE,
} from "@/lib/auth/action-state";
import { deleteAccountAction } from "@/lib/auth/actions";

export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState(
    deleteAccountAction,
    INITIAL_DELETE_ACCOUNT_STATE,
  );
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const confirmed = confirmText.trim() === DELETE_ACCOUNT_CONFIRM_TEXT;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px] leading-6" style={{ color: "var(--muted)" }}>
        탈퇴하면 티어·LP·출석 기록과 승부예측 내역이 모두 삭제되며 되돌릴 수
        없습니다. 작성한 게시글과 댓글은 커뮤니티에 남고 작성자만 알 수 없음으로
        표시됩니다. 같은 이메일로 다시 가입하더라도 이전 기록은 복구되지 않습니다.
      </p>

      {open ? (
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="deletePassword" className="text-sm font-semibold">
              비밀번호 확인
            </label>
            <input
              id="deletePassword"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="min-h-11 rounded-lg border bg-[var(--ui-surface)] px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
              style={{ borderColor: "var(--border)" }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirmText" className="text-sm font-semibold">
              확인 문구
            </label>
            <input
              id="confirmText"
              name="confirmText"
              type="text"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={DELETE_ACCOUNT_CONFIRM_TEXT}
              autoComplete="off"
              required
              className="min-h-11 rounded-lg border bg-[var(--ui-surface)] px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
              style={{ borderColor: "var(--border)" }}
            />
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>
              계속하려면 <b>{DELETE_ACCOUNT_CONFIRM_TEXT}</b>를 그대로 입력해주세요.
            </p>
          </div>

          {state.status === "error" && state.message ? (
            <p role="alert" className="text-sm" style={{ color: "#dc2626" }}>
              {state.message}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="danger"
              disabled={pending || !confirmed}
              className="h-11 rounded-lg px-5 font-bold"
            >
              {pending ? "탈퇴 처리 중..." : "회원 탈퇴"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={pending}
              className="h-11 rounded-lg px-5 font-bold"
              onClick={() => {
                setOpen(false);
                setConfirmText("");
              }}
            >
              취소
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="danger"
          className="h-11 self-start rounded-lg px-5 font-bold"
          onClick={() => setOpen(true)}
        >
          회원 탈퇴
        </Button>
      )}
    </div>
  );
}
