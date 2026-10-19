import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { PostForm } from "@/components/community/post-form";
import { PostFormLayout } from "@/components/community/post-form-layout";
import { getCurrentUser } from "@/lib/auth/current-user";
import { categoriesForScope } from "@/lib/community/boards";
import { getExistingGuestKey } from "@/lib/community/guest-identity";
import { getPostById } from "@/lib/data/community";
import { getUserMiniconPacks } from "@/lib/data/minicons";
import { canManageStudioContent } from "@/lib/community/ai-studio-management";

export const metadata: Metadata = { title: "글 수정", robots: { index: false } };

export default async function EditCommunityPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const [post, user, guestKey] = await Promise.all([getPostById(postId), getCurrentUser(), getExistingGuestKey()]);
  const isGuestOwner = Boolean(post?.guestKey && !post.authorId && post.guestKey === guestKey);
  if (!user && !isGuestOwner) redirect(`/login?next=/community/post/${postId}/edit`);
  if (!post || post.siteScope !== "hub" || (post.authorId !== user?.id && !isGuestOwner && !await canManageStudioContent(post))) notFound();
  const miniconPacks = await getUserMiniconPacks(user?.id);

  return (
    <PostFormLayout scope="hub">
      <PostForm scope="hub" categories={categoriesForScope("hub")} defaultCategory={post.boardType} postId={post.id} initialTitle={post.title} initialContent={post.content} isGuest={isGuestOwner} miniconPacks={miniconPacks} />
    </PostFormLayout>
  );
}
