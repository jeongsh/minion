import type { SupabaseClient } from "@supabase/supabase-js";

type RiotParticipant = {
  puuid?: string;
  championName?: string;
  item0?: number;
  item1?: number;
  item2?: number;
  item3?: number;
  item4?: number;
  item5?: number;
  item6?: number;
  teamId?: number;
  teamPosition?: string;
};

type RiotMatchResponse = {
  info?: {
    participants?: RiotParticipant[];
  };
};

type SetRow = {
  id: string;
  match_id: string;
  riot_match_id: string | null;
  blue_team_id: string | null;
  red_team_id: string | null;
};

type StatRow = {
  id: string;
  player_id: string;
  team_id: string;
  position: string;
  champion_id: string | null;
};

type PlayerRow = {
  id: string;
  name: string;
  riot_puuid: string | null;
};

type ChampionRow = {
  id: string;
  slug: string;
  name: string;
  ddragon_id: string | null;
};

export type RiotSetItemsSyncSummary = {
  setId: string;
  riotMatchId: string | null;
  skipped: boolean;
  reason?: string;
  participants: number;
  updated: number;
};

export type RiotMatchItemsSyncSummary = {
  matchId: string;
  sets: number;
  skipped: number;
  updated: number;
  details: RiotSetItemsSyncSummary[];
};

function riotApiKey() {
  const key = process.env.RIOT_API_KEY;

  if (!key) {
    throw new Error("RIOT_API_KEY is required to sync Riot match items.");
  }

  return key;
}

function riotRegionRoute() {
  return process.env.RIOT_REGIONAL_ROUTE || "asia";
}

function normalize(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function positionFromRiot(value: string | null | undefined) {
  const normalized = normalize(value);

  if (normalized === "top") return "TOP";
  if (normalized === "jungle") return "JGL";
  if (normalized === "middle") return "MID";
  if (normalized === "bottom") return "BOT";
  if (normalized === "utility" || normalized === "support") return "SUP";

  return null;
}

function sideTeamId(participant: RiotParticipant, set: SetRow) {
  if (participant.teamId === 100) return set.blue_team_id;
  if (participant.teamId === 200) return set.red_team_id;
  return null;
}

async function fetchRiotMatch(matchId: string) {
  const response = await fetch(
    `https://${riotRegionRoute()}.api.riotgames.com/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
    {
      headers: {
        "X-Riot-Token": riotApiKey(),
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Riot MATCH-V5 request failed for ${matchId}: ${response.status}`);
  }

  return (await response.json()) as RiotMatchResponse;
}

function participantItems(participant: RiotParticipant) {
  return {
    item0: participant.item0 ?? null,
    item1: participant.item1 ?? null,
    item2: participant.item2 ?? null,
    item3: participant.item3 ?? null,
    item4: participant.item4 ?? null,
    item5: participant.item5 ?? null,
    item6: participant.item6 ?? null,
  };
}

function matchParticipantToStat({
  participant,
  set,
  stats,
  playersById,
  championsById,
}: {
  participant: RiotParticipant;
  set: SetRow;
  stats: StatRow[];
  playersById: Map<string, PlayerRow>;
  championsById: Map<string, ChampionRow>;
}) {
  if (participant.puuid) {
    const byPuuid = stats.find((stat) => {
      const player = playersById.get(stat.player_id);
      return player?.riot_puuid && player.riot_puuid === participant.puuid;
    });

    if (byPuuid) return byPuuid;
  }

  const participantPosition = positionFromRiot(participant.teamPosition);
  const participantTeamId = sideTeamId(participant, set);
  const participantChampion = normalize(participant.championName);

  return stats.find((stat) => {
    const champion = stat.champion_id ? championsById.get(stat.champion_id) : null;
    const championKeys = [
      champion?.ddragon_id,
      champion?.slug,
      champion?.name,
    ].map(normalize);

    return (
      stat.position === participantPosition &&
      stat.team_id === participantTeamId &&
      championKeys.includes(participantChampion)
    );
  });
}

export async function syncRiotSetItems(
  supabase: SupabaseClient,
  setId: string,
): Promise<RiotSetItemsSyncSummary> {
  const { data: set, error: setError } = await supabase
    .from("sets")
    .select("id, match_id, riot_match_id, blue_team_id, red_team_id")
    .eq("id", setId)
    .maybeSingle();

  if (setError) throw setError;
  if (!set) {
    return {
      setId,
      riotMatchId: null,
      skipped: true,
      reason: "set not found",
      participants: 0,
      updated: 0,
    };
  }

  const typedSet = set as SetRow;

  if (!typedSet.riot_match_id) {
    return {
      setId,
      riotMatchId: null,
      skipped: true,
      reason: "riot_match_id is empty",
      participants: 0,
      updated: 0,
    };
  }

  const { data: stats, error: statsError } = await supabase
    .from("set_player_stats")
    .select("id, player_id, team_id, position, champion_id")
    .eq("set_id", setId);

  if (statsError) throw statsError;

  const statRows = (stats ?? []) as StatRow[];
  const playerIds = Array.from(new Set(statRows.map((stat) => stat.player_id)));
  const championIds = Array.from(
    new Set(statRows.map((stat) => stat.champion_id).filter(Boolean) as string[]),
  );

  const [{ data: players, error: playersError }, { data: champions, error: championsError }] =
    await Promise.all([
      supabase.from("players").select("id, name, riot_puuid").in("id", playerIds),
      supabase.from("champions").select("id, slug, name, ddragon_id").in("id", championIds),
    ]);

  if (playersError) throw playersError;
  if (championsError) throw championsError;

  const playersById = new Map((players ?? []).map((player) => [player.id, player as PlayerRow]));
  const championsById = new Map(
    (champions ?? []).map((champion) => [champion.id, champion as ChampionRow]),
  );
  const riotMatch = await fetchRiotMatch(typedSet.riot_match_id);
  const participants = riotMatch.info?.participants ?? [];
  let updated = 0;

  for (const participant of participants) {
    const stat = matchParticipantToStat({
      participant,
      set: typedSet,
      stats: statRows,
      playersById,
      championsById,
    });

    if (!stat) {
      continue;
    }

    const { error } = await supabase
      .from("set_player_stats")
      .update(participantItems(participant))
      .eq("id", stat.id);

    if (error) throw error;
    updated += 1;
  }

  return {
    setId,
    riotMatchId: typedSet.riot_match_id,
    skipped: false,
    participants: participants.length,
    updated,
  };
}

export async function syncRiotMatchItems(
  supabase: SupabaseClient,
  matchId: string,
): Promise<RiotMatchItemsSyncSummary> {
  const { data, error } = await supabase
    .from("sets")
    .select("id")
    .eq("match_id", matchId)
    .order("set_number", { ascending: true });

  if (error) throw error;

  const setIds = (data ?? []).map((set) => set.id as string);
  const details: RiotSetItemsSyncSummary[] = [];

  for (const setId of setIds) {
    details.push(await syncRiotSetItems(supabase, setId));
  }

  return {
    matchId,
    sets: setIds.length,
    skipped: details.filter((detail) => detail.skipped).length,
    updated: details.reduce((sum, detail) => sum + detail.updated, 0),
    details,
  };
}
