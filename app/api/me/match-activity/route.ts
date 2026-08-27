import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getUserFollowedTeamIds } from "@/lib/fan/followed-teams";
import { getMatchActivityForTeamKeys } from "@/lib/match-activity-server";
import type { MatchActivityResponse } from "@/lib/match-activity";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
  }

  const data = await getMatchActivityForTeamKeys(await getUserFollowedTeamIds(user.id));
  return NextResponse.json<MatchActivityResponse>(data, { headers: { "Cache-Control": "private, no-store" } });
}
