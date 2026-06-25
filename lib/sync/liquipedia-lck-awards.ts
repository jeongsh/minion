import { gunzipSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";

const LIQUIPEDIA_API = "https://liquipedia.net/leagueoflegends/api.php";
const REQUEST_DELAY_MS = 2500; // Liquipedia: max 1 req/2s

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function liquipediaFetch(params: URLSearchParams): Promise<unknown> {
  const res = await fetch(`${LIQUIPEDIA_API}?${params}`, {
    headers: {
      "Accept-Encoding": "gzip",
      "User-Agent": "LCKHubMinion/0.1 (LCK awards sync; contact: tmdgus4720@gmail.com)",
      "Accept": "application/json",
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  const encoding = res.headers.get("content-encoding");
  const text = encoding === "gzip" ? gunzipSync(buffer).toString("utf-8") : buffer.toString("utf-8");
  return JSON.parse(text);
}

export type LckAwardsSyncSummary = {
  yearsProcessed: number[];
  inserted: number;
  skipped: Array<{ year: number; award: string; player: string; reason: string }>;
};

// 수상명 → award_type 매핑
const AWARD_NAME_MAP: Record<string, string> = {
  "mvp":                       "lck_mvp",
  "most valuable player":      "lck_mvp",
  "top of the year":           "lck_top",
  "best top laner":            "lck_top",
  "jungle of the year":        "lck_jungle",
  "best jungler":              "lck_jungle",
  "jungler of the year":       "lck_jungle",
  "mid of the year":           "lck_mid",
  "best mid laner":            "lck_mid",
  "bottom of the year":        "lck_bot",
  "bot of the year":           "lck_bot",
  "best bot laner":            "lck_bot",
  "adc of the year":           "lck_bot",
  "support of the year":       "lck_support",
  "best support":              "lck_support",
  "rookie of the year":        "lck_rookie",
  "best rookie":               "lck_rookie",
  "coach of the year":         "lck_coach",
  "best coach":                "lck_coach",
  "best sportsmanship award":  "lck_sportsmanship",
  "sportsmanship award":       "lck_sportsmanship",
};

function resolveAwardType(rawName: string): string | null {
  const key = rawName.toLowerCase().trim();
  return AWARD_NAME_MAP[key] ?? null;
}

async function fetchWikitext(page: string): Promise<string> {
  const params = new URLSearchParams({
    action: "query",
    titles: page,
    prop: "revisions",
    rvprop: "content",
    rvslots: "main",
    format: "json",
    formatversion: "2",
  });

  const body = (await liquipediaFetch(params)) as {
    query?: {
      pages?: Array<{
        missing?: boolean;
        revisions?: Array<{ slots?: { main?: { content?: string } }; content?: string }>;
      }>;
    };
    error?: { code: string; info: string };
  };

  if (body.error) throw new Error(`Liquipedia error: ${body.error.info}`);

  const pages = body.query?.pages ?? [];
  if (!pages.length || pages[0].missing) return "";

  const rev = pages[0].revisions?.[0];
  return rev?.slots?.main?.content ?? rev?.content ?? "";
}

// wikitext에서 [[Player|Display]] 또는 [[Player]] → Player 추출
function extractLink(raw: string): string {
  const m = raw.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
  return m ? m[1].trim() : raw.replace(/\[|\]/g, "").trim();
}

// wikitext 테이블 파싱 → [{ award, player, team }]
function parseAwardTable(wikitext: string): Array<{ award: string; player: string; team: string }> {
  const results: Array<{ award: string; player: string; team: string }> = [];

  // 위키 테이블 블록 추출 ({| ... |})
  const tableMatches = wikitext.matchAll(/\{\|[\s\S]*?\|\}/g);

  for (const tableMatch of tableMatches) {
    const table = tableMatch[0];
    const rows = table.split(/\n\|-/).slice(1); // 헤더 행 제외

    for (const row of rows) {
      const cells = row
        .split(/\n[|!]/)
        .map((c) => c.trim())
        .filter(Boolean);

      if (cells.length < 2) continue;

      const award = extractLink(cells[0]);
      const player = extractLink(cells[1]);
      const team = cells[2] ? extractLink(cells[2]) : "";

      if (award && player && award.length < 80) {
        results.push({ award, player, team });
      }
    }
  }

  // 테이블 외에 {{AchievementTable}} 등 템플릿 방식도 처리
  const templateMatches = wikitext.matchAll(
    /\|\s*award\s*=\s*([^\n|]+)[\s\S]*?\|\s*player\s*=\s*([^\n|]+)(?:[\s\S]*?\|\s*team\s*=\s*([^\n|}]+))?/gi,
  );
  for (const m of templateMatches) {
    results.push({
      award: extractLink(m[1]),
      player: extractLink(m[2]),
      team: m[3] ? extractLink(m[3]) : "",
    });
  }

  return results;
}

export async function syncLckPlayerAwards(
  supabase: SupabaseClient,
  options: {
    years?: number[];
    force?: boolean;
    onProgress?: (message: string) => void;
  } = {},
): Promise<LckAwardsSyncSummary> {
  const currentYear = new Date().getFullYear();
  const { years = [currentYear], force = false, onProgress } = options;

  const summary: LckAwardsSyncSummary = {
    yearsProcessed: [],
    inserted: 0,
    skipped: [],
  };

  // 선수 목록 (이름 매칭용)
  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id, name, slug");
  if (playersError) throw playersError;

  const playerByName = new Map(players.map((p) => [p.name.toLowerCase(), p]));
  const playerBySlug = new Map(players.map((p) => [p.slug.toLowerCase(), p]));

  // 팀 목록
  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("id, name, slug, short_name");
  if (teamsError) throw teamsError;

  const teamByName = new Map<string, (typeof teams)[0]>();
  for (const t of teams) {
    teamByName.set(t.name.toLowerCase(), t);
    teamByName.set(t.slug.toLowerCase(), t);
    if (t.short_name) teamByName.set(t.short_name.toLowerCase(), t);
  }

  // 기존 수상 데이터 (중복 방지)
  const existingSet = new Set<string>();
  if (!force) {
    const { data: existing } = await supabase
      .from("team_awards")
      .select("team_id, year, award_type, player_name");
    for (const r of existing ?? []) {
      existingSet.add(`${r.team_id}::${r.year}::${r.award_type}::${r.player_name ?? ""}`);
    }
  }

  for (const year of years) {
    const page = `LCK/${year}/Awards`;
    onProgress?.(`[${year}] ${page} 조회 중...`);

    const wikitext = await fetchWikitext(page);
    await sleep(REQUEST_DELAY_MS);

    if (!wikitext) {
      onProgress?.(`[${year}] 페이지 없음 - 스킵`);
      continue;
    }

    const entries = parseAwardTable(wikitext);
    onProgress?.(`[${year}] ${entries.length}개 항목 파싱됨`);

    for (const entry of entries) {
      const awardType = resolveAwardType(entry.award);
      if (!awardType) {
        summary.skipped.push({ year, award: entry.award, player: entry.player, reason: "award_not_mapped" });
        continue;
      }

      // 선수 찾기
      const playerKey = entry.player.toLowerCase();
      const player = playerByName.get(playerKey) ?? playerBySlug.get(playerKey);

      if (!player) {
        summary.skipped.push({ year, award: entry.award, player: entry.player, reason: "player_not_found" });
        continue;
      }

      // 팀 찾기 (없어도 진행)
      const team = teamByName.get(entry.team.toLowerCase());

      const key = `${team?.id ?? ""}::${year}::${awardType}::${player.name}`;
      if (existingSet.has(key)) {
        onProgress?.(`SKIP ${year} ${entry.award} - ${player.name}`);
        continue;
      }

      const { error } = await supabase.from("team_awards").insert({
        team_id: team?.id ?? null,
        year,
        tournament_name: `${year} LCK Awards`,
        award_type: awardType,
        player_id: player.id,
        player_name: player.name,
        source: "liquipedia",
      });

      if (error) {
        summary.skipped.push({ year, award: entry.award, player: entry.player, reason: error.message });
        continue;
      }

      onProgress?.(`INSERT ${year} ${entry.award} → ${player.name} (${awardType})`);
      summary.inserted++;
    }

    summary.yearsProcessed.push(year);
  }

  return summary;
}
