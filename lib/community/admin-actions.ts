"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/admin";
import type { BoardScope } from "@/lib/community/boards";
import { setPostNotice } from "@/lib/data/community-admin";

function communityIndexPath(scope: BoardScope, teamSlug: string | undefined): string {
  return scope === "team" && teamSlug ? `/fan/${teamSlug}/community` : "/community";
}

function postPath(scope: BoardScope, teamSlug: string | undefined, postId: string): string {
  return scope === "team" && teamSlug
    ? `/fan/${teamSlug}/community/post/${postId}`
    : `/community/post/${postId}`;
}

export async function setPostNoticeInlineAction(formData: FormData) {
  await requireAdmin();

  const postId = formData.get("post_id") as string;
  const scope = formData.get("scope") as BoardScope;
  const teamSlug = (formData.get("team_slug") as string) || undefined;
  const isNotice = formData.get("is_notice") === "true";

  if (!postId || (scope !== "hub" && scope !== "team")) return;

  await setPostNotice(postId, isNotice);
  revalidatePath(communityIndexPath(scope, teamSlug));
  revalidatePath(postPath(scope, teamSlug, postId));
}
