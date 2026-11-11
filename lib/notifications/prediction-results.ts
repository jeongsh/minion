import "server-only";

import { sendExpoPushNotifications } from "@/lib/notify/push";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// 정산은 matches 트리거(settle_prediction_bets_for_match)가 DB 안에서 처리하므로 앱은 정산 시점을
// 알 수 없다. 1분 크론이 아직 알리지 않은 정산 건을 집어 알림함 행과 앱 푸시를 만든다.
// 크론이 잠시 멈췄다 돌아와도 놓치지 않되, 오래된 정산을 뒤늦게 쏟아내지 않도록 창을 제한한다.
const LOOKBACK_MS = 2 * 24 * 60 * 60_000;

export const PREDICTION_RESULT_NOTIFICATION_KIND = "prediction_result";
const PREDICTION_RESULT_HREF = "/predictions";

type SettledStatus = "won" | "lost" | "refunded";

type ClaimedBetRow = {
  id: string;
  user_id: string;
  match_id: string;
  team_id: string;
  stake: number;
  payout: number;
  status: SettledStatus;
};

type CreatedNotificationRow = {
  id: string;
  recipient_user_id: string | null;
  title: string;
  description: string;
  href: string;
};

export type PredictionResultNotificationSummary = {
  betsClaimed: number;
  notificationsCreated: number;
  pushesSent: number;
};

const lp = (value: number) => `${Number(value).toLocaleString("ko-KR")} LP`;

export function predictionResultMessage(input: {
  matchup: string;
  pickName: string;
  status: SettledStatus;
  stake: number;
  payout: number;
}): { title: string; description: string } {
  if (input.status === "won") {
    return {
      title: `${input.matchup} 예측 적중`,
      description: `${input.pickName} 승리를 맞혀 ${lp(input.payout)}를 받았어요.`,
    };
  }
  if (input.status === "refunded") {
    return {
      title: `${input.matchup} 예측 환급`,
      description: `적중한 사람이 없어 ${lp(input.stake)}를 돌려받았어요.`,
    };
  }
  return {
    title: `${input.matchup} 예측 결과`,
    description: `${input.pickName} 승리 예측이 빗나갔어요.`,
  };
}

/**
 * 정산이 끝났지만 아직 알리지 않은 예측을 찾아 알림함 행을 만들고 앱 푸시를 보낸다.
 * 조회와 완료 표시를 하나의 UPDATE로 묶어, 크론 실행이 겹쳐도 같은 예측을 두 번 알리지 않는다
 * (경기 시작 알림의 start_notification_sent_at과 같은 방식).
 */
export async function runPredictionResultNotificationAutomation(): Promise<PredictionResultNotificationSummary> {
  const admin = createSupabaseAdminClient();
  const now = Date.now();

  const { data: claimed, error } = await admin
    .from("prediction_bets")
    .update({ result_notified_at: new Date(now).toISOString() })
    .is("result_notified_at", null)
    .in("status", ["won", "lost", "refunded"])
    .gte("settled_at", new Date(now - LOOKBACK_MS).toISOString())
    .select("id, user_id, match_id, team_id, stake, payout, status");
  if (error) throw error;

  const bets = (claimed ?? []) as ClaimedBetRow[];
  const summary: PredictionResultNotificationSummary = { betsClaimed: bets.length, notificationsCreated: 0, pushesSent: 0 };
  if (bets.length === 0) return summary;

  const userIds = [...new Set(bets.map((bet) => bet.user_id))];
  const matchIds = [...new Set(bets.map((bet) => bet.match_id))];
  const [matchesResult, preferencesResult] = await Promise.all([
    admin.from("matches").select("id, team_a_id, team_b_id").in("id", matchIds),
    admin.from("user_notification_preferences").select("user_id, in_app_enabled").in("user_id", userIds),
  ]);
  if (matchesResult.error) throw matchesResult.error;
  if (preferencesResult.error) throw preferencesResult.error;

  const matchesById = new Map((matchesResult.data ?? []).map((match) => [match.id as string, match]));
  const teamIds = [...new Set([
    ...bets.map((bet) => bet.team_id),
    ...(matchesResult.data ?? []).flatMap((match) => [match.team_a_id, match.team_b_id]),
  ].filter((id): id is string => Boolean(id)))];
  const { data: teams, error: teamsError } = await admin.from("teams").select("id, short_name, name").in("id", teamIds);
  if (teamsError) throw teamsError;
  const teamName = (teamId: string | null | undefined) => {
    const team = teams?.find((item) => item.id === teamId);
    return (team?.short_name as string | null) ?? (team?.name as string | null) ?? "TBD";
  };

  const optedOutUserIds = new Set(
    (preferencesResult.data ?? []).filter((preference) => preference.in_app_enabled === false).map((preference) => preference.user_id as string),
  );

  const rows = bets.filter((bet) => !optedOutUserIds.has(bet.user_id)).map((bet) => {
    const match = matchesById.get(bet.match_id);
    const message = predictionResultMessage({
      matchup: `${teamName(match?.team_a_id as string | null)} vs ${teamName(match?.team_b_id as string | null)}`,
      pickName: teamName(bet.team_id),
      status: bet.status,
      stake: Number(bet.stake),
      payout: Number(bet.payout),
    });
    return {
      recipient_user_id: bet.user_id,
      recipient_guest_key: null,
      actor_user_id: null,
      actor_name: "MINION",
      kind: PREDICTION_RESULT_NOTIFICATION_KIND,
      post_id: null,
      comment_id: null,
      title: message.title,
      description: message.description,
      href: PREDICTION_RESULT_HREF,
      dedupe_key: `prediction:${bet.id}`,
    };
  });
  if (rows.length === 0) return summary;

  const { data: createdRows, error: insertError } = await admin
    .from("community_notifications")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id, recipient_user_id, title, description, href");
  if (insertError) throw insertError;

  const created = ((createdRows ?? []) as CreatedNotificationRow[]).filter((row) => row.recipient_user_id);
  summary.notificationsCreated = created.length;
  if (created.length === 0) return summary;

  const { data: tokens, error: tokenError } = await admin
    .from("push_tokens")
    .select("user_id, expo_push_token")
    .in("user_id", [...new Set(created.map((row) => row.recipient_user_id!))]);
  if (tokenError) throw tokenError;

  const pushResult = await sendExpoPushNotifications((tokens ?? []).flatMap((token) =>
    created
      .filter((notification) => notification.recipient_user_id === token.user_id)
      .map((notification) => ({
        to: token.expo_push_token as string,
        title: notification.title,
        body: notification.description,
        channelId: "match" as const,
        sound: "default" as const,
        data: {
          notificationId: notification.id,
          type: PREDICTION_RESULT_NOTIFICATION_KIND,
          url: notification.href,
          userId: token.user_id,
        },
      })),
  ));
  summary.pushesSent = pushResult.sent;

  if (pushResult.invalidTokens.length > 0) {
    const { error: deleteError } = await admin.from("push_tokens").delete().in("expo_push_token", pushResult.invalidTokens);
    if (deleteError) throw deleteError;
  }

  return summary;
}
