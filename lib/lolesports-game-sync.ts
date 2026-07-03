import { dragonCounts, fetchLolesportsGameData } from "./lolesports-game-data.ts";
import { createSupabaseAdminClient } from "./supabase/admin.ts";

type SyncSetInput = {
  setId: string;
  gameId: string;
  localTeamAId: string;
  localTeamBId: string;
  externalTeamAId: string | null;
  externalTeamBId: string | null;
  observedAt: Date;
};

type PlayerRow = {
  id: string;
  team_id: string | null;
  name: string;
  slug: string;
  position: string | null;
};

type ChampionRow = {
  id: string;
  name: string;
  slug: string;
  ddragon_id: string | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").normalize("NFKC").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function positionFromRole(role: string | null | undefined) {
  const key = normalize(role);
  if (key === "top") return "TOP";
  if (key === "jungle") return "JGL";
  if (key === "mid" || key === "middle") return "MID";
  if (key === "bottom" || key === "bot" || key === "adc") return "BOT";
  if (key === "support" || key === "sup") return "SUP";
  return null;
}

function localTeamId(
  externalId: string | null | undefined,
  input: Pick<SyncSetInput, "externalTeamAId" | "externalTeamBId" | "localTeamAId" | "localTeamBId">,
) {
  const canonical = (value: string | null | undefined) => value?.split(":").at(-1) ?? null;
  if (externalId && canonical(externalId) === canonical(input.externalTeamAId)) return input.localTeamAId;
  if (externalId && canonical(externalId) === canonical(input.externalTeamBId)) return input.localTeamBId;
  return null;
}

function findPlayer(
  players: PlayerRow[],
  summonerName: string | null | undefined,
  teamId: string,
  position: string,
) {
  const summonerKey = normalize(summonerName);
  const candidates = players.filter((player) => player.team_id === teamId);
  return candidates.find((player) =>
    player.position === position &&
    [player.name, player.slug].some((value) => {
      const key = normalize(value);
      return key && (summonerKey === key || summonerKey.endsWith(key));
    }),
  ) ?? candidates.find((player) =>
    [player.name, player.slug].some((value) => {
      const key = normalize(value);
      return key && (summonerKey === key || summonerKey.endsWith(key));
    }),
  ) ?? null;
}

function findChampion(champions: ChampionRow[], ddragonId: string | null | undefined) {
  const key = normalize(ddragonId);
  return champions.find((champion) =>
    [champion.ddragon_id, champion.slug, champion.name].some((value) => normalize(value) === key),
  ) ?? null;
}

