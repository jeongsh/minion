import { SectionHeader } from "@/components/layout/section-header";
import { PostForm } from "@/components/community/post-form";
import type { BoardScope } from "@/lib/community/boards";

// 글 작성 페이지(허브/팀 공용).
export function NewPostPage({
  scope,
  boardSlug,
  boardLabel,
  eyebrow,
  teamId,
  teamSlug,
}: {
  scope: BoardScope;
  boardSlug: string;
  boardLabel: string;
  eyebrow: string;
  teamId?: string | null;
  teamSlug?: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-[var(--page-inline)] py-10">
      <SectionHeader eyebrow={eyebrow} title={`${boardLabel} 글쓰기`} />
      <PostForm
        scope={scope}
        boardType={boardSlug}
        boardLabel={boardLabel}
        teamId={teamId}
        teamSlug={teamSlug}
      />
    </main>
  );
}
