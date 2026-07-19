"use client";

import { useActionState, useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { INITIAL_PASSWORD_STATE } from "@/lib/auth/action-state";
import { changePasswordAction } from "@/lib/auth/actions";

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(
    changePasswordAction,
    INITIAL_PASSWORD_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // 성공 후에도 입력값이 남아 있으면 비밀번호가 화면에 계속 노출된다.
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      {/* 현재 비밀번호에는 minLength 를 걸지 않는다. 정책 이전에 만들어진 짧은
          비밀번호를 쓰는 계정이 변경 자체를 못 하게 되는 것을 막기 위함. */}
      <Field
        id="currentPassword"
        name="currentPassword"
        label="현재 비밀번호"
        autoComplete="current-password"
      />
      <Field
        id="newPassword"
        name="newPassword"
        label="새 비밀번호"
        autoComplete="new-password"
        minLength={6}
        hint="6자 이상 입력해주세요."
      />
      <Field
        id="confirmPassword"
        name="confirmPassword"
        label="새 비밀번호 확인"
        autoComplete="new-password"
        minLength={6}
      />

      {state.status !== "idle" && state.message ? (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className="text-sm"
          style={{ color: state.status === "error" ? "#dc2626" : "#16a34a" }}
        >
          {state.message}
        </p>
      ) : null}

      <Button type="submit" disabled={pending} className="h-11 self-start rounded-lg px-5 font-bold">
        {pending ? "변경 중..." : "비밀번호 변경"}
      </Button>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  autoComplete,
  minLength,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  minLength?: number;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        required
        minLength={minLength}
        className="min-h-11 rounded-lg border bg-[var(--ui-surface)] px-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[color-mix(in_srgb,var(--accent)_18%,transparent)]"
        style={{ borderColor: "var(--border)" }}
      />
      {hint ? (
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
