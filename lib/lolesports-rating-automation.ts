import { revalidatePath } from "next/cache";

import { fetchTrackedLolesportsEvents } from "@/lib/lolesports";
import { enrichmentRetryWindowStart } from "@/lib/lolesports-enrichment-policy";
import {
  getLolesportsPollingStartsAt,
  shouldPollLolesportsEvents,
} from "@/lib/lolesports-polling-window";
import { buildLolesportsSetResultSnapshot } from "@/lib/lolesports-set-result-snapshot";
import { syncLolesportsSetGameData } from "@/lib/lolesports-game-sync";
import {
  findLolesportsMatch,
  hasConsistentCompletedScore,
  type LocalMatchCandidate,
  type LocalTeamIdentity,
} from "@/lib/lolesports-match-matcher";
import { sendDiscordMatchAutomationAlert } from "@/lib/notify/discord";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  LeaguepediaRateLimitError,
  syncLeaguepediaMatchSets,
} from "@/lib/sync/leaguepedia-match-sets";
import { leaguepediaRetryAt } from "@/lib/sync/leaguepedia-retry-policy";
import { syncLeaguepediaTimelineForSet } from "@/lib/sync/leaguepedia-timeline";

type MatchRow = {
  id: string;
  name: string;
  match_date: string;
  status: "scheduled" | "live" | "completed";
  team_a_id: string;
  team_b_id: string;
  team_a_score: number | null;
  team_b_score: number | null;
  best_of: number | null;
  lolesports_match_id: string | null;
  leaguepedia_match_id: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  short_name: string;
};

type AutomationEventRow = {
  id: string;
  event_type:
    | "set_rating_opened"
    | "match_completed"
    | "set_data_sync_succeeded"
    | "set_data_sync_failed"
    | "set_data_sync_rate_limited";
  payload: {
    matchId: string;
    matchName: string;
    setNumber?: number;
    teamAScore: number;
    teamBScore: number;
    playerStatsUpserted?: number;
    error?: string;
  };
};

const MATCH_SELECT =
  "id, name, match_date, status, team_a_id, team_b_id, team_a_score, team_b_score, best_of, lolesports_match_id, leaguepedia_match_id";

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [record.message, record.details, record.hint, record.code]
      .filter((value): value is string => typeof value === "string" && value.length > 0);
    if (parts.length > 0) return parts.join(" | ");
  }
  return String(error);
}

export type LolesportsAutomationSummary = {
  polled: boolean;
  candidateCount: number;
  externalEventCount: number;
  reconciledMatchIds: string[];
  openedSets: Array<{ matchId: string; setNumbers: number[] }>;
  completedMatchIds: string[];
  snapshottedSets: Array<{ matchId: string; setNumbers: number[] }>;
  detailedSets: Array<{ matchId: string; setNumbers: number[] }>;
  enrichedSets: Array<{ matchId: string; setNumbers: number[] }>;
  timelineSets: Array<{ matchId: string; setNumber: number; eventCount: number }>;
  deliveredNotificationCount: number;
  warnings: string[];
};

