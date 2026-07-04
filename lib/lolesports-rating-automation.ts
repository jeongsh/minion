import { revalidatePath } from "next/cache";

import { fetchTrackedLolesportsEvents } from "@/lib/lolesports";
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

  const retryAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const updatePending = async (
    status: "rate_limited" | "failed",
    message: string,
  ) => {
    for (const row of pending) {
      await supabase.from("set_result_snapshots").update({
        leaguepedia_sync_status: status,
        leaguepedia_sync_attempts: (row.leaguepedia_sync_attempts ?? 0) + 1,
        leaguepedia_retry_at: retryAt,
        leaguepedia_last_error: message.slice(0, 1000),
      }).eq("id", row.id);
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
      const hasDamage = setPlayers.some((entry) => (entry.damage_to_champions ?? 0) > 0);
      const complete = picks >= 10 && bans >= 10 && setPlayers.length >= 10 && hasDamage;
      if (!complete) {
        await supabase.from("set_result_snapshots").update({
          leaguepedia_sync_status: "failed",
          leaguepedia_sync_attempts: (row.leaguepedia_sync_attempts ?? 0) + 1,
          leaguepedia_retry_at: retryAt,
          leaguepedia_last_error: `Incomplete Leaguepedia data: picks=${picks}, bans=${bans}, players=${setPlayers.length}`,
        }).eq("id", row.id);
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

async function runTimelineEnrichment({ matchId, now }: { matchId: string; now: Date }) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("set_result_snapshots")
    .select("id, set_id, set_number, timeline_sync_attempts")
    .eq("match_id", matchId)
    .neq("timeline_sync_status", "succeeded")
    .or(`timeline_retry_at.is.null,timeline_retry_at.lte.${now.toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw new Error(`Failed to load timeline enrichment queue: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;

  const retryAt = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const attempts = (row.timeline_sync_attempts ?? 0) + 1;
  try {
    const result = await syncLeaguepediaTimelineForSet(supabase, row.set_id);
    if (result.status === "succeeded") {
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
        timeline_retry_at: retryAt,
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
        timeline_retry_at: retryAt,
        timeline_last_error: message.slice(0, 1000),
      })
      .eq("id", row.id);
    return null;
  }
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
  const { start, end } = koreaDayBounds(now);
  const supabase = createSupabaseAdminClient();

  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .select(
      "id, name, match_date, status, team_a_id, team_b_id, team_a_score, team_b_score, best_of, lolesports_match_id, leaguepedia_match_id",
    )
    .gte("match_date", start.toISOString())
    .lt("match_date", end.toISOString())
    .order("match_date", { ascending: true });
  if (matchError) throw new Error(`Failed to load today's matches: ${matchError.message}`);

  const matches = (matchData ?? []) as MatchRow[];
  if (matches.length === 0) {
    return {
      polled: false,
      candidateCount: 0,
      externalEventCount: 0,
      reconciledMatchIds: [],
      openedSets: [],
      completedMatchIds: [],
      snapshottedSets: [],
      detailedSets: [],
      enrichedSets: [],
      timelineSets: [],
      deliveredNotificationCount: beforeDelivery.delivered,
      warnings,
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
  const detailedSets: Array<{ matchId: string; setNumbers: number[] }> = [];
  const enrichedSets: Array<{ matchId: string; setNumbers: number[] }> = [];
  const timelineSets: Array<{ matchId: string; setNumber: number; eventCount: number }> = [];

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
    const match = matches.find((item) => item.id === candidate.id);
    if (match) {
      try {
        const setNumbers = await runLeaguepediaEnrichment({
          match,
          teamAScore: external.teamAScore,
          teamBScore: external.teamBScore,
          now,
        });
        if (setNumbers.length) enrichedSets.push({ matchId: candidate.id, setNumbers });
      } catch (enrichmentError) {
        const message = errorMessage(enrichmentError);
        warnings.push(`Match ${candidate.id}: Leaguepedia enrichment workflow failed: ${message}`);
      }
      try {
        const timeline = await runTimelineEnrichment({ matchId: match.id, now });
        if (timeline) timelineSets.push({ matchId: match.id, ...timeline });
      } catch (timelineError) {
        warnings.push(`Match ${candidate.id}: timeline enrichment workflow failed: ${errorMessage(timelineError)}`);
      }
    }
    if (result.matchCompleted) completedMatchIds.push(candidate.id);
    revalidatePath(`/matches/${candidate.id}`);
    revalidatePath("/schedule");
  }

  const afterDelivery = await deliverPendingDiscordEvents();
  if (afterDelivery.warning && !warnings.includes(afterDelivery.warning)) {
    warnings.push(afterDelivery.warning);
  }

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
    deliveredNotificationCount: beforeDelivery.delivered + afterDelivery.delivered,
    warnings,
  };
}
