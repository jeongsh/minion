"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/ui/error-state";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <html lang="ko">
      <body className="m-0 bg-[var(--ui-bg)] text-[var(--ui-ink)]">
        <main className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-5 py-12 sm:px-8 sm:py-16">
          <ErrorState
            code="Critical Error"
            title="앱이 잠깐 삐끗했어요"
            body="페이지를 불러오지 못했어요. 잠시 후 다시 시도해주세요."
            digest={error.digest}
            action={
              <>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  다시 시도
                </button>
                <Link
                  href="/"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--ui-border)] px-5 text-sm font-bold text-[var(--ui-ink)] transition hover:border-accent/40 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  홈으로 돌아가기
                </Link>
              </>
            }
          />
        </main>
      </body>
    </html>
  );
}
