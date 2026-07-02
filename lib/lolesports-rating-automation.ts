import { revalidatePath } from "next/cache";

import { fetchTrackedLolesportsEvents } from "@/lib/lolesports";
import {
  findLolesportsMatch,
  hasConsistentCompletedScore,
  type LocalMatchCandidate,
  type LocalTeamIdentity,
} from "@/lib/lolesports-match-matcher";
import { sendDiscordMatchAutomationAlert } from "@/lib/notify/discord";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
};

type TeamRow = {
  id: string;
  name: string;
  short_name: string;
};

type AutomationEventRow = {
  id: string;
  event_type: "set_rating_opened" | "match_completed";
  payload: {
    matchId: string;
    matchName: string;
    setNumber?: number;
    teamAScore: number;
    teamBScore: number;
  };
};

export type LolesportsAutomationSummary = {
  polled: boolean;
  candidateCount: number;
  externalEventCount: number;
  reconciledMatchIds: string[];
  openedSets: Array<{ matchId: string; setNumbers: number[] }>;
  completedMatchIds: string[];
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

function publicSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  return undefined;
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
      const message = error instanceof Error ? error.message : String(error);
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
      "id, name, match_date, status, team_a_id, team_b_id, team_a_score, team_b_score, best_of, lolesports_match_id",
    )
    .gte("match_date", start.toISOString())
    .lt("match_date", end.toISOString())
    .lte("match_date", now.toISOString())
    .neq("status", "completed")
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
    deliveredNotificationCount: beforeDelivery.delivered + afterDelivery.delivered,
    warnings,
  };
}
