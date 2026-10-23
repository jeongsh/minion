import type { SupabaseClient } from "@supabase/supabase-js";
import type { CargoBriefingRow, LeaguepediaBriefingRows } from "../match-briefing-data.ts";
import { BRIEFING_MIN_SETS } from "../match-briefing-stats.ts";
import { fetchLeaguepediaBriefingRows, fetchLeaguepediaTeamRegions } from "./leaguepedia-briefing.ts";
import { championCatalogEntryForValue, catalogChampionId, normalizeChampionKey } from "../champions.ts";

type BriefingChampion = { id: string; name: string; slug: string; ddragon_id?: string | null };

export function addBriefingChampionIds(rows: LeaguepediaBriefingRows, champions: BriefingChampion[]) {
  const ids = new Map<string, string>();
  for (const champion of champions) {
    for (const value of [champion.name, champion.slug, champion.ddragon_id]) {
      if (value) ids.set(normalizeChampionKey(value), champion.id);
    }
  }
  for (const row of rows.players) {
    if (!row.Champion) continue;
    const catalog = championCatalogEntryForValue(row.Champion);
    const id = ids.get(normalizeChampionKey(row.Champion))
      ?? (catalog ? ids.get(normalizeChampionKey(catalog.ddragon_id)) ?? catalogChampionId(catalog.ddragon_id) : undefined);
    if (id) row.ChampionId = id;
  }
}

export function briefingRowsSetCount(rows: LeaguepediaBriefingRows) {
  return rows.matches.reduce((sum, row) => sum + (Number(row.Team1Score) || 0) + (Number(row.Team2Score) || 0), 0);
}

/** 별칭으로 기록된 팀명을 대표 페이지명으로 바꿔 병합 시 같은 팀으로 인식되게 한다. */
export function canonicalizeBriefingTeamNames(rows: LeaguepediaBriefingRows, names: Set<string>, page: string): LeaguepediaBriefingRows {
  const rename = (row: Record<string, string | undefined>) => Object.fromEntries(Object.entries(row).map(([key, value]) =>
    ["Team1", "Team2", "Team"].includes(key) && value && names.has(value) ? [key, page] : [key, value]));
  return { matches: rows.matches.map(rename), games: rows.games.map(rename), players: rows.players.map(rename) };
}

/** 새 표본에 속한 기존 원본을 보존해 일시적인 상세 조회 실패로 지표가 지워지지 않게 한다. */
export function mergeTeamBriefingSourceRows(previous: LeaguepediaBriefingRows | undefined, incoming: LeaguepediaBriefingRows): LeaguepediaBriefingRows {
  const merge = (old: CargoBriefingRow[], fresh: CargoBriefingRow[], key: (row: CargoBriefingRow) => string) => {
    const rows = new Map<string, CargoBriefingRow>();
    for (const row of [...old, ...fresh]) {
      const id = key(row);
      rows.set(id, { ...rows.get(id), ...Object.fromEntries(Object.entries(row).filter(([, value]) => value != null && value !== "")) });
    }
    return [...rows.values()];
  };
  const matchIds = new Set(incoming.matches.map((row) => row.MatchId));
  const matches = merge((previous?.matches ?? []).filter((row) => matchIds.has(row.MatchId)), incoming.matches, (row) => row.MatchId!);
  const games = merge((previous?.games ?? []).filter((row) => matchIds.has(row.MatchId)), incoming.games, (row) => row.GameId!);
  const gameIds = new Set(games.map((row) => row.GameId));
  const players = merge((previous?.players ?? []).filter((row) => gameIds.has(row.GameId)), incoming.players,
    (row) => JSON.stringify([row.GameId, row.Link]));
  return { matches, games, players };
}

/** 팀의 Leaguepedia 최근 경기를 BRIEFING_MIN_SETS 이상 받아 team_briefing_sources에 저장한다. */
export async function storeTeamBriefingSource(admin: SupabaseClient, teamId: string, page: string, { cutoff = new Date().toISOString() } = {}) {
  // 국제 대회 스폰서명과 리그 팀명이 다른 팀이 있어 저장된 별칭까지 함께 조회한다.
  const { data: aliases, error: aliasError } = await admin.from("leaguepedia_team_aliases").select("page_name").eq("team_id", teamId);
  if (aliasError) throw new Error(`팀 별칭 조회 실패: ${aliasError.message}`);
  const names = new Set([page, ...(aliases ?? []).map((alias) => alias.page_name as string)]);
  const incoming = canonicalizeBriefingTeamNames(
    await fetchLeaguepediaBriefingRows([...names], cutoff, BRIEFING_MIN_SETS), names, page);
  if (!incoming.matches.length) throw new Error("Leaguepedia 최근 경기 없음");
  const { data: champions, error: championError } = await admin.from("champions").select("id,name,slug,ddragon_id");
  if (championError) throw new Error(`챔피언 목록 조회 실패: ${championError.message}`);
  addBriefingChampionIds(incoming, champions ?? []);
  const { data: previous, error: readError } = await admin.from("team_briefing_sources").select("rows").eq("team_id", teamId).maybeSingle();
  if (readError) throw new Error(`기존 팀 브리핑 원본 조회 실패: ${readError.message}`);
  const rows = mergeTeamBriefingSourceRows(previous?.rows as LeaguepediaBriefingRows | undefined, incoming);
  const latest = rows.matches.map((row) => Date.parse(`${row.MatchDateTime?.replace(" ", "T")}Z`))
    .filter(Number.isFinite).sort((a, b) => b - a)[0];
  const sets = briefingRowsSetCount(rows);
  const { error } = await admin.from("team_briefing_sources").upsert({
    team_id: teamId,
    leaguepedia_page: page,
    rows,
    set_count: sets,
    latest_match_at: latest ? new Date(latest).toISOString() : null,
    fetched_at: new Date().toISOString(),
  });
  if (error) throw new Error(`팀 브리핑 원본 저장 실패: ${error.message}`);
  return { sets, games: rows.games.length, players: rows.players.length, rows };
}

/** 지역이 비어 있는 비LCK 팀의 Leaguepedia 지역을 채운다. */
export async function fillMissingTeamRegions(admin: SupabaseClient) {
  const { data: teams, error } = await admin.from("teams").select("id,leaguepedia_page,source_team_id")
    .eq("is_lck_team", false).is("region", null);
  if (error) throw new Error(`팀 지역 조회 실패: ${error.message}`);
  if (!teams?.length) return 0;
  const { data: aliases, error: aliasError } = await admin.from("leaguepedia_team_aliases").select("team_id,page_name")
    .in("team_id", teams.map((team) => team.id));
  if (aliasError) throw new Error(`팀 별칭 조회 실패: ${aliasError.message}`);
  const names = new Map(teams.map((team) => [team.id as string, [
    team.leaguepedia_page || team.source_team_id?.replace(/^lp:/, ""),
    ...(aliases ?? []).filter((alias) => alias.team_id === team.id).map((alias) => alias.page_name),
  ].filter((name): name is string => Boolean(name))]));
  const regions = await fetchLeaguepediaTeamRegions([...new Set([...names.values()].flat())]);
  let filled = 0;
  for (const [teamId, candidates] of names) {
    const region = candidates.map((name) => regions.get(name)).find(Boolean);
    if (!region) continue;
    const { error: updateError } = await admin.from("teams").update({ region }).eq("id", teamId);
    if (updateError) throw new Error(`팀 지역 저장 실패: ${updateError.message}`);
    filled += 1;
  }
  return filled;
}
