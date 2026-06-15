import { canQuerySupabase, createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Champion,
  CommunityPost,
  FanRating,
  Match,
  Player,
  PlayerStatLine,
  SetPickBan,
  SetResult,
  Stage,
  Team,
  TeamIdentityHistory,
  TeamSocialPost,
  TeamAward,
  TeamStanding,
  TeamVideo,
  Tournament,
} from "@/lib/types";

type TeamRow = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  logo_url: string | null;
  logo_white_url: string | null;
  background_url: string | null;
  primary_color: string;
  secondary_color: string;
  fan_site_host: string;
  official_homepage_url: string | null;
  official_youtube_url: string | null;
  official_x_url: string | null;
  official_instagram_url: string | null;
  leaguepedia_page: string | null;
  source_team_id: string | null;
};

type TeamIdentityHistoryRow = {
  id: string;
  team_id: string;
  name: string;
  short_name: string;
  slug: string;
  logo_url: string | null;
  sponsor_name: string | null;
  effective_from: string;
  effective_to: string | null;
  note: string | null;
};

type PlayerRow = {
  id: string;
  slug: string;
  name: string;
  real_name: string | null;
  team_id: string | null;
  position: Player["position"];
  profile_image_url: string | null;
  stream_url: string | null;
  solo_queue_account: string | null;
  is_starter: boolean | null;
};

type ChampionRow = {
  id: string;
  slug: string;
  name: string;
  image_url: string | null;
  ddragon_id: string | null;
  ddragon_key: string | null;
  ddragon_version: string | null;
};

type SetPickBanRow = {
  id: string;
  set_id: string;
  phase: string;
  action_type: SetPickBan["actionType"];
  order_index: number;
  team_id: string | null;
  champion_id: string | null;
  side: SetPickBan["side"] | null;
};

type SetPlayerStatsRow = {
  set_id: string;
  player_id: string;
  team_id: string;
  position: PlayerStatLine["position"];
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  damage_to_champions: number;
  vision_score: number;
};

type MatchRow = {
  id: string;
  tournament_id: string | null;
  stage_id: string | null;
  name: string;
  match_date: string;
  status: Match["status"];
  team_a_id: string | null;
  team_b_id: string | null;
  team_a_score: number | null;
  team_b_score: number | null;
  best_of?: number | null;
  winner_team_id?: string | null;
  official_pom_player_id: string | null;
  leaguepedia_match_id?: string | null;
  venue?: string | null;
  vod_url?: string | null;
};

type TournamentRow = {
  id: string;
  name: string;
  season: number;
  category: string;
  split?: string | null;
  region?: string | null;
  league?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  source?: string | null;
  source_tournament_id?: string | null;
};

type StageRow = {
  id: string;
  tournament_id: string;
  name: string;
  order_index: number;
};

type SetRow = {
  id: string;
  match_id: string;
  set_number: number;
  winner_team_id: string | null;
  blue_team_id: string | null;
  red_team_id: string | null;
  duration_seconds: number | null;
  blue_kills: number | null;
  red_kills: number | null;
  blue_gold: number | null;
  red_gold: number | null;
  blue_dragons: number | null;
  red_dragons: number | null;
  blue_barons: number | null;
  red_barons: number | null;
  blue_towers: number | null;
  red_towers: number | null;
  patch?: string | null;
  leaguepedia_game_id?: string | null;
  riot_match_id?: string | null;
  riot_platform_game_id?: string | null;
};

type TeamSocialPostRow = {
  id: string;
  team_id: string;
  platform: TeamSocialPost["platform"];
  title: string;
  content: string | null;
  source_url: string;
  thumbnail_url: string | null;
  published_at: string | null;
};

type TeamVideoRow = {
  id: string;
  team_id: string;
  platform: TeamVideo["platform"];
  title: string;
  video_url: string;
  thumbnail_url: string | null;
  published_at: string | null;
  view_count: number;
};

type CommunityPostRow = {
  id: string;
  board_type: string;
  site_scope: CommunityPost["siteScope"];
  team_id: string | null;
  title: string;
  content: string;
  like_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
};

