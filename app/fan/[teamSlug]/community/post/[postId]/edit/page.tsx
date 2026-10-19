import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PostForm } from "@/components/community/post-form";
import { PostFormLayout } from "@/components/community/post-form-layout";
import { getCurrentUser } from "@/lib/auth/current-user";
import { categoriesForScope } from "@/lib/community/boards";
import { getExistingGuestKey } from "@/lib/community/guest-identity";
import { getPostById } from "@/lib/data/community";
import { getTeamByFanSiteHost, getTeamBySlug } from "@/lib/data/lck";
import { getUserMiniconPacks } from "@/lib/data/minicons";
import { canManageStudioContent } from "@/lib/community/ai-studio-management";

export const metadata: Metadata = { title: "글 수정", robots: { index: false } };

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
  if (!team || !post || post.siteScope !== "team" || post.teamId !== team.id || (post.authorId !== user?.id && !isGuestOwner && !await canManageStudioContent(post))) notFound();
  const miniconPacks = await getUserMiniconPacks(user?.id);

  return (
    <PostFormLayout scope="team">
      <PostForm scope="team" categories={categoriesForScope("team")} defaultCategory={post.boardType} teamId={team.id} teamSlug={teamSlug} postId={post.id} initialTitle={post.title} initialContent={post.content} isGuest={isGuestOwner} miniconPacks={miniconPacks} />
    </PostFormLayout>
  );
}