function finite(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function setIfNumber(target: Record<string, unknown>, key: string, value: number | null | undefined) {
  const parsed = finite(value);
  if (parsed !== null) target[key] = parsed;
}

export async function syncLolesportsSetGameData(input: SyncSetInput) {
  const game = await fetchLolesportsGameData(input.gameId, input.observedAt);
  const blueTeamId = localTeamId(game.blueTeamMetadata?.esportsTeamId, input);
  const redTeamId = localTeamId(game.redTeamMetadata?.esportsTeamId, input);
  if (!blueTeamId || !redTeamId || blueTeamId === redTeamId) {
    return { updated: false, playerStatsUpserted: 0, warning: "could not map live-stat team ids" };
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: playerData, error: playerError }, { data: championData, error: championError }] = await Promise.all([
    supabase.from("players").select("id, team_id, name, slug, position").in("team_id", [blueTeamId, redTeamId]),
    supabase.from("champions").select("id, name, slug, ddragon_id"),
  ]);
  if (playerError) throw new Error(`Failed to load players for live stats: ${playerError.message}`);
  if (championError) throw new Error(`Failed to load champions for live stats: ${championError.message}`);
  const players = (playerData ?? []) as PlayerRow[];
  const champions = (championData ?? []) as ChampionRow[];

  const blueDragons = dragonCounts(game.blueTeam?.dragons);
  const redDragons = dragonCounts(game.redTeam?.dragons);
  const setPatch: Record<string, unknown> = {
    blue_team_id: blueTeamId,
    red_team_id: redTeamId,
    status: "finished",
  };
  if (game.patch) setPatch.patch = game.patch;
  setIfNumber(setPatch, "duration_seconds", game.durationSeconds);
  setIfNumber(setPatch, "blue_kills", game.blueTeam?.totalKills);
  setIfNumber(setPatch, "red_kills", game.redTeam?.totalKills);
  setIfNumber(setPatch, "blue_gold", game.blueTeam?.totalGold);
  setIfNumber(setPatch, "red_gold", game.redTeam?.totalGold);
  setIfNumber(setPatch, "blue_towers", game.blueTeam?.towers);
  setIfNumber(setPatch, "red_towers", game.redTeam?.towers);
  setIfNumber(setPatch, "blue_barons", game.blueTeam?.barons);
  setIfNumber(setPatch, "red_barons", game.redTeam?.barons);
  Object.assign(setPatch, {
    blue_dragons: blueDragons.total,
    red_dragons: redDragons.total,
    blue_clouds: blueDragons.clouds,
    red_clouds: redDragons.clouds,
    blue_infernals: blueDragons.infernals,
    red_infernals: redDragons.infernals,
    blue_mountains: blueDragons.mountains,
    red_mountains: redDragons.mountains,
    blue_oceans: blueDragons.oceans,
    red_oceans: redDragons.oceans,
    blue_hextechs: blueDragons.hextechs,
    red_hextechs: redDragons.hextechs,
    blue_chemtechs: blueDragons.chemtechs,
    red_chemtechs: redDragons.chemtechs,
    blue_elders: blueDragons.elders,
    red_elders: redDragons.elders,
  });

  const statPayload = game.participants.flatMap((participant) => {
    const position = positionFromRole(participant.metadata.role);
    const teamId = participant.side === "blue" ? blueTeamId : redTeamId;
    if (!position) return [];
    const player = findPlayer(players, participant.metadata.summonerName, teamId, position);
    if (!player) return [];
    const champion = findChampion(champions, participant.metadata.championId);
    const detail = participant.detail;
    const window = participant.window;
    const items = (detail?.items ?? []).slice(0, 7);
    while (items.length < 7) items.push(null);
    const perks = detail?.perkMetadata?.perks ?? [];
    const minutes = game.durationSeconds && game.durationSeconds > 0 ? game.durationSeconds / 60 : null;
    return [{
      set_id: input.setId,
      player_id: player.id,
      team_id: teamId,
      side: participant.side,
      position,
      champion_id: champion?.id ?? null,
      kills: finite(detail?.kills) ?? finite(window?.kills) ?? 0,
      deaths: finite(detail?.deaths) ?? finite(window?.deaths) ?? 0,
      assists: finite(detail?.assists) ?? finite(window?.assists) ?? 0,
      cs: finite(detail?.creepScore) ?? finite(window?.creepScore) ?? 0,
      gold: finite(detail?.totalGoldEarned) ?? finite(window?.totalGold) ?? 0,
      damage_to_champions: 0,
      damage_share: finite(detail?.championDamageShare),
      vision_score: 0,
      wards_placed: finite(detail?.wardsPlaced) ?? 0,
      wards_killed: finite(detail?.wardsDestroyed) ?? 0,
      cs_per_minute: minutes ? (finite(detail?.creepScore) ?? finite(window?.creepScore) ?? 0) / minutes : null,
      item0: items[0], item1: items[1], item2: items[2], item3: items[3],
      item4: items[4], item5: items[5], item6: items[6],
      rune0: perks[0] ?? null,
      rune1: detail?.perkMetadata?.subStyleId ?? null,
    }];
  });

  if (statPayload.length > 0) {
    const { error } = await supabase.from("set_player_stats")
      .upsert(statPayload, { onConflict: "set_id,player_id" });
    if (error) throw new Error(`Failed to upsert LoL Esports player stats: ${error.message}`);
  }
  if (statPayload.length === 10) setPatch.status = "data_synced";

  const { error: setError } = await supabase.from("sets").update(setPatch).eq("id", input.setId);
  if (setError) throw new Error(`Failed to update set from LoL Esports: ${setError.message}`);
  return {
    updated: true,
    playerStatsUpserted: statPayload.length,
    warning: statPayload.length === 10 ? null : `mapped ${statPayload.length}/10 players`,
  };
}
