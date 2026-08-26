import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendExpoPushNotifications } from "@/lib/notify/push";

type SetRatingOpenedPayload = {
  matchId: string;
  matchName: string;
  setNumber: number;
};

type PendingEventRow = {
  id: string;
  payload: SetRatingOpenedPayload;
};

/**
 * reconcile_lolesports_match_score()가 match_automation_events에 쌓아둔 set_rating_opened
 * 이벤트를 읽어 두 팀 중 하나라도 팔로우한 로그인 유저에게 푸시를 보낸다. Discord 알림
 * (deliverPendingDiscordEvents)과 같은 이벤트 큐를 보되, claimed_at/delivered_at은 Discord
 * 발송 전용이라 건드리지 않고 별도 push_delivered_at 컬럼으로 독립적으로 추적한다.
 * rating_open_enabled는 기본값이 true(옵트아웃)라 명시적으로 false인 유저만 제외한다.
 */
export async function sendPendingSetRatingOpenPushNotifications(): Promise<{ sent: number }> {
  const admin = createSupabaseAdminClient();

  // 조회와 완료 마킹을 하나의 UPDATE로 묶어 원자적으로 처리한다 — 크론 실행이 겹쳐도
  // Postgres가 이 UPDATE 중 대상 행에 락을 걸기 때문에 같은 이벤트를 두 실행이 동시에
  // 가져가 중복 발송하는 일이 생기지 않는다.
  const { data: events, error } = await admin
    .from("match_automation_events")
    .update({ push_delivered_at: new Date().toISOString() })
    .eq("event_type", "set_rating_opened")
    .is("push_delivered_at", null)
    .select("id, payload");
  if (error) throw error;
  if (!events || events.length === 0) return { sent: 0 };

  let sent = 0;
  const invalidTokens = new Set<string>();

  for (const event of events as PendingEventRow[]) {
    const { matchId, matchName, setNumber } = event.payload;

    const { data: match } = await admin
      .from("matches")
      .select("team_a_id, team_b_id")
      .eq("id", matchId)
      .maybeSingle();
    const teamIds = [match?.team_a_id, match?.team_b_id].filter((id): id is string => Boolean(id));

    if (teamIds.length > 0) {
      const { data: fans } = await admin
        .from("team_fans")
        .select("user_id")
        .in("team_id", teamIds)
        .not("user_id", "is", null);
      const userIds = [...new Set((fans ?? []).map((fan) => fan.user_id as string))];

      if (userIds.length > 0) {
        const [{ data: preferences }, { data: tokens }] = await Promise.all([
          admin.from("user_notification_preferences").select("user_id, rating_open_enabled").in("user_id", userIds),
          admin.from("push_tokens").select("user_id, expo_push_token").in("user_id", userIds),
        ]);

        const optedOutUserIds = new Set(
          (preferences ?? []).filter((pref) => pref.rating_open_enabled === false).map((pref) => pref.user_id),
        );
        const eligibleTokens = (tokens ?? []).filter((token) => !optedOutUserIds.has(token.user_id));

        if (eligibleTokens.length > 0) {
          const result = await sendExpoPushNotifications(
            eligibleTokens.map((token) => ({
              to: token.expo_push_token,
              title: "세트 평가 오픈",
              body: `${matchName} ${setNumber}세트 평가 시작`,
              data: { matchId, type: "rating_open", url: `/matches/${matchId}?tab=rating&set=${setNumber}` },
            })),
          );
          sent += result.sent;
          result.invalidTokens.forEach((token) => invalidTokens.add(token));
        }
      }
    }
  }

  if (invalidTokens.size > 0) {
    await admin.from("push_tokens").delete().in("expo_push_token", [...invalidTokens]);
  }

  return { sent };
}
