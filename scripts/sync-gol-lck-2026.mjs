import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const TOURNAMENTS = [
  {
    name: "LCK Cup 2026",
    slug: "LCK%20Cup%202026",
    split: "Cup",
    startDate: "2026-01-14",
    endDate: "2026-03-01",
  },
  {
    name: "LCK 2026 Rounds 1-2",
    slug: "LCK%202026%20Rounds%201-2",
    split: "Rounds 1-2",
    startDate: "2026-04-01",
    endDate: "2026-05-31",
  },
  {
    name: "LCK 2026 Road to MSI",
    slug: "LCK%202026%20Road%20to%20MSI",
    split: "Road to MSI",
    startDate: "2026-06-06",
    endDate: "2026-06-14",
  },
];

const TEAM_ALIASES = new Map([
  ["bnk fearx", "fox"],
  ["bro", "bro"],
  ["brion", "bro"],
  ["hanjin brion", "bro"],
  ["ok savings bank brion", "bro"],
  ["oksavingsbank brion", "bro"],
  ["dplus kia", "dk"],
  ["dk", "dk"],
  ["dn soopers", "soop"],
  ["soop", "soop"],
  ["drx", "drx"],
  ["kiwoom drx", "drx"],
  ["gen.g", "geng"],
  ["geng", "geng"],
  ["hanwha life esports", "hle"],
  ["hle", "hle"],
  ["kt rolster", "kt"],
  ["kt", "kt"],
  ["nongshim redforce", "ns"],
  ["ns", "ns"],
  ["t1", "t1"],
]);

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");

  try {
    const content = readFileSync(envPath, "utf8");

    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) {
        process.env[key] = valueParts.join("=");
      }
    }
  } catch {
    // .env.local is optional when the script is executed with env vars already set.
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&#039;", "'")
    .replaceAll("&quot;", '"')
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTeamName(value) {
  return decodeHtml(value)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function teamSlugFor(name) {
  return TEAM_ALIASES.get(normalizeTeamName(name));
}

function bestOfFromScore(scoreA, scoreB) {
  return Math.max(scoreA, scoreB) >= 3 ? 5 : 3;
}

function statusFromScore(scoreA, scoreB) {
  return Number.isFinite(scoreA) && Number.isFinite(scoreB) ? "completed" : "scheduled";
}

async function fetchGolTournament(tournament) {
  const url = `https://gol.gg/tournament/tournament-matchlist/${tournament.slug}/`;
  const response = await fetch(url, {
    headers: {
      "user-agent": "LCKHubMinion/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`GOL fetch failed: ${response.status} ${url}`);
  }

  const html = await response.text();
  const rowPattern =
    /<tr><td class='text-left'><a href='\.\.\/game\/stats\/(?<gameId>\d+)\/page-summary\/'[^>]*>(?<gameName>.*?)<\/a><\/td><td class='text-right [^']*'>(?<teamA>.*?)<\/td><td class='text-center'>(?<score>.*?)<\/td><td class='[^']*'>(?<teamB>.*?)<\/td><td class='text-center'>(?<stage>.*?)<\/td><td class='text-center'>(?<patch>.*?)<\/td><td class='text-center'>(?<date>.*?)<\/td><\/tr>/g;
  const rows = [];

  for (const match of html.matchAll(rowPattern)) {
    const score = decodeHtml(match.groups.score);
    const scoreParts = score.split("-").map((part) => Number.parseInt(part.trim(), 10));

    rows.push({
      source: "gol.gg",
      sourceMatchId: `gol:${match.groups.gameId}`,
      sourceUrl: `https://gol.gg/game/stats/${match.groups.gameId}/page-summary/`,
      gameName: decodeHtml(match.groups.gameName),
      teamAName: decodeHtml(match.groups.teamA),
      teamBName: decodeHtml(match.groups.teamB),
      teamAScore: scoreParts[0],
      teamBScore: scoreParts[1],
      stageName: decodeHtml(match.groups.stage),
      patch: decodeHtml(match.groups.patch),
      date: decodeHtml(match.groups.date),
      tournament,
    });
  }

  return rows.reverse();
}

async function getRequiredTeams(supabase) {
  const { data, error } = await supabase
    .from("teams")
    .select("id, slug, name, short_name");

  if (error) {
    throw error;
  }

  return new Map(data.map((team) => [team.slug, team]));
}

async function findOrCreateTournament(supabase, tournament) {
  const sourceTournamentId = `gol:${tournament.slug}`;
  const { data: existing, error: selectError } = await supabase
    .from("tournaments")
    .select("id")
    .eq("source", "gol.gg")
    .eq("source_tournament_id", sourceTournamentId)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  const payload = {
    name: tournament.name,
    season: 2026,
    category: "domestic",
    region: "Korea",
    league: "LCK",
    split: tournament.split,
    start_date: tournament.startDate,
    end_date: tournament.endDate,
    source: "gol.gg",
    source_tournament_id: sourceTournamentId,
  };

  if (existing) {
    const { data, error } = await supabase
      .from("tournaments")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error) {
      throw error;
    }
    return data.id;
  }

  const { data, error } = await supabase
    .from("tournaments")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw error;
  }
  return data.id;
}

async function findOrCreateStage(supabase, tournamentId, stageName, index) {
  const { data: existing, error: selectError } = await supabase
    .from("stages")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("name", stageName)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    const { error } = await supabase
      .from("stages")
      .update({ order_index: index })
      .eq("id", existing.id);

    if (error) {
      throw error;
    }
    return existing.id;
  }

  const { data, error } = await supabase
    .from("stages")
    .insert({
      tournament_id: tournamentId,
      name: stageName,
      order_index: index,
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }
  return data.id;
}

async function findOrUpsertMatch(supabase, payload) {
  const { data: existing, error: selectError } = await supabase
    .from("matches")
    .select("id")
    .eq("leaguepedia_match_id", payload.leaguepedia_match_id)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    const { error } = await supabase
      .from("matches")
      .update(payload)
      .eq("id", existing.id);

    if (error) {
      throw error;
    }
    return { id: existing.id, created: false };
  }

  const { data, error } = await supabase
    .from("matches")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    throw error;
  }
  return { id: data.id, created: true };
}

