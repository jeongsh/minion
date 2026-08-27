import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendExpoPushNotifications } from "@/lib/notify/push";

const DRAGON_LABELS: Record<string, string> = {
  cloud: "바람",
  infernal: "화염",
  mountain: "대지",
  ocean: "바다",
  hextech: "마법공학",
  chemtech: "화학공학",
  elder: "장로",
};

export type MatchEventForPush = {
  id: string;
  event_type: "kill" | "tower" | "baron" | "inhibitor" | "dragon" | "end";
  side: "blue" | "red" | null;
  team_id: string | null;
  killer_summoner_name: string | null;
  victim_summoner_name: string | null;
  dragon_type: string | null;
};

function describeEvent(event: MatchEventForPush, teamName: string | null): string | null {
  const team = teamName ?? "팀";
  switch (event.event_type) {
    case "kill":
      if (!event.killer_summoner_name || !event.victim_summoner_name) return null;
      return `${event.killer_summoner_name}킬 (${event.victim_summoner_name})`;
    case "tower":
      return `${team} 타워 파괴`;
    case "inhibitor":
      return `${team} 억제기 파괴`;
    case "baron":
      return `${team} 바론 처치`;
    case "dragon": {
      const label = event.dragon_type ? DRAGON_LABELS[event.dragon_type] : null;
      return label ? `${team} ${label}드래곤 처치` : `${team} 드래곤 처치`;
    }
    default:
      return null;
  }
}

/**
 * 방금 새로 감지된 라이브 경기 이벤트(킬/오브젝트)를 두 팀 중 하나라도 팔로우한
 * 로그인 유저에게 푸시로 보낸다. match_events_enabled는 기본값이 false(옵트인)라,
 * 명시적으로 켠 유저만 대상으로 한다 — match_start_enabled(기본 true, 옵트아웃)와 반대.
 * live 폴링 응답을 늦추지 않도록 호출부에서 await 없이 fire-and-forget으로 쓴다.
 */
export async function sendMatchEventPushNotifications(
  matchId: string,
  teamAId: string | null,
  teamBId: string | null,
  events: MatchEventForPush[],
): Promise<void> {
  if (events.length === 0) return;
  const teamIds = [teamAId, teamBId].filter((id): id is string => Boolean(id));
  if (teamIds.length === 0) return;

  const admin = createSupabaseAdminClient();
  const [{ data: teams }, { data: fans }] = await Promise.all([
    admin.from("teams").select("id, short_name, name").in("id", teamIds),
    admin.from("team_fans").select("user_id").in("team_id", teamIds).not("user_id", "is", null),
  ]);

  const userIds = [...new Set((fans ?? []).map((fan) => fan.user_id as string))];
  if (userIds.length === 0) return;

  const [{ data: preferences }, { data: tokens }] = await Promise.all([
    admin.from("user_notification_preferences").select("user_id, match_events_enabled").in("user_id", userIds),
    admin.from("push_tokens").select("user_id, expo_push_token").in("user_id", userIds),
  ]);

  const optedInUserIds = new Set(
    (preferences ?? []).filter((pref) => pref.match_events_enabled === true).map((pref) => pref.user_id),
  );
  const eligibleTokens = (tokens ?? []).filter((token) => optedInUserIds.has(token.user_id));
  if (eligibleTokens.length === 0) return;

  const teamNameById = new Map((teams ?? []).map((team) => [team.id, team.short_name ?? team.name]));
  const messages = events.flatMap((event) => {
    const message = describeEvent(event, event.team_id ? teamNameById.get(event.team_id) ?? null : null);
    return message ? [{ eventId: event.id, message }] : [];
  });
  if (messages.length === 0) return;

  const invalidTokens = new Set<string>();
  for (const { eventId, message } of messages) {
    // 이 배치의 이벤트들은 호출부(live route)에서 이미 dedupe_key upsert로 확정
    // 저장된 뒤라 재시도 대상이 아니다 — 메시지 하나의 발송이 실패해도 여기서 잡아
    // 로그만 남기고 나머지 메시지는 계속 보낸다.
    try {
      const result = await sendExpoPushNotifications(
        eligibleTokens.map((token) => ({
          to: token.expo_push_token,
          title: "경기 주요 이벤트",
          body: message,
          data: { eventId, matchId, type: "match_event", url: `/matches/${matchId}`, userId: token.user_id },
        })),
      );
      result.invalidTokens.forEach((token) => invalidTokens.add(token));
    } catch (error) {
      console.error(`[match-event-push] match ${matchId} message send failed`, error);
    }
  }

  if (invalidTokens.size > 0) {
    await admin.from("push_tokens").delete().in("expo_push_token", [...invalidTokens]);
  }
}
