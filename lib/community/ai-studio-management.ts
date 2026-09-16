import "server-only";
import { cache } from "react";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const studioAuthor = cache(async (authorId: string | null, guestKey: string | null) => {
  const { data, error } = await createSupabaseAdminClient().rpc("community_ai_studio_is_author", { p_author: authorId, p_guest: guestKey });
  return !error && data === true;
});

/** Author metadata/private guest identity, never nickname or the visible AI label. */
export async function canManageStudioContent(content: { authorId?: string | null; guestKey?: string | null } | null): Promise<boolean> {
  if (!content || !await isCurrentUserAdmin()) return false;
  return studioAuthor(content.authorId ?? null, content.guestKey ?? null);
}

export async function stopStudioReservations(postId: string, cancel = false) {
  const client = createSupabaseAdminClient();
  const campaign = await client.from("community_ai_studio_campaigns").select("state").eq("post_id", postId).maybeSingle();
  if (campaign.error) throw campaign.error;
  if (!campaign.data || campaign.data.state === "cancelled") return;
  const result = await client.rpc("community_ai_studio_control", { p_post: postId, p_action: cancel ? "cancel" : "pause" });
  if (result.error) throw result.error;
}
