import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendExpoPushNotifications } from "@/lib/notify/push";

const LEAD_WINDOW_START_MS = 5 * 60_000;
const LEAD_WINDOW_END_MS = 10 * 60_000;

export type MatchStartNotificationSummary = {
  matchesChecked: number;
  notificationsSent: number;
};

/**
 * 5~10분 뒤 시작하는 경기를 찾아, 두 팀 중 하나라도 팔로우한(team_fans) 로그인 유저에게
 * "곧 시작" 푸시를 보낸다. user_notification_preferences.match_start_enabled=false면 제외한다.
 * 매 분 도는 크론이라 이미 이 창을 지나쳐도 다음 실행에서 다시 안 걸리도록
 * matches.start_notification_sent_at 로 중복 발송을 막는다.
 */
export async function runMatchStartNotificationAutomation(): Promise<MatchStartNotificationSummary> {
  const admin = createSupabaseAdminClient();
  const now = Date.now();
  const windowStart = new Date(now + LEAD_WINDOW_START_MS).toISOString();
  const windowEnd = new Date(now + LEAD_WINDOW_END_MS).toISOString();

  const { data: matches, error } = await admin
    .from("matches")
    .select("id, team_a_id, team_b_id")
    .is("start_notification_sent_at", null)
    .eq("status", "scheduled")
    .gte("match_date", windowStart)
    .lt("match_date", windowEnd);

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
              title: "곧 경기가 시작해요",
              body: `${matchup} 잠시 후 시작합니다.`,
              data: { matchId: match.id, type: "match_start", url: `/matches/${match.id}` },
            })),
          );
          notificationsSent += result.sent;
          result.invalidTokens.forEach((token) => invalidTokens.add(token));
        }
      }
    }

    const { error: markError } = await admin
      .from("matches")
      .update({ start_notification_sent_at: new Date().toISOString() })
      .eq("id", match.id);
    if (markError) throw markError;
  }

  if (invalidTokens.size > 0) {
    await admin.from("push_tokens").delete().in("expo_push_token", [...invalidTokens]);
  }

  return { matchesChecked: matches.length, notificationsSent };
}
