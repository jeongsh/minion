import type { SupabaseClient } from "@supabase/supabase-js";

// 스크립트(node --experimental-strip-types)에서도 그대로 import 되도록
// `@/` 별칭과 Next 전용 API를 쓰지 않는다. supabase 클라이언트는 호출자가 넘긴다.

/** KST 기준 그 주 월요일을 YYYY-MM-DD로 반환한다. */
export function kstWeekStart(at: Date = new Date()): string {
  // UTC+9로 옮긴 뒤 UTC 날짜 함수를 쓰면 서버 타임존에 의존하지 않는다.
  const kst = new Date(at.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay(); // 0=일
  const backToMonday = day === 0 ? 6 : day - 1;
  kst.setUTCDate(kst.getUTCDate() - backToMonday);
  return kst.toISOString().slice(0, 10);
}

/**
 * 득표 1위를 그 주의 헤더로 확정한다.
 * 이미 확정된 주는 건너뛰므로 재실행해도 결과가 바뀌지 않는다.
 */
export async function selectWeeklyFanHeaders(
  supabase: SupabaseClient,
  weekStart = kstWeekStart(),
): Promise<{ teamId: string; candidateId: string; voteCount: number }[]> {
  const { data: teams, error: teamsError } = await supabase.from("teams").select("id");
  if (teamsError) throw teamsError;

  const selected: { teamId: string; candidateId: string; voteCount: number }[] = [];

  for (const team of teams ?? []) {
    const { data: existing } = await supabase
      .from("fan_header_selections")
      .select("team_id")
      .eq("team_id", team.id)
      .eq("week_start", weekStart)
      .maybeSingle();
    if (existing) continue;

    const { data: winner } = await supabase
      .from("fan_header_candidates")
      .select("id, vote_count")
      .eq("team_id", team.id)
      .is("deleted_at", null)
      .is("blinded_at", null)
      .gt("vote_count", 0)
      .order("vote_count", { ascending: false })
      .order("created_at", { ascending: true }) // 동점이면 먼저 올린 쪽
      .limit(1)
      .maybeSingle();

    if (!winner) continue;

    const { error } = await supabase.from("fan_header_selections").insert({
      team_id: team.id,
      week_start: weekStart,
      candidate_id: winner.id,
      vote_count: winner.vote_count,
    });
    if (error) throw error;

    selected.push({ teamId: team.id, candidateId: winner.id, voteCount: winner.vote_count });
  }

  return selected;
}