type FanRatingRow = {
  id: string;
  set_id: string;
  match_id: string;
  player_id: string;
  team_id: string;
  rating: number;
  review: string | null;
  created_at: string;
};

export type FanPogVote = {
  id: string;
  setId: string;
  matchId: string;
  playerId: string;
  teamId: string;
  createdAt: string;
};

type FanPogVoteRow = {
  id: string;
  set_id: string;
  match_id: string;
  player_id: string;
  team_id: string;
  created_at: string;
};

async function fromSupabase<T>(query: () => Promise<T>, emptyValue: T) {
  if (!canQuerySupabase()) {
    return emptyValue;
  }

  return query();
}

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    logoUrl: row.logo_url ?? "",
    logoWhiteUrl: row.logo_white_url ?? "",
    backgroundUrl: row.background_url ?? "",
    primaryColor: row.primary_color,
    secondaryColor: row.secondary_color,
    fanSiteHost: row.fan_site_host,
    officialHomepageUrl: row.official_homepage_url ?? "",
    officialYoutubeUrl: row.official_youtube_url ?? "",
    officialXUrl: row.official_x_url ?? "",
    officialInstagramUrl: row.official_instagram_url ?? "",
    leaguepediaPage: row.leaguepedia_page ?? "",
    sourceTeamId: row.source_team_id ?? "",
  };
}

function mapTeamIdentityHistory(row: TeamIdentityHistoryRow): TeamIdentityHistory {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    shortName: row.short_name,
    slug: row.slug,
    logoUrl: row.logo_url ?? "",
    sponsorName: row.sponsor_name ?? undefined,
    effectiveFrom: row.effective_from,
    effectiveTo: row.effective_to ?? undefined,
    note: row.note ?? undefined,
  };
}

function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    realName: row.real_name ?? "",
    teamId: row.team_id ?? "",
    position: row.position,
    profileImageUrl: row.profile_image_url ?? "",
    streamUrl: row.stream_url ?? undefined,
    soloQueueAccount: row.solo_queue_account ?? undefined,
    isStarter: row.is_starter ?? false,
  };
}

function mapChampion(row: ChampionRow): Champion {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    imageUrl: row.image_url ?? undefined,
  };
}

function mapMatch(row: MatchRow): Match {
  return {
    id: row.id,
    tournamentId: row.tournament_id ?? "",
    stageId: row.stage_id ?? "",
    name: row.name,
    matchDate: row.match_date,
    status: row.status,
    teamAId: row.team_a_id ?? "",
    teamBId: row.team_b_id ?? "",
    teamAScore: row.team_a_score,
    teamBScore: row.team_b_score,
    bestOf: row.best_of ?? null,
    winnerTeamId: row.winner_team_id ?? null,
    officialPomPlayerId: row.official_pom_player_id,
    leaguepediaMatchId: row.leaguepedia_match_id ?? null,
    venue: row.venue ?? null,
    vodUrl: row.vod_url ?? null,
  };
}

function mapTournament(row: TournamentRow): Tournament {
  return {
    id: row.id,
    name: row.name,
    season: row.season,
    category: row.category,
    split: row.split ?? null,
    region: row.region ?? null,
    league: row.league ?? null,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    source: row.source ?? null,
    sourceTournamentId: row.source_tournament_id ?? null,
  };
}

function mapStage(row: StageRow): Stage {
  return {
    id: row.id,
    tournamentId: row.tournament_id,
    name: row.name,
    orderIndex: row.order_index,
  };
}

