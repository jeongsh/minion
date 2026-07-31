import Link from "next/link";
import { ErrorState } from "@/components/ui/error-state";

export default function NotFound() {
  return (
    <main className="layout-reading flex min-h-[65vh] items-center py-12 sm:py-16">
      <ErrorState
        code="Error 404"
        title="앗, 이 페이지는 맵 밖이에요"
        body="주소가 바뀌었거나 페이지가 잠깐 자리를 비웠어요. 홈에서 새로운 이야기를 찾아볼까요?"
        action={
          <>
            <Link
              href="/"
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-5 text-sm font-bold text-accent-foreground transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              홈으로 돌아가기
            </Link>
            <Link
              href="/community"
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[var(--ui-border)] px-5 text-sm font-bold text-[var(--ui-ink)] transition hover:border-accent/40 hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              커뮤니티 둘러보기
            </Link>
          </>
        }
      />
    </main>
  );
}
