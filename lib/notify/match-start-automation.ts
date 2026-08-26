import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendExpoPushNotifications } from "@/lib/notify/push";

// 크론이 1분마다 도는데, 실행이 밀리거나 한 번 건너뛰어도 그 경기를 놓치지 않도록
// 여유를 좀 더 둔다(현재는 "지나간 예정 시각" 매치를 찾는 거라 창을 넓혀도 더 이른
// 시점의 발송으로 이어지진 않는다 — 그냥 놓치는 걸 방지하는 목적).
const LOOKBACK_MS = 3 * 60_000;

export type MatchStartNotificationSummary = {
  matchesChecked: number;
  notificationsSent: number;
};

/**
 * 예정 시각이 막 지난(최근 3분 이내) 경기를 찾아, 두 팀 중 하나라도 팔로우한(team_fans)
 * 로그인 유저에게 "경기 시작" 푸시를 보낸다. user_notification_preferences.match_start_enabled
 * =false면 제외한다. matches.start_notification_sent_at 로 중복 발송을 막는다.
 */
export async function runMatchStartNotificationAutomation(): Promise<MatchStartNotificationSummary> {
  const admin = createSupabaseAdminClient();
  const now = Date.now();
  const windowStart = new Date(now - LOOKBACK_MS).toISOString();
  const windowEnd = new Date(now).toISOString();

  // 조회와 완료 마킹을 하나의 UPDATE로 묶어 원자적으로 처리한다 — 크론 실행이 겹쳐도
  // (한 번의 실행이 1분을 넘기는 경우) Postgres가 이 UPDATE 중 대상 행에 락을 걸기 때문에
  // 두 실행이 같은 매치를 동시에 가져가 중복 발송하는 일이 생기지 않는다.
  const { data: matches, error } = await admin
    .from("matches")
    .update({ start_notification_sent_at: new Date().toISOString() })
    .is("start_notification_sent_at", null)
    .eq("status", "scheduled")
    .gte("match_date", windowStart)
    .lte("match_date", windowEnd)
    .select("id, team_a_id, team_b_id");

  if (error) throw error;
  if (!matches || matches.length === 0) {
    return { matchesChecked: 0, notificationsSent: 0 };
  }

  let notificationsSent = 0;
  const invalidTokens = new Set<string>();

  for (const match of matches) {
    const teamIds = [match.team_a_id, match.team_b_id].filter((id): id is string => Boolean(id));

    if (teamIds.length > 0) {
      const [{ data: teams }, { data: fans }] = await Promise.all([
        admin.from("teams").select("id, short_name, name").in("id", teamIds),
        admin.from("team_fans").select("user_id").in("team_id", teamIds).not("user_id", "is", null),
      ]);

      const userIds = [...new Set((fans ?? []).map((fan) => fan.user_id as string))];

      if (userIds.length > 0) {
        const [{ data: preferences }, { data: tokens }] = await Promise.all([
          admin.from("user_notification_preferences").select("user_id, match_start_enabled").in("user_id", userIds),
          admin.from("push_tokens").select("user_id, expo_push_token").in("user_id", userIds),
        ]);

        const optedOutUserIds = new Set(
          (preferences ?? []).filter((pref) => pref.match_start_enabled === false).map((pref) => pref.user_id),
        );
        const eligibleTokens = (tokens ?? []).filter((token) => !optedOutUserIds.has(token.user_id));

        if (eligibleTokens.length > 0) {
          const teamA = teams?.find((team) => team.id === match.team_a_id);
          const teamB = teams?.find((team) => team.id === match.team_b_id);
          const matchup = `${teamA?.short_name ?? teamA?.name ?? "TBD"} vs ${teamB?.short_name ?? teamB?.name ?? "TBD"}`;

          const result = await sendExpoPushNotifications(
            eligibleTokens.map((token) => ({
              to: token.expo_push_token,
              title: "경기가 시작했어요",
              body: `${matchup} 지금 시작합니다.`,
              data: { matchId: match.id, type: "match_start", url: `/matches/${match.id}` },
            })),
          );
          notificationsSent += result.sent;
          result.invalidTokens.forEach((token) => invalidTokens.add(token));
        }
      }
    }
  }

  if (invalidTokens.size > 0) {
    await admin.from("push_tokens").delete().in("expo_push_token", [...invalidTokens]);
  }

  return { matchesChecked: matches.length, notificationsSent };
}