function mapSet(row: SetRow): SetResult {
  return {
    id: row.id,
    matchId: row.match_id,
    setNumber: row.set_number,
    winnerTeamId: row.winner_team_id,
    blueTeamId: row.blue_team_id ?? "",
    redTeamId: row.red_team_id ?? "",
    durationSeconds: row.duration_seconds,
    blueKills: row.blue_kills,
    redKills: row.red_kills,
    blueGold: row.blue_gold,
    redGold: row.red_gold,
    blueDragons: row.blue_dragons,
    redDragons: row.red_dragons,
    blueBarons: row.blue_barons,
    redBarons: row.red_barons,
    blueTowers: row.blue_towers,
    redTowers: row.red_towers,
    patch: row.patch ?? null,
    leaguepediaGameId: row.leaguepedia_game_id ?? null,
    riotMatchId: row.riot_match_id ?? null,
    riotPlatformGameId: row.riot_platform_game_id ?? null,
  };
}

function mapCommunityPost(row: CommunityPostRow): CommunityPost {
  return {
    id: row.id,
    boardType: row.board_type,
    siteScope: row.site_scope,
    teamId: row.team_id ?? undefined,
    title: row.title,
    content: row.content,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    viewCount: row.view_count,
    createdAt: row.created_at,
  };
}

function mapFanRating(row: FanRatingRow): FanRating {
  return {
    id: row.id,
    setId: row.set_id,
    matchId: row.match_id,
    playerId: row.player_id,
    teamId: row.team_id,
    rating: Number(row.rating),
    review: row.review ?? "",
    createdAt: row.created_at,
  };
}

export async function getTeamStandings(tournamentId?: string): Promise<TeamStanding[]> {
  return fromSupabase(async () => {
    let query = createSupabaseServerClient()
      .from("team_standings")
      .select("*")
      .order("rank", { ascending: true });

    if (tournamentId) {
      query = query.eq("tournament_id", tournamentId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data as {
      id: string;
      tournament_id: string;
      team_id: string;
      rank: number;
      wins: number;
      losses: number;
      set_diff: number;
      win_rate: number | null;
      kda: number | null;
      kills: number;
      deaths: number;
      assists: number;
    }[]).map((row) => ({
      id: row.id,
      tournamentId: row.tournament_id,
      teamId: row.team_id,
      rank: row.rank,
      wins: row.wins,
      losses: row.losses,
      setDiff: row.set_diff,
      winRate: row.win_rate,
      kda: row.kda,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
    }));
  }, []);
}

export async function getTeams() {
  return fromSupabase(async () => {
    const { data, error } = await createSupabaseServerClient()
      .from("teams")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data as TeamRow[]).map(mapTeam);
  }, []);
}

export async function getPlayerAwards(playerName: string, playerId?: string): Promise<TeamAward[]> {
  return fromSupabase(async () => {
    const conditions = [`player_name.eq.${playerName}`];
    if (playerId) conditions.push(`player_id.eq.${playerId}`);

    const { data, error } = await createSupabaseServerClient()
      .from("team_awards")
      .select("*")
      .or(conditions.join(","))
      .order("year", { ascending: false });

    if (error) throw error;

    return (data as {
      id: string; team_id: string; year: number; tournament_name: string;
      award_type: string; player_id: string | null; player_name: string | null;
      notes: string | null; source: string; leaguepedia_page: string | null;
    }[]).map((row) => ({
      id: row.id, teamId: row.team_id, year: row.year,
      tournamentName: row.tournament_name,
      awardType: row.award_type as TeamAward["awardType"],
      playerId: row.player_id, playerName: row.player_name,
      notes: row.notes, source: row.source, leaguepediaPage: row.leaguepedia_page,
    }));
  }, []);
}

export async function getTeamAwards(teamId?: string): Promise<TeamAward[]> {
  return fromSupabase(async () => {
    let query = createSupabaseServerClient()
      .from("team_awards")
      .select("*")
      .order("year", { ascending: false })
      .order("tournament_name", { ascending: true });

    if (teamId) query = query.eq("team_id", teamId);

    const { data, error } = await query;
    if (error) throw error;

    return (data as {
      id: string;
      team_id: string;
      year: number;
      tournament_name: string;
      award_type: string;
      player_id: string | null;
      player_name: string | null;
      notes: string | null;
      source: string;
      leaguepedia_page: string | null;
    }[]).map((row) => ({
      id: row.id,
      teamId: row.team_id,
      year: row.year,
      tournamentName: row.tournament_name,
      awardType: row.award_type as TeamAward["awardType"],
      playerId: row.player_id,
      playerName: row.player_name,
      notes: row.notes,
      source: row.source,
      leaguepediaPage: row.leaguepedia_page,
    }));
  }, []);
}

