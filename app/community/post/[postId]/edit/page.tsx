import { notFound, redirect } from "next/navigation";

import { PostForm } from "@/components/community/post-form";
import { PageHeader } from "@/components/ui/page-header";
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
    <main className="subpage mx-auto flex min-h-screen w-full max-w-[1400px] flex-col gap-5 bg-[var(--ui-surface)] px-10 py-8 max-md:px-5">
      <PageHeader eyebrow="COMMUNITY" title="게시글 수정" />
      <SurfacePanel className="p-5 sm:p-8">
        <PostForm scope="hub" categories={categoriesForScope("hub")} defaultCategory={post.boardType} postId={post.id} initialTitle={post.title} initialContent={post.content} />
      </SurfacePanel>
    </main>
  );
}