async function sync() {
  loadEnvFile();

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
  const teams = await getRequiredTeams(supabase);
  const summary = {
    tournaments: 0,
    stages: 0,
    matchesCreated: 0,
    matchesUpdated: 0,
    skipped: [],
  };

  for (const tournament of TOURNAMENTS) {
    const tournamentId = await findOrCreateTournament(supabase, tournament);
    summary.tournaments += 1;

    const rows = await fetchGolTournament(tournament);
    const stageOrder = new Map();

    for (const row of rows) {
      const teamASlug = teamSlugFor(row.teamAName);
      const teamBSlug = teamSlugFor(row.teamBName);
      const teamA = teamASlug ? teams.get(teamASlug) : null;
      const teamB = teamBSlug ? teams.get(teamBSlug) : null;

      if (!teamA || !teamB) {
        summary.skipped.push({
          sourceMatchId: row.sourceMatchId,
          teamAName: row.teamAName,
          teamBName: row.teamBName,
          reason: "team_alias_not_found",
        });
        continue;
      }

      if (!stageOrder.has(row.stageName)) {
        stageOrder.set(row.stageName, stageOrder.size + 1);
      }

      const stageId = await findOrCreateStage(
        supabase,
        tournamentId,
        row.stageName,
        stageOrder.get(row.stageName),
      );
      summary.stages += 1;

      const winnerTeamId =
        row.teamAScore > row.teamBScore ? teamA.id : row.teamBScore > row.teamAScore ? teamB.id : null;
      const { created } = await findOrUpsertMatch(supabase, {
        tournament_id: tournamentId,
        stage_id: stageId,
        name: `${teamA.short_name} vs ${teamB.short_name}`,
        match_date: `${row.date}T10:00:00+09:00`,
        status: statusFromScore(row.teamAScore, row.teamBScore),
        team_a_id: teamA.id,
        team_b_id: teamB.id,
        team_a_score: row.teamAScore,
        team_b_score: row.teamBScore,
        best_of: bestOfFromScore(row.teamAScore, row.teamBScore),
        winner_team_id: winnerTeamId,
        leaguepedia_match_id: row.sourceMatchId,
        venue: "LoL PARK",
        vod_url: row.sourceUrl,
      });

      if (created) {
        summary.matchesCreated += 1;
      } else {
        summary.matchesUpdated += 1;
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
}

sync().catch((error) => {
  console.error(error);
  process.exit(1);
});