export async function getTeamsSortedByRank(): Promise<Team[]> {
  const [teams, standings] = await Promise.all([getTeams(), getTeamStandings()]);
  const rankMap = new Map(standings.map((s) => [s.teamId, s.rank]));
  return [...teams].sort((a, b) => {
    const ra = rankMap.get(a.id) ?? 9999;
    const rb = rankMap.get(b.id) ?? 9999;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  });
}

export async function getTeamBySlug(slug: string) {
  const teams = await getTeams();
  return teams.find((team) => team.slug === slug);
}

export async function getTeamByFanSiteHost(host: string) {
  const teams = await getTeams();
  return teams.find((team) => team.fanSiteHost === host);
}

export async function getTeamIdentityHistories() {
  return fromSupabase(async () => {
    const { data, error } = await createSupabaseServerClient()
      .from("team_identity_histories")
      .select("*")
      .order("effective_from", { ascending: false });

    if (error) {
      throw error;
    }

    return (data as TeamIdentityHistoryRow[]).map(mapTeamIdentityHistory);
  }, []);
}

export async function getPlayers() {
  return fromSupabase(async () => {
    const { data, error } = await createSupabaseServerClient()
      .from("players")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data as PlayerRow[]).map(mapPlayer);
  }, []);
}

export async function getTournaments() {
  return fromSupabase(async () => {
    const { data, error } = await createSupabaseServerClient()
      .from("tournaments")
      .select(
        "id, name, season, category, split, region, league, start_date, end_date, source, source_tournament_id",
      )
      .order("start_date", { ascending: true, nullsFirst: false });

    if (error) {
      throw error;
    }

    return (data as TournamentRow[]).map(mapTournament);
  }, []);
}

export async function getStages() {
  return fromSupabase(async () => {
    const { data, error } = await createSupabaseServerClient()
      .from("stages")
      .select("id, tournament_id, name, order_index")
      .order("order_index", { ascending: true });

    if (error) {
      throw error;
    }

    return (data as StageRow[]).map(mapStage);
  }, []);
}

export async function getPlayerBySlug(slug: string) {
  const players = await getPlayers();
  return players.find((player) => player.slug === slug);
}

export async function getMatches() {
  return fromSupabase(async () => {
    const { data, error } = await createSupabaseServerClient()
      .from("matches")
      .select("*")
      .order("match_date", { ascending: true });

    if (error) {
      throw error;
    }

    return (data as MatchRow[]).map(mapMatch);
  }, []);
}

export async function getMatchById(matchId: string) {
  const matches = await getMatches();
  return matches.find((match) => match.id === matchId);
}

export async function getSetsByMatchId(matchId: string) {
  return fromSupabase(async () => {
    const { data, error } = await createSupabaseServerClient()
      .from("sets")
      .select("*")
      .eq("match_id", matchId)
      .order("set_number", { ascending: true });

    if (error) {
      throw error;
    }

    return (data as SetRow[]).map(mapSet);
  }, []);
}

export async function getSets() {
  return fromSupabase(async () => {
    const { data, error } = await createSupabaseServerClient()
      .from("sets")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data as SetRow[]).map(mapSet);
  }, []);
}

export async function getSetById(setId: string) {
  return fromSupabase(async () => {
    const { data, error } = await createSupabaseServerClient()
      .from("sets")
      .select("*")
      .eq("id", setId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? mapSet(data as SetRow) : undefined;
  }, undefined);
}

export async function getChampions() {
  return fromSupabase(async () => {
    const { data, error } = await createSupabaseServerClient()
      .from("champions")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data as ChampionRow[]).map(mapChampion);
  }, []);
}

