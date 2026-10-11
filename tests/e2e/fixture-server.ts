import { createServer } from "node:http";
import { teams } from "../../lib/team-themes";

// The smoke suite needs known teams, not production data or deployment secrets.
// Keep this read-only PostgREST fixture outside the application runtime.
const teamRows = teams.map((team) => ({
  ...Object.fromEntries(Object.entries(team).map(([key, value]) => [key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`), value])),
  is_lck_team: true,
  is_active: true,
}));
const tournamentRows = [{ id: "e2e-lck-2026", name: "LCK 2026", season: 2026, category: "LCK", region: "Korea", league: "LCK" }];
const matchRows = Array.from({ length: 20 }, (_, index) => ({
  id: `e2e-match-${index}`, tournament_id: "e2e-lck-2026", stage_id: null,
  name: "T1 vs GEN", match_date: `2026-10-${String(index + 1).padStart(2, "0")}T08:00:00.000Z`,
  status: "scheduled", team_a_id: teams[0].id, team_b_id: teams[1].id,
  team_a_score: 0, team_b_score: 0, best_of: 3, winner_team_id: null,
}));
const tables: Record<string, Record<string, unknown>[]> = { teams: teamRows, tournaments: tournamentRows, matches: matchRows };

createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1:3101");
  response.setHeader("Content-Type", "application/json");
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "apikey, authorization, content-type, x-client-info, prefer, range");
  if (request.method === "OPTIONS") { response.writeHead(204).end(); return; }
  if (!["GET", "HEAD"].includes(request.method ?? "")) {
    response.writeHead(405).end(JSON.stringify({ message: "Smoke fixtures are read-only" }));
    return;
  }
  if (url.pathname === "/health") { response.end("{}"); return; }
  if (url.pathname.startsWith("/auth/")) {
    response.writeHead(401).end(JSON.stringify({ message: "No fixture user is signed in" }));
    return;
  }
  if (!url.pathname.startsWith("/rest/v1/")) { response.writeHead(404).end("{}"); return; }
  let rows = tables[url.pathname.slice("/rest/v1/".length)] ?? [];
  for (const [field, filter] of url.searchParams) {
    if (filter.startsWith("eq.")) rows = rows.filter((row) => String(row[field]) === filter.slice(3));
    if (filter.startsWith("gte.")) rows = rows.filter((row) => String(row[field]) >= filter.slice(4));
    if (filter.startsWith("lt.")) rows = rows.filter((row) => String(row[field]) < filter.slice(3));
    if (filter.startsWith("in.(")) {
      const values = filter.slice(4, -1).split(",").map((value) => value.replace(/^"|"$/g, ""));
      rows = rows.filter((row) => values.includes(String(row[field])));
    }
  }
  response.setHeader("Content-Range", rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0");
  const single = request.headers.accept?.includes("application/vnd.pgrst.object+json");
  response.end(request.method === "HEAD" ? undefined : JSON.stringify(single ? rows[0] ?? null : rows));
}).listen(3101, "127.0.0.1");
