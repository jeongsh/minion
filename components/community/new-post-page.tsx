import { PostForm } from "@/components/community/post-form";
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
      : "layout-wide flex flex-col gap-5 py-6 sm:py-8"
    }>
      <SurfacePanel className="p-5 sm:p-8">
        <PostForm scope={scope} categories={categories} defaultCategory={fallback} teamId={teamId} teamSlug={teamSlug} />
      </SurfacePanel>
    </main>
  );
}
