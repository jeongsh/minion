import type { SupabaseClient } from "@supabase/supabase-js";
import { leaguepediaSourceId } from "../leaguepedia-identity.ts";
import { fetchAuthenticatedLeaguepediaApi } from "../sync/leaguepedia-api.ts";
import { resolveLeaguepediaImageUrls } from "../sync/leaguepedia-images.ts";
import { findTransferTeam, lckTeamCode, marketEvents, type TransferMarket, type TransferTeam } from "./types.ts";

const TEAM_FIELDS = "id, slug, name, short_name, leaguepedia_page, source_team_id, is_lck_team";
const LEAGUES = ["LPL", "LEC", "LCS", "LCP", "CBLOL"];
const STAGES = ["Cup", "Lock-In", "Spring Season", "Summer Season", "Versus Season", "Split 1", "Split 2", "Split 3"];
// Leaguepedia documents AG.AL as Anyone's Legend's international-event name.
// https://lol.fandom.com/wiki/Anyone%27s_Legend
const EVENT_TEAM_NAMES: Record<string, string> = { "Anyone's Legend": "AG.AL" };

export async function getTransferTeams(client: SupabaseClient): Promise<TransferTeam[]> {
  const [{ data, error }, { data: aliases, error: aliasError }] = await Promise.all([
    client.from("teams").select(TEAM_FIELDS).order("is_lck_team", { ascending: false }).order("name"),
    client.from("leaguepedia_team_aliases").select("team_id, page_name"),
  ]);
  if (error || aliasError) throw new Error("팀 목록을 불러오지 못했습니다.");
  return data.map((team) => ({ ...team, aliases: aliases.filter((alias) => alias.team_id === team.id).map((alias) => alias.page_name) })) as TransferTeam[];
}

