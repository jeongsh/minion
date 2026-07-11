import { PostForm } from "@/components/community/post-form";
import { PageHeader } from "@/components/ui/page-header";
import { SurfacePanel } from "@/components/ui/surface-panel";
import { categoriesForScope, defaultCategory, type BoardScope } from "@/lib/community/boards";

export function NewPostPage({ scope, initialCategory, teamId, teamSlug }: { scope: BoardScope; initialCategory?: string; teamId?: string | null; teamSlug?: string }) {
  const categories = categoriesForScope(scope);
  const fallback = initialCategory && categories.some((category) => category.slug === initialCategory)
    ? initialCategory
    : defaultCategory(scope);

  return (
    <main className={scope === "team"
      ? "fan-page-container flex flex-col gap-5 py-7 md:py-9"
      : "mx-auto flex w-full max-w-[1400px] flex-col gap-5 px-10 py-8 max-md:px-5"
    }>
      <PageHeader
        title="글쓰기"
        breadcrumbs={[
          {
            label: "커뮤니티",
            href: scope === "team" && teamSlug ? `/fan/${teamSlug}/community` : "/community",
          },
          { label: "글쓰기" },
        ]}
      />
      <SurfacePanel className="p-5 sm:p-8">
        <PostForm scope={scope} categories={categories} defaultCategory={fallback} teamId={teamId} teamSlug={teamSlug} />
      </SurfacePanel>
    </main>
  );
}