export async function getSetPicksBans(setId?: string) {
  return fromSupabase(async () => {
    let query = createSupabaseServerClient()
      .from("set_picks_bans")
      .select("*")
      .order("order_index", { ascending: true });

    if (setId) {
      query = query.eq("set_id", setId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data as SetPickBanRow[]).map((row) => ({
      id: row.id,
      setId: row.set_id,
      phase: row.phase,
      actionType: row.action_type,
      orderIndex: row.order_index,
      teamId: row.team_id ?? "",
      championId: row.champion_id ?? "",
      side: row.side ?? "blue",
    }));
  }, []);
}

export async function getPlayerStatLines(setId?: string) {
  return fromSupabase(async () => {
    let query = createSupabaseServerClient()
      .from("set_player_stats")
      .select(
        "set_id, player_id, team_id, position, kills, deaths, assists, cs, gold, damage_to_champions, vision_score",
      )
      .order("position", { ascending: true });

    if (setId) {
      query = query.eq("set_id", setId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return (data as SetPlayerStatsRow[]).map((row) => ({
      setId: row.set_id,
      playerId: row.player_id,
      teamId: row.team_id,
      position: row.position,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      cs: row.cs,
      gold: row.gold,
      damageToChampions: row.damage_to_champions,
      teamKills: 0,
      teamDamage: 0,
      gameMinutes: 0,
      visionScore: row.vision_score,
    }));
  }, []);
}

export async function getTeamNews(teamId: string) {
  return fromSupabase(async () => {
    const supabase = createSupabaseServerClient();
    const [videosResult, socialPostsResult] = await Promise.all([
      supabase
        .from("team_videos")
        .select("*")
        .eq("team_id", teamId)
        .order("published_at", { ascending: false }),
      supabase
        .from("team_social_posts")
        .select("*")
        .eq("team_id", teamId)
        .order("published_at", { ascending: false }),
    ]);

    if (videosResult.error) {
      throw videosResult.error;
    }
    if (socialPostsResult.error) {
      throw socialPostsResult.error;
    }

    return {
      videos: (videosResult.data as TeamVideoRow[]).map((row) => ({
        id: row.id,
        teamId: row.team_id,
        platform: row.platform,
        title: row.title,
        videoUrl: row.video_url,
        thumbnailUrl: row.thumbnail_url ?? "",
        publishedAt: row.published_at ?? "",
        viewCount: row.view_count,
      })),
      socialPosts: (socialPostsResult.data as TeamSocialPostRow[]).map((row) => ({
        id: row.id,
        teamId: row.team_id,
        platform: row.platform,
        title: row.title,
        content: row.content ?? "",
        sourceUrl: row.source_url,
        thumbnailUrl: row.thumbnail_url ?? undefined,
        publishedAt: row.published_at ?? "",
      })),
    };
  }, { videos: [], socialPosts: [] });
}

export async function getCommunityPosts() {
  return fromSupabase(async () => {
    const { data, error } = await createSupabaseServerClient()
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data as CommunityPostRow[]).map(mapCommunityPost);
  }, []);
}

export async function getFanRatings() {
  return fromSupabase(async () => {
    const { data, error } = await createSupabaseServerClient()
      .from("fan_ratings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data as FanRatingRow[]).map(mapFanRating);
  }, []);
}

export async function getPlayerPomCount(playerId: string): Promise<number> {
  return fromSupabase(async () => {
    const { count, error } = await createSupabaseServerClient()
      .from("matches")
      .select("*", { count: "exact", head: true })
      .eq("official_pom_player_id", playerId);

    if (error) throw error;
    return count ?? 0;
  }, 0);
}

export async function getFanPogVotes(): Promise<FanPogVote[]> {
  return fromSupabase(async () => {
    const { data, error } = await createSupabaseServerClient()
      .from("fan_pog_votes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return (data as FanPogVoteRow[]).map((row) => ({
      id: row.id,
      setId: row.set_id,
      matchId: row.match_id,
      playerId: row.player_id,
      teamId: row.team_id,
      createdAt: row.created_at,
    }));
  }, []);
}
