import type { SupabaseClient } from "@supabase/supabase-js";

import {
  collectLeagueEvents,
  dateKeyKST,
  fetchSetVods,
  fetchVodThumbnail,
  LOLESPORTS_LEAGUE_IDS,
  matchKey,
  type LolesportsEvent,
} from "./lolesports-vods.ts";

const HOUR_MS = 60 * 60 * 1_000;

type MatchRow = {
  id: string;
  match_date: string;
  status: string;
  team_a_id: string | null;
  team_b_id: string | null;
  lolesports_match_id: string | null;
};

type SetRow = {
  id: string;
  match_id: string;
  set_number: number;
  status: string;
  result_recorded_at: string | null;
  vod_url: string | null;
  vod_thumbnail_url: string | null;
};

export type MatchVodSyncSummary = {
  matchId: string;
  lolesportsMatchId: string | null;
  vodsFound: number;
  vodsUpdated: number;
  thumbnailsUpdated: number;
  missingSetNumbers: number[];
  reason: "synced" | "match_not_found" | "not_completed" | "lolesports_match_not_found" | "no_sets" | "no_vods";
};

export type MatchVodAutomationSummary = {
  candidates: number;
  attempted: number;
  matchesSynced: number;
  vodsUpdated: number;
  thumbnailsUpdated: number;
  skipped: number;
  errors: Array<{ matchId: string; error: string }>;
};

export type MatchVodAutomationOptions = {
  lookbackHours?: number;
  minAgeHours?: number;
  limit?: number;
  now?: Date;
};

function eventIndex(events: LolesportsEvent[]) {
  return new Map(events.map((event) => [matchKey(dateKeyKST(event.startTime), event.teamCodes), event]));
}

async function collectEventIndex(notBefore: Date) {
  const leagues = Object.entries(LOLESPORTS_LEAGUE_IDS);
  const results = await Promise.allSettled(
    leagues.map(([league, leagueId]) => collectLeagueEvents(league, leagueId, 30, notBefore)),
  );
  const events: LolesportsEvent[] = [];
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") {
      events.push(...result.value);
    } else {
      console.warn(`[match-vods] ${leagues[index][0]} schedule lookup failed`, result.reason);
    }
  }
  return eventIndex(events);
}

async function loadMatch(supabase: SupabaseClient, matchId: string) {
  const { data, error } = await supabase
    .from("matches")
    .select("id, match_date, status, team_a_id, team_b_id, lolesports_match_id")
    .eq("id", matchId)
    .maybeSingle();
  if (error) throw error;
  return data as MatchRow | null;
}

async function resolveEventForMatch(
  supabase: SupabaseClient,
  match: MatchRow,
  eventsByKey?: Map<string, LolesportsEvent>,
) {
  if (match.lolesports_match_id) return match.lolesports_match_id;
  if (!match.team_a_id || !match.team_b_id) return null;

  const { data: teams, error } = await supabase
    .from("teams")
    .select("id, name, short_name")
    .in("id", [match.team_a_id, match.team_b_id]);
  if (error) throw error;

  const codeById = new Map(
    (teams ?? []).map((team: { id: string; name: string | null; short_name: string | null }) => [
      team.id,
      (team.short_name ?? team.name ?? "").toUpperCase(),
    ]),
  );
  const codes = [codeById.get(match.team_a_id) ?? "", codeById.get(match.team_b_id) ?? ""].filter(Boolean);
  if (codes.length !== 2) return null;

  const index =
    eventsByKey ??
    (await collectEventIndex(new Date(new Date(match.match_date).getTime() - 24 * HOUR_MS)));
  const event = index.get(matchKey(dateKeyKST(match.match_date), codes));
  if (!event) return null;

  const { error: updateError } = await supabase
    .from("matches")
    .update({ lolesports_match_id: event.matchId })
    .eq("id", match.id);
  if (updateError) throw updateError;
  return event.matchId;
}

export async function syncMatchVods(
  supabase: SupabaseClient,
  matchId: string,
  options: { eventsByKey?: Map<string, LolesportsEvent> } = {},
): Promise<MatchVodSyncSummary> {
  const match = await loadMatch(supabase, matchId);
  const empty = (reason: MatchVodSyncSummary["reason"], lolesportsMatchId: string | null = null) => ({
    matchId,
    lolesportsMatchId,
    vodsFound: 0,
    vodsUpdated: 0,
    thumbnailsUpdated: 0,
    missingSetNumbers: [],
    reason,
  });

  if (!match) return empty("match_not_found");
  if (match.status !== "completed") return empty("not_completed", match.lolesports_match_id);

  const lolesportsMatchId = await resolveEventForMatch(supabase, match, options.eventsByKey);
  if (!lolesportsMatchId) return empty("lolesports_match_not_found");

  const { data: sets, error: setsError } = await supabase
    .from("sets")
    .select("id, match_id, set_number, status, result_recorded_at, vod_url, vod_thumbnail_url")
    .eq("match_id", matchId)
    .order("set_number", { ascending: true });
  if (setsError) throw setsError;
  if (!sets?.length) return empty("no_sets", lolesportsMatchId);

  const vods = await fetchSetVods(lolesportsMatchId);
  if (!vods.length) return empty("no_vods", lolesportsMatchId);

  const setByNumber = new Map((sets as SetRow[]).map((set) => [set.set_number, set]));
  const missingSetNumbers: number[] = [];
  const linkedVods = vods.flatMap((vod) => {
    const set = setByNumber.get(vod.setNumber);
    if (set) return [{ vod, set }];
    missingSetNumbers.push(vod.setNumber);
    return [];
  });
  const updates = await Promise.all(
    linkedVods.map(async ({ vod, set }) => {
      const thumbnailUrl = set.vod_thumbnail_url ?? (await fetchVodThumbnail(vod.url));
      const { error } = await supabase
        .from("sets")
        .update({
          vod_url: vod.url,
          vod_provider: vod.provider,
          vod_start_seconds: vod.startSeconds,
          vod_synced_at: new Date().toISOString(),
          ...(thumbnailUrl ? { vod_thumbnail_url: thumbnailUrl } : {}),
        })
        .eq("id", set.id);
      if (error) throw error;
      return {
        vodUpdated: set.vod_url !== vod.url,
        thumbnailUpdated: !set.vod_thumbnail_url && Boolean(thumbnailUrl),
      };
    }),
  );
  const vodsUpdated = updates.filter((update) => update.vodUpdated).length;
  const thumbnailsUpdated = updates.filter((update) => update.thumbnailUpdated).length;

  return {
    matchId,
    lolesportsMatchId,
    vodsFound: vods.length,
    vodsUpdated,
    thumbnailsUpdated,
    missingSetNumbers,
    reason: "synced",
  };
}

