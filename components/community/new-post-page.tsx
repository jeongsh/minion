import { SectionHeader } from "@/components/layout/section-header";
import { PostForm } from "@/components/community/post-form";
import { categoriesForScope, defaultCategory, type BoardScope } from "@/lib/community/boards";

// 글 작성 페이지(허브/팀 공용). 말머리 선택 + 작성.
// initialCategory 가 유효한 말머리면 기본 선택값으로 사용(구 보드 링크 호환).
export function NewPostPage({
  scope,
  eyebrow,
  initialCategory,
  teamId,
  teamSlug,
}: {
  scope: BoardScope;
  eyebrow: string;
  initialCategory?: string;
  teamId?: string | null;
  teamSlug?: string;
}) {
  const categories = categoriesForScope(scope);
  const fallback =
    initialCategory && categories.some((c) => c.slug === initialCategory)
      ? initialCategory
      : defaultCategory(scope);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow={eyebrow} title="글쓰기" />
      <PostForm
        scope={scope}
        categories={categories}
        defaultCategory={fallback}
        teamId={teamId}
        teamSlug={teamSlug}
      />
    </main>
  );
}
