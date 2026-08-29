import { NextResponse } from "next/server";

import { getMatchById } from "@/lib/data/lck";

// 매치 상세 상단 스코어를 라이브 중에 갱신하기 위한 가벼운 폴링용 엔드포인트.
// /live 라우트는 외부 API 호출이 무거워서, 여기선 DB(matches)만 읽는다.
// team_a_score/team_b_score 는 lolesports-rating-automation 크론(매분)이 세트 종료마다 갱신한다.
export const dynamic = "force-dynamic";

export type MatchScoreResponse = {
  teamAScore: number | null;
  teamBScore: number | null;
  status: "scheduled" | "live" | "completed" | string;
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ matchId: string }> },
): Promise<NextResponse<MatchScoreResponse | { error: "not_found" }>> {
  const { matchId } = await context.params;
  const match = await getMatchById(matchId);
  if (!match) return NextResponse.json({ error: "not_found" }, { status: 404 });

  return NextResponse.json({
    teamAScore: match.teamAScore,
    teamBScore: match.teamBScore,
    status: match.status,
  });
}