function koreaDayBounds(now: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const dateKey = `${value("year")}-${value("month")}-${value("day")}`;
  const start = new Date(`${dateKey}T00:00:00+09:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

async function upsertSetResultSnapshots({
  match,
  external,
  setNumbers,
  observedAt,
}: {
  match: MatchRow;
  external: NonNullable<ReturnType<typeof findLolesportsMatch>>;
  setNumbers: number[];
  observedAt: Date;
}) {
  if (setNumbers.length === 0) return [];
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sets")
    .select("id, set_number, winner_team_id")
    .eq("match_id", match.id)
    .in("set_number", setNumbers)
    .in("status", ["finished", "data_synced"]);
  if (error) throw new Error(`Failed to load finished sets for snapshots: ${error.message}`);

  const rows = (data ?? []).map((set) => buildLolesportsSetResultSnapshot(
    {
      setId: set.id,
      matchId: match.id,
      setNumber: set.set_number,
      winnerTeamId: set.winner_team_id ?? null,
    },
    external,
    observedAt,
  ));
  if (rows.length === 0) return [];

  const { error: upsertError } = await supabase
    .from("set_result_snapshots")
    .upsert(rows, { onConflict: "set_id,source" });
  if (upsertError) throw new Error(`Failed to upsert set result snapshots: ${upsertError.message}`);
  return rows.map((row) => row.set_number);
}

function publicSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return undefined;
}

async function queueSetDataSyncNotification({
  match,
  setId,
  setNumber,
  teamAScore,
  teamBScore,
  outcome,
  playerStatsUpserted,
  error,
}: {
  match: MatchRow;
  setId: string;
  setNumber: number;
  teamAScore: number;
  teamBScore: number;
  outcome: "succeeded" | "failed" | "rate_limited";
  playerStatsUpserted?: number;
  error?: string;
}) {
  const eventType = outcome === "succeeded"
    ? "set_data_sync_succeeded"
    : outcome === "rate_limited"
      ? "set_data_sync_rate_limited"
      : "set_data_sync_failed";
  const dedupeType = outcome === "succeeded"
    ? "set-full-data-sync-succeeded"
    : outcome === "rate_limited"
      ? "set-leaguepedia-rate-limited"
      : eventType;
  const supabase = createSupabaseAdminClient();
  const { error: insertError } = await supabase.from("match_automation_events").upsert({
    dedupe_key: `${dedupeType}:${match.id}:${setNumber}`,
    match_id: match.id,
    set_id: setId,
    event_type: eventType,
    set_number: setNumber,
    payload: {
      matchId: match.id,
      matchName: match.name,
      setNumber,
      teamAScore,
      teamBScore,
      playerStatsUpserted: playerStatsUpserted ?? null,
      error: error?.slice(0, 500) ?? null,
    },
  }, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (insertError) {
    throw new Error(`Failed to queue set sync notification: ${insertError.message}`);
  }
}

// 경기 종료 직후 첫 시도는 리그피디아 위키가 아직 갱신 전이라 항상 실패한다.
// 그 시점에 바로 "실패" 알림을 보내면 실제로는 계속 재시도 중인데도 마치
// 멈춘 것처럼 보이므로, 일정 횟수 이상(약 15분) 계속 실패할 때만 알린다.
const MIN_ATTEMPTS_BEFORE_FAILURE_ALERT = 3;

async function runLeaguepediaEnrichment({
  match,
  teamAScore,
  teamBScore,
  now,
}: {
  match: MatchRow;
  teamAScore: number;
  teamBScore: number;
  now: Date;
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("set_result_snapshots")
    .select("id, set_id, set_number, leaguepedia_sync_attempts")
    .eq("match_id", match.id)
    .neq("leaguepedia_sync_status", "succeeded")
    .or(`leaguepedia_retry_at.is.null,leaguepedia_retry_at.lte.${now.toISOString()}`);
  if (error) throw new Error(`Failed to load Leaguepedia enrichment queue: ${error.message}`);
  const pending = data ?? [];
  if (pending.length === 0) return [] as number[];

  const updatePending = async (
    status: "rate_limited" | "failed",
    message: string,
  ) => {
    const retryAt = leaguepediaRetryAt(now, status);
    for (const row of pending) {
      const attempts = (row.leaguepedia_sync_attempts ?? 0) + 1;
      await supabase.from("set_result_snapshots").update({
        leaguepedia_sync_status: status,
        leaguepedia_sync_attempts: attempts,
        leaguepedia_retry_at: retryAt,
        leaguepedia_last_error: message.slice(0, 1000),
      }).eq("id", row.id);
      if (status === "rate_limited" || attempts >= MIN_ATTEMPTS_BEFORE_FAILURE_ALERT) {
        await queueSetDataSyncNotification({
          match,
          setId: row.set_id,
          setNumber: row.set_number,
          teamAScore,
          teamBScore,
          outcome: status === "rate_limited" ? "rate_limited" : "failed",
          error: message,
        });
      }
    }
  };

  if (!match.leaguepedia_match_id) {
    await updatePending("failed", "Leaguepedia Match ID is missing");
    return [];
  }

  try {
    const summary = await syncLeaguepediaMatchSets(supabase, match.id, { maxRetries: 1 });
    const setIds = pending.map((row) => row.set_id);
    const [{ data: pickBans }, { data: playerStats }] = await Promise.all([
      supabase.from("set_picks_bans").select("set_id, action_type").in("set_id", setIds),
      supabase.from("set_player_stats").select("set_id, damage_to_champions").in("set_id", setIds),
    ]);
    const succeeded: number[] = [];
    for (const row of pending) {
      const setDraft = (pickBans ?? []).filter((entry) => entry.set_id === row.set_id);
      const setPlayers = (playerStats ?? []).filter((entry) => entry.set_id === row.set_id);
      const picks = setDraft.filter((entry) => entry.action_type === "pick").length;
      const bans = setDraft.filter((entry) => entry.action_type === "ban").length;
      const playersWithDamage = setPlayers.filter(
        (entry) => (entry.damage_to_champions ?? 0) > 0,
      ).length;
      const complete = picks >= 10 && bans >= 10 && setPlayers.length >= 10 && playersWithDamage > 0;
      if (!complete) {
        const message =
          `Incomplete Leaguepedia data: picks=${picks}, bans=${bans}, ` +
          `players=${setPlayers.length}, playersWithDamage=${playersWithDamage}`;
        const attempts = (row.leaguepedia_sync_attempts ?? 0) + 1;
        await supabase.from("set_result_snapshots").update({
          leaguepedia_sync_status: "failed",
          leaguepedia_sync_attempts: attempts,
          leaguepedia_retry_at: leaguepediaRetryAt(now, "failed"),
          leaguepedia_last_error: message,
        }).eq("id", row.id);
        if (attempts >= MIN_ATTEMPTS_BEFORE_FAILURE_ALERT) {
          await queueSetDataSyncNotification({
            match,
            setId: row.set_id,
            setNumber: row.set_number,
            teamAScore,
            teamBScore,
            outcome: "failed",
            playerStatsUpserted: setPlayers.length,
            error: message,
          });
        }
        continue;
      }
      await supabase.from("set_result_snapshots").update({
        leaguepedia_sync_status: "succeeded",
        leaguepedia_sync_attempts: (row.leaguepedia_sync_attempts ?? 0) + 1,
        leaguepedia_retry_at: null,
        leaguepedia_last_error: null,
        leaguepedia_synced_at: now.toISOString(),
      }).eq("id", row.id);
      await queueSetDataSyncNotification({
        match,
        setId: row.set_id,
        setNumber: row.set_number,
        teamAScore,
        teamBScore,
        outcome: "succeeded",
        playerStatsUpserted: summary.playerStatsUpserted,
      });
      succeeded.push(row.set_number);
    }
    return succeeded;
  } catch (enrichmentError) {
    const message = errorMessage(enrichmentError);
    if (enrichmentError instanceof LeaguepediaRateLimitError) {
      await updatePending("rate_limited", message);
    } else {
      await updatePending("failed", message);
    }
    return [];
  }
}

// waiting_for_source는 5분 간격으로 재시도되므로(leaguepedia-retry-policy.ts), 6회면 최대 30분간
// 골드 프레임이 뒤늦게 채워지길 기다린 뒤 포기한다(옛날 경기 등 프레임 데이터가 원천적으로 없는 경우 대비).
// 아래 쿼리가 leaguepedia_sync_status = 'succeeded'인 세트만 대상으로 삼기 때문에,
// 이 시도 횟수는 순수하게 "세트 정보(밴픽·선수 스탯)는 이미 다 채워졌는데 골드
// 프레임만 아직 안 올라온" 상황만 센다 - 세트 정보 자체를 기다리는 시간은 여기 안 섞인다.
const MAX_FRAME_WAIT_ATTEMPTS = 6;

async function runTimelineEnrichment({ matchId, now }: { matchId: string; now: Date }) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("set_result_snapshots")
    .select("id, set_id, set_number, timeline_sync_attempts")
    .eq("match_id", matchId)
    .eq("leaguepedia_sync_status", "succeeded")
    .neq("timeline_sync_status", "succeeded")
    .or(`timeline_retry_at.is.null,timeline_retry_at.lte.${now.toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(`Failed to load timeline enrichment queue: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;

  const attempts = (row.timeline_sync_attempts ?? 0) + 1;
  try {
    const result = await syncLeaguepediaTimelineForSet(supabase, row.set_id);
    if (result.status === "succeeded") {
      // Leaguepedia는 이벤트(킬/오브젝트)를 골드 프레임보다 먼저 공개하는 경우가 있다.
      // 이벤트만 들어오고 골드 프레임이 비어 있으면 아직 succeeded로 확정하지 않고
      // 몇 번 더 재시도해서 프레임 데이터가 뒤늦게 채워지길 기다린다(최대 시도 이후엔 포기).
      const framesStillMissing = result.framesInserted === 0 && attempts < MAX_FRAME_WAIT_ATTEMPTS;
      if (framesStillMissing) {
        const { error: updateError } = await supabase
          .from("set_result_snapshots")
          .update({
            timeline_sync_status: "waiting_for_source",
            timeline_sync_attempts: attempts,
            timeline_retry_at: leaguepediaRetryAt(now, "waiting_for_source"),
            timeline_last_error: "Gold frames not yet available from Leaguepedia timeline; retrying",
            timeline_event_count: result.eventCount,
          })
          .eq("id", row.id);
        if (updateError) throw updateError;
        return null;
      }

      const { error: updateError } = await supabase
        .from("set_result_snapshots")
        .update({
          timeline_sync_status: "succeeded",
          timeline_sync_attempts: attempts,
          timeline_retry_at: null,
          timeline_last_error: null,
          timeline_synced_at: now.toISOString(),
          timeline_event_count: result.eventCount,
        })
        .eq("id", row.id);
      if (updateError) throw updateError;
      return { setNumber: row.set_number, eventCount: result.eventCount };
    }

    const { error: updateError } = await supabase
      .from("set_result_snapshots")
      .update({
        timeline_sync_status: result.status,
        timeline_sync_attempts: attempts,
        timeline_retry_at: leaguepediaRetryAt(now, result.status),
        timeline_last_error: result.reason,
      })
      .eq("id", row.id);
    if (updateError) throw updateError;
    return null;
  } catch (timelineError) {
    const message = errorMessage(timelineError);
    await supabase
      .from("set_result_snapshots")
      .update({
        timeline_sync_status: "failed",
        timeline_sync_attempts: attempts,
        timeline_retry_at: leaguepediaRetryAt(now, "failed"),
        timeline_last_error: message.slice(0, 1000),
      })
      .eq("id", row.id);
    return null;
  }
}

async function loadDueLeaguepediaMatch(now: Date): Promise<MatchRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data: pending, error: pendingError } = await supabase
    .from("set_result_snapshots")
    .select("match_id")
    .gte("observed_at", enrichmentRetryWindowStart(now))
    .neq("leaguepedia_sync_status", "succeeded")
    .or(`leaguepedia_retry_at.is.null,leaguepedia_retry_at.lte.${now.toISOString()}`)
    .order("leaguepedia_retry_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pendingError) {
    throw new Error(`Failed to load due Leaguepedia enrichment: ${pendingError.message}`);
  }
  if (!pending?.match_id) return null;

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .eq("id", pending.match_id)
    .maybeSingle();
  if (matchError) {
    throw new Error(`Failed to load due Leaguepedia match: ${matchError.message}`);
  }
  return match as MatchRow | null;
}

async function loadDueTimelineMatchId(now: Date): Promise<string | null> {
  const supabase = createSupabaseAdminClient();
  const { data: pending, error } = await supabase
    .from("set_result_snapshots")
    .select("match_id")
    .gte("observed_at", enrichmentRetryWindowStart(now))
    .eq("leaguepedia_sync_status", "succeeded")
    .neq("timeline_sync_status", "succeeded")
    .or(`timeline_retry_at.is.null,timeline_retry_at.lte.${now.toISOString()}`)
    .order("timeline_retry_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Failed to load due timeline enrichment: ${error.message}`);
  return pending?.match_id ?? null;
}

async function retryLolesportsDetailForMatch(match: MatchRow, now: Date) {
  const supabase = createSupabaseAdminClient();
  const { data: sets, error: setError } = await supabase
    .from("sets")
    .select("id, set_number")
    .eq("match_id", match.id)
    .eq("status", "finished")
    .order("set_number", { ascending: true });
  if (setError) throw new Error(`Failed to load unfinished LoL Esports set: ${setError.message}`);
  if (!sets?.length) return null;

  const { data: snapshot, error: snapshotError } = await supabase
    .from("set_result_snapshots")
    .select("set_id, set_number, external_game_id, external_team_a_id, external_team_b_id")
    .in("set_id", sets.map((set) => set.id))
    .eq("source", "lolesports")
    .not("external_game_id", "is", null)
    .order("set_number", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (snapshotError) {
    throw new Error(`Failed to load LoL Esports set snapshot: ${snapshotError.message}`);
  }
  if (!snapshot?.external_game_id) {
    return {
      setNumber: sets[0].set_number,
      updated: false,
      playerStatsUpserted: 0,
      warning: "LoL Esports game ID is missing",
    };
  }

  const result = await syncLolesportsSetGameData({
    setId: snapshot.set_id,
    gameId: snapshot.external_game_id,
    localTeamAId: match.team_a_id,
    localTeamBId: match.team_b_id,
    externalTeamAId: snapshot.external_team_a_id,
    externalTeamBId: snapshot.external_team_b_id,
    observedAt: now,
  });
  return { setNumber: snapshot.set_number, ...result };
}

async function drainPendingEnrichmentQueues(now: Date) {
  const detailedSets: Array<{ matchId: string; setNumbers: number[] }> = [];
  const enrichedSets: Array<{ matchId: string; setNumbers: number[] }> = [];
  const timelineSets: Array<{ matchId: string; setNumber: number; eventCount: number }> = [];
  const warnings: string[] = [];

  try {
    const match = await loadDueLeaguepediaMatch(now);
    if (match) {
      try {
        const detail = await retryLolesportsDetailForMatch(match, now);
        if (detail?.updated && detail.playerStatsUpserted === 10) {
          detailedSets.push({ matchId: match.id, setNumbers: [detail.setNumber] });
        }
        if (detail?.warning) {
          warnings.push(`Match ${match.id} set ${detail.setNumber}: ${detail.warning}`);
        }
      } catch (error) {
        warnings.push(`Match ${match.id}: LoL Esports detail retry failed: ${errorMessage(error)}`);
      }

      const setNumbers = await runLeaguepediaEnrichment({
        match,
        teamAScore: match.team_a_score ?? 0,
        teamBScore: match.team_b_score ?? 0,
        now,
      });
      if (setNumbers.length > 0) enrichedSets.push({ matchId: match.id, setNumbers });
      revalidatePath(`/matches/${match.id}`);
    }
  } catch (error) {
    warnings.push(`Leaguepedia enrichment queue failed: ${errorMessage(error)}`);
  }

  try {
    const matchId = await loadDueTimelineMatchId(now);
    if (matchId) {
      const timeline = await runTimelineEnrichment({ matchId, now });
      if (timeline) timelineSets.push({ matchId, ...timeline });
      revalidatePath(`/matches/${matchId}`);
    }
  } catch (error) {
    warnings.push(`Timeline enrichment queue failed: ${errorMessage(error)}`);
  }

  return { detailedSets, enrichedSets, timelineSets, warnings };
}

async function deliverPendingDiscordEvents() {
  const webhookUrl = process.env.DISCORD_MATCH_WEBHOOK_URL;
  if (!webhookUrl) return { delivered: 0, warning: "DISCORD_MATCH_WEBHOOK_URL is not configured" };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("claim_match_automation_events", {
    p_limit: 20,
  });
  if (error) throw new Error(`Failed to claim automation notifications: ${error.message}`);

  let delivered = 0;
  for (const event of (data ?? []) as AutomationEventRow[]) {
    try {
      await sendDiscordMatchAutomationAlert(
        webhookUrl,
        {
          eventType: event.event_type,
          ...event.payload,
        },
        publicSiteUrl(),
      );
      const { error: updateError } = await supabase
        .from("match_automation_events")
        .update({ delivered_at: new Date().toISOString(), claimed_at: null, last_error: null })
        .eq("id", event.id);
      if (updateError) throw updateError;
      delivered += 1;
    } catch (error) {
      const message = errorMessage(error);
      await supabase
        .from("match_automation_events")
        .update({ last_error: message.slice(0, 1000) })
        .eq("id", event.id);
    }
  }

  return { delivered, warning: null };
}

export async function runLolesportsRatingAutomation(
  now: Date = new Date(),
): Promise<LolesportsAutomationSummary> {
  const beforeDelivery = await deliverPendingDiscordEvents();
  const warnings = beforeDelivery.warning ? [beforeDelivery.warning] : [];
  const detailedSets: Array<{ matchId: string; setNumbers: number[] }> = [];
  const enrichedSets: Array<{ matchId: string; setNumbers: number[] }> = [];
  const timelineSets: Array<{ matchId: string; setNumber: number; eventCount: number }> = [];
  const finishBackgroundWork = async () => {
    const drained = await drainPendingEnrichmentQueues(now);
    detailedSets.push(...drained.detailedSets);
    enrichedSets.push(...drained.enrichedSets);
    timelineSets.push(...drained.timelineSets);
    warnings.push(...drained.warnings);

    const afterDelivery = await deliverPendingDiscordEvents();
    if (afterDelivery.warning && !warnings.includes(afterDelivery.warning)) {
      warnings.push(afterDelivery.warning);
    }
    return beforeDelivery.delivered + afterDelivery.delivered;
  };
  const { start, end } = koreaDayBounds(now);
  const supabase = createSupabaseAdminClient();

  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select(MATCH_SELECT)
    .gte("match_date", start.toISOString())
    .lt("match_date", end.toISOString())
    .order("match_date", { ascending: true });
  if (matchError) throw new Error(`Failed to load today's matches: ${matchError.message}`);

  const matches = (matchData ?? []) as MatchRow[];
  if (matches.length === 0) {
    const deliveredNotificationCount = await finishBackgroundWork();
    return {
      polled: false,
      candidateCount: 0,
      externalEventCount: 0,
      reconciledMatchIds: [],
      openedSets: [],
      completedMatchIds: [],
      snapshottedSets: [],
      detailedSets,
      enrichedSets,
      timelineSets,
      deliveredNotificationCount,
      warnings,
    };
  }

  if (!shouldPollLolesportsEvents(matches, now)) {
    const startsAt = getLolesportsPollingStartsAt(matches);
    const pollingWarning = startsAt
      ? `LoL Esports polling skipped until ${startsAt.toISOString()}`
      : "LoL Esports polling skipped because today's match times are invalid";
    const deliveredNotificationCount = await finishBackgroundWork();
    return {
      polled: false,
      candidateCount: 0,
      externalEventCount: 0,
      reconciledMatchIds: [],
      openedSets: [],
      completedMatchIds: [],
      snapshottedSets: [],
      detailedSets,
      enrichedSets,
      timelineSets,
      deliveredNotificationCount,
      warnings: [...warnings, pollingWarning],
    };
  }

  const teamIds = [...new Set(matches.flatMap((match) => [match.team_a_id, match.team_b_id]))];
  const { data: teamData, error: teamError } = await supabase
    .from("teams")
    .select("id, name, short_name")
    .in("id", teamIds);
  if (teamError) throw new Error(`Failed to load match teams: ${teamError.message}`);
  const teams = new Map(
    ((teamData ?? []) as TeamRow[]).map((team) => [
      team.id,
      { id: team.id, name: team.name, shortName: team.short_name } satisfies LocalTeamIdentity,
    ]),
  );

  const candidates = matches.flatMap((match): LocalMatchCandidate[] => {
    const teamA = teams.get(match.team_a_id);
    const teamB = teams.get(match.team_b_id);
    if (!teamA || !teamB) {
      warnings.push(`Match ${match.id}: team identity is missing`);
      return [];
    }
    return [{
      id: match.id,
      matchDate: match.match_date,
      lolesportsMatchId: match.lolesports_match_id,
      teamA,
      teamB,
    }];
  });

  const events = await fetchTrackedLolesportsEvents({ start, end });
  const reconciledMatchIds: string[] = [];
  const openedSets: Array<{ matchId: string; setNumbers: number[] }> = [];
  const completedMatchIds: string[] = [];
  const snapshottedSets: Array<{ matchId: string; setNumbers: number[] }> = [];

  for (const candidate of candidates) {
    const external = findLolesportsMatch(candidate, events);
    if (!external) {
      warnings.push(`Match ${candidate.id}: no matching LoL Esports event`);
      continue;
    }
    if (external.state === "unstarted") continue;
    if (!hasConsistentCompletedScore(external)) {
      warnings.push(
        `Match ${candidate.id}: score total ${external.teamAScore + external.teamBScore} ` +
          `does not match completed games ${external.completedGameCount}`,
      );
      continue;
    }

    const { data, error } = await supabase.rpc("reconcile_lolesports_match_score", {
      p_match_id: candidate.id,
      p_lolesports_match_id: external.lolesportsMatchId,
      p_team_a_score: external.teamAScore,
      p_team_b_score: external.teamBScore,
      p_external_state: external.state,
    });
    if (error) {
      warnings.push(`Match ${candidate.id}: reconcile failed: ${error.message}`);
      continue;
    }

    const result = data as {
      ignored?: boolean;
      openedSetNumbers?: number[];
      matchCompleted?: boolean;
    };
    reconciledMatchIds.push(candidate.id);
    if (result.openedSetNumbers?.length) {
      openedSets.push({ matchId: candidate.id, setNumbers: result.openedSetNumbers });
    }

    // Retry every completed game on every poll. The unique (set_id, source) key makes
    // repeated end events idempotent and also recovers from a transient snapshot failure.
    const completedSetNumbers = [...new Set(
      (external.event.match?.games ?? [])
        .filter((game) => game?.state === "completed" && typeof game.number === "number")
        .map((game) => game!.number!),
    )];
    try {
      const match = matches.find((item) => item.id === candidate.id);
      if (match && completedSetNumbers.length) {
        try {
          const setNumbers = await upsertSetResultSnapshots({
            match,
            external,
            setNumbers: completedSetNumbers,
            observedAt: now,
          });
          if (setNumbers.length) snapshottedSets.push({ matchId: candidate.id, setNumbers });
        } catch (snapshotError) {
          const message = errorMessage(snapshotError);
          warnings.push(`Match ${candidate.id}: result snapshot failed: ${message}`);
        }

        const { data: localSets, error: localSetsError } = await supabase
          .from("sets")
          .select("id, set_number, status")
          .eq("match_id", candidate.id)
          .in("set_number", completedSetNumbers);
        if (localSetsError) throw localSetsError;
        const detailedSetNumbers: number[] = [];
        for (const localSet of localSets ?? []) {
          if (localSet.status === "data_synced") continue;
          const game = external.event.match?.games?.find((item) => item?.number === localSet.set_number);
          if (!game?.id) {
            const message = "LoL Esports game ID is missing";
            warnings.push(`Match ${candidate.id} set ${localSet.set_number}: ${message}`);
            await queueSetDataSyncNotification({
              match,
              setId: localSet.id,
              setNumber: localSet.set_number,
              teamAScore: external.teamAScore,
              teamBScore: external.teamBScore,
              outcome: "failed",
              error: message,
            });
            continue;
          }
          try {
            const detailResult = await syncLolesportsSetGameData({
              setId: localSet.id,
              gameId: game.id,
              localTeamAId: external.localTeamAId,
              localTeamBId: external.localTeamBId,
              externalTeamAId: external.externalTeamAId,
              externalTeamBId: external.externalTeamBId,
              observedAt: now,
            });
            if (detailResult.updated) detailedSetNumbers.push(localSet.set_number);
            if (!detailResult.updated || detailResult.playerStatsUpserted !== 10) {
              await queueSetDataSyncNotification({
                match,
                setId: localSet.id,
                setNumber: localSet.set_number,
                teamAScore: external.teamAScore,
                teamBScore: external.teamBScore,
                outcome: "failed",
                playerStatsUpserted: detailResult.playerStatsUpserted,
                error: detailResult.warning ?? "LoL Esports basic data is incomplete",
              });
            }
            if (detailResult.warning) warnings.push(`Match ${candidate.id} set ${localSet.set_number}: ${detailResult.warning}`);
          } catch (detailError) {
            const message = errorMessage(detailError);
            warnings.push(`Match ${candidate.id} set ${localSet.set_number}: detail sync failed: ${message}`);
            try {
              await queueSetDataSyncNotification({
                match,
                setId: localSet.id,
                setNumber: localSet.set_number,
                teamAScore: external.teamAScore,
                teamBScore: external.teamBScore,
                outcome: "failed",
                error: message,
              });
            } catch (notificationError) {
              const notificationMessage = notificationError instanceof Error
                ? notificationError.message
                : String(notificationError);
              warnings.push(`Match ${candidate.id} set ${localSet.set_number}: ${notificationMessage}`);
            }
          }
        }
        if (detailedSetNumbers.length) {
          detailedSets.push({ matchId: candidate.id, setNumbers: detailedSetNumbers });
        }
      }
    } catch (snapshotError) {
      const message = errorMessage(snapshotError);
      warnings.push(`Match ${candidate.id}: set data workflow failed: ${message}`);
    }
    if (result.matchCompleted) completedMatchIds.push(candidate.id);
    revalidatePath(`/matches/${candidate.id}`);
    revalidatePath("/schedule");
  }

  const deliveredNotificationCount = await finishBackgroundWork();

  return {
    polled: true,
    candidateCount: candidates.length,
    externalEventCount: events.length,
    reconciledMatchIds,
    openedSets,
    completedMatchIds,
    snapshottedSets,
    detailedSets,
    enrichedSets,
    timelineSets,
    deliveredNotificationCount,
    warnings,
  };
}
