import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-5xl flex-col justify-center px-[var(--page-inline)] py-16">
      <p className="text-sm font-semibold text-muted">404</p>
      <h1 className="mt-3 text-3xl font-semibold">페이지를 찾을 수 없습니다.</h1>
      <Link
        href="/"
        className="mt-6 w-fit rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
      >
        홈으로 이동
      </Link>
    </main>
  );
}
