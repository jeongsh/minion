import Link from "next/link";

export default function NotFound() {
  return (
    <main className="layout-wide flex min-h-[60vh] flex-col justify-center py-16">
      <p className="text-sm font-semibold text-muted">404</p>
      <h1 className="mt-3 text-[28px] font-semibold">페이지를 찾을 수 없습니다.</h1>
      <Link
        href="/"
        className="mt-6 w-fit rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"
      >
        홈으로 이동
      </Link>
    </main>
  );
}
