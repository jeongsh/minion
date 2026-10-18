import { PostForm } from "@/components/community/post-form";
import { PostFormLayout } from "@/components/community/post-form-layout";
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
    <PostFormLayout scope={scope}>
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
    </PostFormLayout>
  );
}
