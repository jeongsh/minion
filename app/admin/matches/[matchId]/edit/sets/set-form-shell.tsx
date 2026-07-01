"use client";

import { useEffect, useRef, useState } from "react";

const FORM_ID = "set-editor-form";
const POLL_INTERVAL_MS = 400;

function serializeForm(form: HTMLFormElement) {
  const entries: string[] = [];
  new FormData(form).forEach((value, key) => {
    entries.push(`${key}=${typeof value === "string" ? value : value.name}`);
  });
  return entries.join("&");
}

export function SetFormShell({
  action,
  submitLabel,
  children,
}: {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  children: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const baselineRef = useRef<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    // 폼 값 스냅샷을 주기적으로 비교한다. 챔피언 피커처럼 React state로 hidden
    // input을 갱신하는 하위 컴포넌트는 change/input 이벤트가 버블링되지 않아서
    // 이벤트 리스너만으로는 변경을 놓친다 — 값 비교라 확실히 잡는다.
    // 기준값은 마운트 직후가 아니라 첫 tick에서 잡는다: 하위 클라이언트 컴포넌트가
    // 마운트 이후 자체 이펙트로 hidden input을 한 번 더 갱신하는 경우가 있어서,
    // 그 갱신이 끝나기 전에 스냅샷을 뜨면 아무 것도 안 바꿨는데 dirty로 오판된다.
    let hasBaseline = false;
    const interval = setInterval(() => {
      if (!formRef.current) return;
      const current = serializeForm(formRef.current);
      if (!hasBaseline) {
        baselineRef.current = current;
        hasBaseline = true;
        return;
      }
      setDirty(current !== baselineRef.current);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <form ref={formRef} id={FORM_ID} action={action} className="contents">
        {children}
      </form>
      <div className="sticky bottom-4 z-20 mt-2 flex items-center justify-end gap-3 rounded-md border border-border bg-surface p-3 shadow-lg">
        {dirty ? <span className="text-sm text-muted">저장되지 않은 변경사항이 있습니다</span> : null}
        <button
          type="button"
          disabled={!dirty}
          onClick={() => window.location.reload()}
          className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          되돌리기
        </button>
        <button
          type="submit"
          form={FORM_ID}
          disabled={!dirty}
          className="rounded-md bg-foreground px-5 py-2.5 text-sm font-semibold text-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </>
  );
}
