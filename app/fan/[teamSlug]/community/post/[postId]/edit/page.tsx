import { notFound, redirect } from "next/navigation";

import { PostForm } from "@/components/community/post-form";
import { SurfacePanel } from "@/components/ui/surface-panel";
import { getCurrentUser } from "@/lib/auth/current-user";
import { categoriesForScope } from "@/lib/community/boards";
import { getExistingGuestKey } from "@/lib/community/guest-identity";
import { getPostById } from "@/lib/data/community";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import { getUserMiniconPacks } from "@/lib/data/minicons";

export default async function EditFanPostPage({ params }: { params: Promise<{ teamSlug: string; postId: string }> }) {
  const { teamSlug, postId } = await params;
  const [post, user, team, guestKey] = await Promise.all([
    getPostById(postId),
    getCurrentUser(),
    getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug)),
    getExistingGuestKey(),
  ]);
  const isGuestOwner = Boolean(post?.guestKey && !post.authorId && post.guestKey === guestKey);
  if (!user && !isGuestOwner) redirect(`/login?next=/fan/${teamSlug}/community/post/${postId}/edit`);
  if (!team || !post || post.siteScope !== "team" || post.teamId !== team.id || (post.authorId !== user?.id && !isGuestOwner)) notFound();
  const miniconPacks = await getUserMiniconPacks(user?.id);

  return (
    <main className="community-neutral fan-page-container flex flex-col gap-5 py-7 md:py-9">
      <SurfacePanel variant="section" className="mobile-full-bleed p-4 sm:mx-0 sm:p-8">
        <PostForm scope="team" categories={categoriesForScope("team")} defaultCategory={post.boardType} teamId={team.id} teamSlug={teamSlug} postId={post.id} initialTitle={post.title} initialContent={post.content} isGuest={isGuestOwner} miniconPacks={miniconPacks} />
      </SurfacePanel>
    </main>
  );
}
