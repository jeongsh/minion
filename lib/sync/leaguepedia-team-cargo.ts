import { leaguepediaSourceId } from "../leaguepedia-identity.ts";
import { fetchAuthenticatedLeaguepediaApi } from "./leaguepedia-api.ts";

export type CargoTeam = {
  Page: string;
  Name: string;
  Short: string | null;
  Region: string | null;
  Image: string | null;
  IsDisbanded: string;
};

export function quoteCargoValue(value: string) {
  return '"' + value.replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

export async function queryLeaguepediaCargo<T>(params: Record<string, string>): Promise<T[]> {
  const response = await fetchAuthenticatedLeaguepediaApi(new URLSearchParams({
    action: "cargoquery", format: "json", limit: "500", ...params,
  }));
  if (!response.ok) throw new Error('Leaguepedia 팀 조회 실패 (' + response.status + ').');
  const body = await response.json() as { error?: { info?: string }; cargoquery?: { title: T }[] };
  if (body.error || !body.cargoquery) {
    throw new Error('Leaguepedia 팀 조회 실패: ' + (body.error?.info ?? "응답 형식을 확인할 수 없습니다."));
  }
  return body.cargoquery.map((entry) => entry.title);
}

export function queryLeaguepediaTeams(params: { where: string; order_by?: string; limit?: string }) {
  return queryLeaguepediaCargo<CargoTeam>({
    tables: "Teams=T",
    fields: "T._pageName=Page,T.Name,T.Short,T.Region,T.Image,T.IsDisbanded",
    ...params,
  });
}

export function leaguepediaTeamPayload(row: CargoTeam, logoUrl: string | null) {
  const slug = row.Page.normalize("NFKD").toLowerCase().replace(/['.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return {
    slug, name: row.Name, short_name: row.Short || row.Name,
    primary_color: "#52525B", secondary_color: "#18181B", fan_site_host: null,
    leaguepedia_page: row.Page, source_team_id: leaguepediaSourceId(row.Page),
    is_lck_team: false, imported_scope: "international_event", is_active: row.IsDisbanded !== "1",
    logo_url: logoUrl,
  };
}