function quote(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

async function cargo<T>(params: Record<string, string>): Promise<T[]> {
  const response = await fetchAuthenticatedLeaguepediaApi(new URLSearchParams({ action: "cargoquery", format: "json", limit: "500", ...params }));
  if (!response.ok) throw new Error(`Leaguepedia 팀 조회 실패 (${response.status}).`);
  const body = await response.json() as { error?: { code?: string; info?: string }; cargoquery?: { title: T }[] };
  if (body.error || !body.cargoquery) throw new Error(`Leaguepedia 팀 조회 실패: ${body.error?.info ?? "응답 형식을 확인할 수 없습니다."}`);
  return body.cargoquery.map((entry) => entry.title);
}

type CargoTeam = { Page: string; Name: string; Short: string; Region: string; Image: string; IsDisbanded: string };

export async function syncTransferTeams(client: SupabaseClient, season: number) {
  const teams = await getTransferTeams(client);
  const pages = LEAGUES.flatMap((league) => STAGES.map((stage) => `${league}/${season} Season/${stage}`));
  const pairs = await cargo<{ Team1: string; Team2: string }>({
    tables: "MatchSchedule=M", fields: "M.Team1,M.Team2", group_by: "M.Team1,M.Team2",
    where: `M.OverviewPage IN (${pages.map(quote).join(",")})`,
  });
  // Grouped regular-season pairs stay below Cargo's page size. Never silently truncate.
  if (pairs.length === 500) throw new Error("해외 리그 참가팀 조회 한도를 초과했습니다.");
  if (!pairs.length) throw new Error(`${season} 해외 주요 리그 참가팀을 찾지 못했습니다.`);
  const { data: market, error: marketError } = await client.from("lck_transfer_markets").select("*").eq("season", season).maybeSingle();
  if (marketError) throw new Error("이적 기록의 팀을 불러오지 못했습니다.");
  const names = [...new Set([
    ...pairs.flatMap((pair) => [pair.Team1, pair.Team2]),
    ...(market ? marketEvents(market as TransferMarket).flatMap((event) => [event.from, event.to]) : []),
  ])].filter((name) => name && !/^(?:TBD|TBA|FA|무소속|미정)$/i.test(name) && !lckTeamCode(name) && !findTransferTeam(name, teams));
  if (!names.length) return { created: 0, unresolved: [] as string[] };

  // MediaWiki redirects resolve renamed teams before querying their metadata.
  const canonical = new Map<string, string>();
  for (let index = 0; index < names.length; index += 40) {
    const chunk = names.slice(index, index + 40);
    const response = await fetchAuthenticatedLeaguepediaApi(new URLSearchParams({ action: "query", format: "json", redirects: "1", titles: chunk.join("|") }));
    if (!response.ok) throw new Error(`Leaguepedia 팀 별칭 조회 실패 (${response.status}).`);
    const body = await response.json() as { error?: { info?: string }; query?: { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[] } };
    if (body.error || !body.query) throw new Error(body.error?.info ?? "Leaguepedia 팀 별칭을 확인하지 못했습니다.");
    const redirects = new Map([...(body.query.normalized ?? []), ...(body.query.redirects ?? [])].map((entry) => [entry.from, entry.to]));
    for (const name of chunk) {
      let page = name;
      const seen = new Set<string>();
      while (redirects.has(page) && !seen.has(page)) { seen.add(page); page = redirects.get(page)!; }
      canonical.set(name, page);
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  const candidates = [...new Set([...names, ...canonical.values()])];
  const metadataByPage = new Map<string, CargoTeam>();
  for (let index = 0; index < candidates.length; index += 40) {
    const list = candidates.slice(index, index + 40).map(quote).join(",");
    const rows = await cargo<CargoTeam>({ tables: "Teams=T", fields: "T._pageName=Page,T.Name,T.Short,T.Region,T.Image,T.IsDisbanded", where: `(T._pageName IN (${list}) OR T.Name IN (${list}) OR T.Short IN (${list}))` });
    if (rows.length === 500) throw new Error("해외팀 정보 조회 한도를 초과했습니다.");
    for (const row of rows) metadataByPage.set(row.Page, row);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  const metadata = [...metadataByPage.values()];
  let created = 0;
  const unresolved: string[] = [];
  const images = await resolveLeaguepediaImageUrls(metadata.filter((row) => row.Region !== "Korea" && !findTransferTeam(row.Page, teams)).map((row) => row.Image));
  for (const name of names) {
    const page = canonical.get(name) ?? name;
    const exact = metadata.filter((row) => row.Page === page);
    const matches = exact.length ? exact : metadata.filter((row) => [row.Name, row.Short].some((value) => value.toLowerCase() === name.toLowerCase()));
    if (matches.length !== 1 || matches[0].Region === "Korea") { unresolved.push(name); continue; }
    const row = matches[0];
    let team = findTransferTeam(row.Page, teams) ?? findTransferTeam(row.Name, teams)
      ?? findTransferTeam(EVENT_TEAM_NAMES[row.Page] ?? "", teams);
    if (!team) {
      const slug = row.Page.normalize("NFKD").toLowerCase().replace(/['.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      if (!slug) { unresolved.push(name); continue; }
      const { data, error } = await client.from("teams").upsert({
        slug, name: row.Name, short_name: row.Short || row.Name,
        primary_color: "#52525B", secondary_color: "#18181B", fan_site_host: null,
        leaguepedia_page: row.Page, source_team_id: leaguepediaSourceId(row.Page),
        is_lck_team: false, imported_scope: "international_event", is_active: row.IsDisbanded !== "1",
        logo_url: images.get(row.Image) ?? null,
      }, { onConflict: "slug", ignoreDuplicates: true }).select(TEAM_FIELDS).maybeSingle();
      if (error) throw new Error(`해외팀 ${row.Name} 등록 실패: ${error.message}`);
      if (data) { team = { ...data, aliases: [] } as TransferTeam; created++; }
      else {
        const { data: existing, error: existingError } = await client.from("teams").select(TEAM_FIELDS).eq("slug", slug).single();
        if (existingError) throw new Error(`해외팀 ${row.Name} 확인 실패: ${existingError.message}`);
        team = { ...existing, aliases: [] } as TransferTeam;
        if (team.is_lck_team || team.source_team_id !== leaguepediaSourceId(row.Page)) throw new Error(`${row.Name}의 기존 팀 식별자가 다릅니다.`);
      }
      teams.push(team);
    }
    const aliasPages = [...new Set([name, row.Page])];
    const { error: aliasError } = await client.from("leaguepedia_team_aliases").upsert(aliasPages.map((page_name) => ({ team_id: team.id, page_name })), { onConflict: "page_name", ignoreDuplicates: true });
    if (aliasError) throw new Error(`${row.Name}의 팀 별칭 저장 실패: ${aliasError.message}`);
    team.aliases.push(...aliasPages);
  }
  return { created, unresolved };
}
