import type { Team } from "@/lib/types";

export type PowerRankingPoint = { date: string; rank: number };
export type PowerRankingTeam = { id: string; code: string; name: string; history: PowerRankingPoint[] };
export type MatchPowerRankings = { status: "ready" | "error"; sourceUrl: string; teams: PowerRankingTeam[] };

/** 공식 페이지의 JSON 전송 데이터만 파싱하며 스크립트는 실행하지 않는다. */
export function parsePowerRankings(html: string): PowerRankingTeam[] {
  const result = new Map<string, PowerRankingTeam>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(visit); return; }
    const row = value as Record<string, unknown>;
    if (row.__typename === "TeamGPR") {
      const team = row.team as { id?: string; code?: string; name?: string } | undefined;
      if (!team?.id || !team.code || !team.name) return;
      const entries = [row.currentTeamGPR, ...(Array.isArray(row.teamGPRHistory) ? row.teamGPRHistory : [])];
      const history = new Map<string, PowerRankingPoint>();
      for (const entry of entries) {
        if (!entry || typeof entry !== "object") continue;
        const item = entry as Record<string, unknown>;
        if (typeof item.rank !== "number" || !Number.isInteger(item.rank) || item.rank < 1 || typeof item.dateCalculated !== "string" || !Number.isFinite(Date.parse(item.dateCalculated))) continue;
        history.set(item.dateCalculated, { date: item.dateCalculated, rank: item.rank });
      }
      result.set(team.id, { id: team.id, code: team.code, name: team.name, history: [...history.values()].sort((a, b) => a.date.localeCompare(b.date)) });
      return;
    }
    Object.values(row).forEach(visit);
  };
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
    if (!match[1].includes('Symbol.for("ApolloSSRDataTransport")')) continue;
    const json = match[1].match(/\.push\((\{[\s\S]*\})\)\s*;?\s*$/)?.[1];
    if (json) {
      // Apollo의 선택적 옵션은 JSON 문자열 밖에 undefined로 직렬화된다.
      const normalized = json.replace(/"(?:\\.|[^"\\])*"|\bundefined\b/g, (token) => token === "undefined" ? "null" : token);
      visit(JSON.parse(normalized));
    }
  }
  if (!result.size) throw new Error("공식 파워랭킹 데이터 구조를 찾지 못했습니다.");
  return [...result.values()];
}

export function teamPowerRanking(team: Team | undefined, rankings: PowerRankingTeam[], before: string) {
  if (!team) return null;
  const codes = new Set([team.shortName, ...(team.identityHistory ?? []).map((item) => item.shortName)].map((value) => value.trim().toUpperCase()));
  const candidates = rankings.filter((item) => item.id === team.sourceTeamId || codes.has(item.code.toUpperCase()));
  if (candidates.length !== 1) return null;
  const history = candidates[0].history.filter((point) => Date.parse(point.date) <= Date.parse(before)).slice(-6);
  return history.length ? { ...candidates[0], history } : null;
}
