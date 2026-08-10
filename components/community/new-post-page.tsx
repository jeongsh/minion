import { PostForm } from "@/components/community/post-form";
import { SurfacePanel } from "@/components/ui/surface-panel";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import { categoriesForScope, defaultCategory, type BoardScope } from "@/lib/community/boards";

export async function NewPostPage({ scope, initialCategory, initialTitle, teamId, teamSlug }: { scope: BoardScope; initialCategory?: string; initialTitle?: string; teamId?: string | null; teamSlug?: string }) {
  const categories = categoriesForScope(scope);
  const [canSetNotice, user] = await Promise.all([isCurrentUserAdmin(), getCurrentUser()]);
  const fallback = initialCategory && categories.some((category) => category.slug === initialCategory)
    ? initialCategory
    : defaultCategory(scope);

  return (
    <main className={scope === "team"
      ? "fan-page-container flex flex-col gap-5 py-7 md:py-9"
      : "layout-wide flex flex-col gap-5 py-6 sm:py-8"
    }>
      <SurfacePanel variant="section" className="mobile-full-bleed p-4 sm:mx-0 sm:p-8">
        <PostForm scope={scope} categories={categories} defaultCategory={fallback} initialTitle={initialTitle} teamId={teamId} teamSlug={teamSlug} canSetNotice={canSetNotice} isGuest={!user} />
      </SurfacePanel>
    </main>
  );
}
