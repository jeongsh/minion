import type { SupabaseClient } from "@supabase/supabase-js";

const CARGO_API = "https://lol.fandom.com/api.php";
const REQUEST_DELAY_MS = 3000;
const MAX_RETRIES = 8;

const HEAD_COACH_ROLES = new Set(["Head Coach"]);
const COACH_ROLES = new Set(["Coach", "Assistant Coach"]);

// LCK team slugs used in our DB
const LCK_SLUGS = new Set(["hle", "geng", "t1", "dk", "kt", "bro", "fox", "ns", "drx", "soop"]);

type StaffRow = {
  Player: string;
  Team: string;
  Role: string;
};

type TeamRecord = {
  id: string;
  slug: string;
  name: string;
  short_name: string;
  leaguepedia_page: string | null;
};

const TEAM_ALIASES = new Map([
  ["t1", "t1"],
  ["gen.g", "geng"],
  ["gen", "geng"],
  ["geng", "geng"],
  ["hanwha life esports", "hle"],
  ["hle", "hle"],
  ["dplus kia", "dk"],
  ["dk", "dk"],
  ["kt rolster", "kt"],
  ["kt", "kt"],
  ["nongshim redforce", "ns"],
  ["ns", "ns"],
  ["kiwoom drx", "drx"],
  ["drx", "drx"],
  ["hanjin brion", "bro"],
  ["brion", "bro"],
  ["bro", "bro"],
  ["bnk fearx", "fox"],
  ["bfx", "fox"],
  ["dn soopers", "soop"],
  ["dn freecs", "soop"],
  ["dns", "soop"],
  ["soop", "soop"],
]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTeam(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugFor(name: string) {
  return TEAM_ALIASES.get(normalizeTeam(name)) ?? null;
}

async function cargoQuery(params: Record<string, string>, offset = 0): Promise<StaffRow[]> {
  const searchParams = new URLSearchParams({
    action: "cargoquery",
    format: "json",
    limit: "500",
    offset: String(offset),
    ...params,
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(`${CARGO_API}?${searchParams}`, {
      headers: { "user-agent": "LCKHubMinion/0.1 (staff sync; contact: local-dev)" },
    });

    if (!res.ok) throw new Error(`Leaguepedia fetch failed: ${res.status}`);

    const body = (await res.json()) as {
      cargoquery?: Array<{ title: StaffRow }>;
      error?: { code?: string; info?: string };
    };

    if (body.error?.code === "ratelimited") {
      const waitMs = REQUEST_DELAY_MS * (attempt + 2);
      console.warn(`Rate limited. Retrying in ${waitMs}ms...`);
      await sleep(waitMs);
      continue;
    }

    if (body.error) {
      throw new Error(`Cargo error [${body.error.code}]: ${body.error.info}`);
    }

    return (body.cargoquery ?? []).map((entry) => entry.title);
  }

  throw new Error("Rate limit retries exhausted.");
}

async function fetchStaffByRole(role: string): Promise<StaffRow[]> {
  const rows: StaffRow[] = [];
  let offset = 0;

  while (true) {
    const batch = await cargoQuery(
      {
        tables: "Players=P",
        fields: "P.Player,P.Team,P.Role",
        // IsActive 필드 없이 전체 조회 후 클라이언트에서 LCK 팀만 필터링
        where: `P.Role="${role}" AND P.Team IS NOT NULL`,
        order_by: "P.Team",
      },
      offset,
    );

    rows.push(...batch);
    if (batch.length < 500) break;

    offset += 500;
    await sleep(REQUEST_DELAY_MS);
  }

  return rows;
}

export type StaffSyncSummary = {
  rowsFetched: number;
  teamsUpdated: number;
  skipped: Array<{ team: string; role: string; reason: string }>;
};

export async function syncLckStaff(supabase: SupabaseClient): Promise<StaffSyncSummary> {
  const { data: teamsData, error: teamsError } = await supabase
    .from("teams")
    .select("id, slug, name, short_name, leaguepedia_page")
    .eq("is_lck_team", true);

  if (teamsError) throw teamsError;

  const teams = teamsData as TeamRecord[];
  const bySlug = new Map(teams.map((t) => [t.slug, t]));
  const byName = new Map<string, TeamRecord>();
  for (const t of teams) {
    byName.set(normalizeTeam(t.name), t);
    byName.set(normalizeTeam(t.short_name), t);
    if (t.leaguepedia_page) byName.set(normalizeTeam(t.leaguepedia_page), t);
  }

  function resolveTeam(name: string) {
    const slug = slugFor(name);
    if (slug) return bySlug.get(slug) ?? null;
    return byName.get(normalizeTeam(name)) ?? null;
  }

  const staffMap = new Map<string, { headCoach: string | null; coaches: string[] }>();
  const summary: StaffSyncSummary = {
    rowsFetched: 0,
    teamsUpdated: 0,
    skipped: [],
  };

  const rolesToFetch = [
    { role: "Head Coach", isHead: true },
    { role: "Coach", isHead: false },
    { role: "Assistant Coach", isHead: false },
  ];

  for (const { role, isHead } of rolesToFetch) {
    let rows: StaffRow[];
    try {
      rows = await fetchStaffByRole(role);
      await sleep(REQUEST_DELAY_MS);
    } catch (err) {
      console.warn(`Skipping role "${role}": ${(err as Error).message}`);
      continue;
    }

    summary.rowsFetched += rows.length;

    for (const row of rows) {
      const player = row.Player?.trim();
      const teamName = row.Team?.trim();

      if (!player || !teamName) continue;

      const team = resolveTeam(teamName);
      if (!team) continue; // skip non-LCK teams silently

      if (!staffMap.has(team.id)) {
        staffMap.set(team.id, { headCoach: null, coaches: [] });
      }

      const entry = staffMap.get(team.id)!;

      if (isHead) {
        entry.headCoach = player;
      } else {
        if (!entry.coaches.includes(player)) {
          entry.coaches.push(player);
        }
      }
    }
  }

  for (const [teamId, { headCoach, coaches }] of staffMap) {
    const { error } = await supabase
      .from("teams")
      .update({
        head_coach: headCoach,
        coaches: coaches.length > 0 ? coaches.join(", ") : null,
      })
      .eq("id", teamId);

    if (error) throw error;
    summary.teamsUpdated++;
  }

  return summary;
}
