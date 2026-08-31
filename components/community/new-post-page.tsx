import { PostForm } from "@/components/community/post-form";
import { SurfacePanel } from "@/components/ui/surface-panel";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { getCurrentUser } from "@/lib/auth/current-user";
import { categoriesForScope, defaultCategory, type BoardScope } from "@/lib/community/boards";
import { getUserMiniconPacks } from "@/lib/data/minicons";

export async function NewPostPage({ scope, initialCategory, initialTitle, teamId, teamSlug }: { scope: BoardScope; initialCategory?: string; initialTitle?: string; teamId?: string | null; teamSlug?: string }) {
  const categories = categoriesForScope(scope);
  const [canSetNotice, user] = await Promise.all([isCurrentUserAdmin(), getCurrentUser()]);
  const miniconPacks = await getUserMiniconPacks(user?.id);
  const fallback = initialCategory && categories.some((category) => category.slug === initialCategory)
    ? initialCategory
    : defaultCategory(scope);

  return (
    <main
      className={scope === "team"
        ? "fan-page-container flex min-h-[calc(100svh-48px)] flex-col gap-5 py-0 md:min-h-0 md:py-9"
        : "layout-wide flex min-h-[calc(100svh-48px)] flex-col gap-5 py-0 md:min-h-0 md:py-8"
      }
    >
      <SurfacePanel variant="section" className="mobile-full-bleed !overflow-visible rounded-none border-0 bg-transparent p-4 pb-[calc(72px+env(safe-area-inset-bottom))] md:mx-0 md:!overflow-hidden md:rounded-[var(--ui-card-radius)] md:border md:bg-[var(--ui-surface)] md:p-8">
        <PostForm
          scope={scope}
          categories={categories}
          defaultCategory={fallback}
          initialTitle={initialTitle}
          teamId={teamId}
          teamSlug={teamSlug}
          canSetNotice={canSetNotice}
          isGuest={!user}
          miniconPacks={miniconPacks}
        />
      </SurfacePanel>
    </main>
  );
}
