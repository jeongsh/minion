import { revalidatePath, revalidateTag } from "next/cache";
import type { BoardScope } from "@/lib/community/boards";
import { getTeamById } from "@/lib/data/lck";

export const HOME_COMMUNITY_TAG = "home-community-posts";

export function revalidateCommunityHome({ scope, teamSlug }: { scope: BoardScope; teamSlug?: string | null }) {
  if (scope === "team" && teamSlug) {
    revalidatePath(`/fan/${teamSlug}/community`);
    revalidatePath(`/fan/${teamSlug}`);
    return;
  }
  revalidatePath("/community");
  // 웹 홈은 최신 글을 요청마다 읽고, 앱 홈은 게시글 부분만 따로 캐시한다.
  revalidateTag(HOME_COMMUNITY_TAG, { expire: 0 });
}

export async function revalidateCommunityHomeByTeamId(teamId?: string | null) {
  if (!teamId) return revalidateCommunityHome({ scope: "hub" });
  const team = await getTeamById(teamId);
  if (team) revalidateCommunityHome({ scope: "team", teamSlug: team.fanSiteHost || team.slug });
}
