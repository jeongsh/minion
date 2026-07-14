import { notFound, redirect } from "next/navigation";

import { PostForm } from "@/components/community/post-form";
import { SurfacePanel } from "@/components/ui/surface-panel";
import { getCurrentUser } from "@/lib/auth/current-user";
import { categoriesForScope } from "@/lib/community/boards";
import { getPostById } from "@/lib/data/community";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";

export default async function EditFanPostPage({ params }: { params: Promise<{ teamSlug: string; postId: string }> }) {
  const { teamSlug, postId } = await params;
  const [post, user, team] = await Promise.all([
    getPostById(postId),
    getCurrentUser(),
    getTeamByFanSiteHost(teamSlug).then((value) => value ?? getTeamBySlug(teamSlug)),
  ]);
  if (!user) redirect(`/login?next=/fan/${teamSlug}/community/post/${postId}/edit`);
  if (!team || !post || post.siteScope !== "team" || post.teamId !== team.id || post.authorId !== user.id) notFound();

  return (
    <main className="community-neutral fan-page-container flex flex-col gap-5 py-7 md:py-9">
      <SurfacePanel className="p-5 sm:p-8">
        <PostForm scope="team" categories={categoriesForScope("team")} defaultCategory={post.boardType} teamId={team.id} teamSlug={teamSlug} postId={post.id} initialTitle={post.title} initialContent={post.content} />
      </SurfacePanel>
    </main>
  );
}
