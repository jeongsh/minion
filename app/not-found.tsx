import Link from "next/link";
import { KitschEmptyState } from "@/components/ui/kitsch-empty-state";

export default function NotFound() {
  return (
    <main className="layout-reading flex min-h-[60vh] flex-col justify-center py-16">
      <p className="text-sm font-semibold text-[var(--ui-muted)]">404</p>
      <KitschEmptyState
        character="megapon"
        title="앗, 이 페이지는 맵 밖이에요"
        body="주소를 다시 확인하거나 홈에서 새 루트를 잡아보세요."
        animated
        action={
          <Link
            href="/"
            className="inline-flex min-h-10 items-center rounded-lg bg-accent px-4 text-sm font-bold text-accent-foreground"
          >
            홈으로 이동
          </Link>
        }
        className="mt-4"
      />
    </main>
  );
}
