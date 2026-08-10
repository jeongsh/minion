import { notFound, redirect } from "next/navigation";

import { PostForm } from "@/components/community/post-form";
import { SurfacePanel } from "@/components/ui/surface-panel";
import { getCurrentUser } from "@/lib/auth/current-user";
import { categoriesForScope } from "@/lib/community/boards";
import { getPostById } from "@/lib/data/community";

export default async function EditCommunityPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;
  const [post, user] = await Promise.all([getPostById(postId), getCurrentUser()]);
  if (!user) redirect(`/login?next=/community/post/${postId}/edit`);
  if (!post || post.siteScope !== "hub" || post.authorId !== user.id) notFound();

  return (
    <main className="layout-wide subpage flex min-h-screen flex-col gap-5 py-6 sm:py-8">
      <SurfacePanel variant="section" className="mobile-full-bleed p-4 sm:mx-0 sm:p-8">
        <PostForm scope="hub" categories={categoriesForScope("hub")} defaultCategory={post.boardType} postId={post.id} initialTitle={post.title} initialContent={post.content} />
      </SurfacePanel>
    </main>
  );
}
