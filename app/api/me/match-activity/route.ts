import { NextResponse } from "next/server";

import { getFollowedTeamIds } from "@/lib/fan/followed-teams";
import { getMatchActivityForTeamKeys } from "@/lib/match-activity-server";
import type { MatchActivityResponse } from "@/lib/match-activity";

export const dynamic = "force-dynamic";

export async function GET() {
  const data = await getMatchActivityForTeamKeys(await getFollowedTeamIds());
  return NextResponse.json<MatchActivityResponse>(data, { headers: { "Cache-Control": "private, no-store" } });
}