function completionTime(
  match: Pick<MatchRow, "match_date">,
  sets: Array<Pick<SetRow, "result_recorded_at">>,
) {
  const recordedTimes = sets
    .map((set) => set.result_recorded_at)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  if (recordedTimes.length > 0) return Math.max(...recordedTimes);

  // Older imported matches may not have result_recorded_at. A six-hour offset from
  // scheduled start is a conservative completion estimate for those rows.
  return new Date(match.match_date).getTime() + 6 * HOUR_MS;
}

export function isMatchVodAutomationCandidate(
  match: Pick<MatchRow, "match_date">,
  sets: Array<Pick<SetRow, "status" | "result_recorded_at" | "vod_url" | "vod_thumbnail_url">>,
  now: Date,
  minAgeHours = 3,
) {
  const completedSets = sets.filter((set) => set.status === "finished" || set.status === "data_synced");
  return (
    completedSets.length > 0 &&
    completedSets.some((set) => !set.vod_url || !set.vod_thumbnail_url) &&
    completionTime(match, completedSets) <= now.getTime() - minAgeHours * HOUR_MS
  );
}

export async function runMatchVodAutomation(
  supabase: SupabaseClient,
  options: MatchVodAutomationOptions = {},
): Promise<MatchVodAutomationSummary> {
  const now = options.now ?? new Date();
  const lookbackHours = Math.max(1, options.lookbackHours ?? 48);
  const minAgeHours = Math.max(0, options.minAgeHours ?? 3);
  const limit = Math.min(50, Math.max(1, options.limit ?? 8));
  const notBefore = new Date(now.getTime() - lookbackHours * HOUR_MS);

  const { data: matches, error: matchesError } = await supabase
    .from("matches")
    .select("id, match_date, status, team_a_id, team_b_id, lolesports_match_id")
    .eq("status", "completed")
    .gte("match_date", notBefore.toISOString())
    .order("match_date", { ascending: false });
  if (matchesError) throw matchesError;

  const matchRows = (matches ?? []) as MatchRow[];
  if (!matchRows.length) {
    return { candidates: 0, attempted: 0, matchesSynced: 0, vodsUpdated: 0, thumbnailsUpdated: 0, skipped: 0, errors: [] };
  }

  const { data: sets, error: setsError } = await supabase
    .from("sets")
    .select("id, match_id, set_number, status, result_recorded_at, vod_url, vod_thumbnail_url")
    .in("match_id", matchRows.map((match) => match.id));
  if (setsError) throw setsError;

  const setsByMatch = new Map<string, SetRow[]>();
  for (const set of (sets ?? []) as SetRow[]) {
    const rows = setsByMatch.get(set.match_id) ?? [];
    rows.push(set);
    setsByMatch.set(set.match_id, rows);
  }

  const candidates = matchRows.filter((match) =>
    isMatchVodAutomationCandidate(match, setsByMatch.get(match.id) ?? [], now, minAgeHours),
  );
  const queue = candidates.slice(0, limit);
  const unresolved = queue.some((match) => !match.lolesports_match_id);
  const eventsByKey = unresolved ? await collectEventIndex(notBefore) : undefined;
  const summary: MatchVodAutomationSummary = {
    candidates: candidates.length,
    attempted: queue.length,
    matchesSynced: 0,
    vodsUpdated: 0,
    thumbnailsUpdated: 0,
    skipped: 0,
    errors: [],
  };

  const concurrency = 4;
  for (let start = 0; start < queue.length; start += concurrency) {
    const batch = queue.slice(start, start + concurrency);
    const results = await Promise.allSettled(
      batch.map((match) => syncMatchVods(supabase, match.id, { eventsByKey })),
    );
    for (const [index, result] of results.entries()) {
      if (result.status === "rejected") {
        summary.errors.push({
          matchId: batch[index].id,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        });
      } else if (result.value.reason === "synced") {
        summary.matchesSynced += 1;
        summary.vodsUpdated += result.value.vodsUpdated;
        summary.thumbnailsUpdated += result.value.thumbnailsUpdated;
      } else {
        summary.skipped += 1;
      }
    }
  }

  return summary;
}
