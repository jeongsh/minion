// 주간 AI 리포트 생성 스크립트.
//
//   npm run report:weekly                          # 지난주(월~일, KST) 리포트 생성 후 저장
//   npm run report:weekly -- --start=2026-06-29 --end=2026-07-05
//   npm run report:weekly -- --dry-run             # 저장 없이 결과 JSON만 출력
//   npm run report:weekly -- --model=gpt-5.1
//
// 통계(픽·밴·승률·선수 지표)는 전부 Supabase의 LCK 경기 데이터에서 집계하고,
// OpenAI는 리뷰/메타 티어 판정/프리뷰 내러티브만 작성한다. 수치 창작을 막기 위해
// AI 출력은 슬러그 기반으로 검증 후 병합한다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type {
  ReportChampionStat,
  ReportMatchResult,
  ReportStatLeader,
  ReportTeamRef,
  ReportUpcomingMatch,
  WeeklyReportContent,
} from "../lib/reports/types.ts";

const POSITIONS = ["TOP", "JGL", "MID", "BOT", "SUP"] as const;
type Position = (typeof POSITIONS)[number];

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env.local");
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const [key, ...valueParts] = trimmed.split("=");
      if (!process.env[key]) process.env[key] = valueParts.join("=");
    }
  } catch {
    // .env.local is optional when env vars are already set.
  }
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function argValue(name: string) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

// ── KST 날짜 유틸 ────────────────────────────────────────────────

function kstDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function kstDayStartUtc(dateKey: string) {
  return new Date(`${dateKey}T00:00:00+09:00`);
}

function addDays(dateKey: string, days: number) {
  const date = kstDayStartUtc(dateKey);
  date.setUTCDate(date.getUTCDate() + days);
  return kstDateKey(date);
}

function isoWeekKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

// 기본 대상: 오늘(KST)이 속한 주의 직전 월~일.
function defaultPeriod() {
  const todayKey = kstDateKey(new Date());
  const today = new Date(`${todayKey}T00:00:00Z`);
  const dow = today.getUTCDay() || 7; // 월=1 … 일=7
  const start = addDays(todayKey, -(dow - 1) - 7);
  return { start, end: addDays(start, 6) };
}

// ── 데이터 로드 ─────────────────────────────────────────────────

type TeamRow = {
  id: string; slug: string; name: string; short_name: string;
  logo_url: string | null; logo_white_url: string | null; primary_color: string;
};
type PlayerRow = { id: string; slug: string; name: string; position: string; team_id: string | null; profile_image_url: string | null };
type ChampionRow = { id: string; slug: string; name: string; image_url: string | null };
type MatchRow = {
  id: string; name: string; match_date: string; status: string; tournament_id: string | null;
  team_a_id: string | null; team_b_id: string | null; team_a_score: number | null; team_b_score: number | null;
  winner_team_id: string | null; best_of: number | null;
};
type SetRow = { id: string; match_id: string; winner_team_id: string | null; patch: string | null; duration_seconds: number | null };
type PickBanRow = { set_id: string; action_type: string; team_id: string | null; champion_id: string | null };
type StatRow = {
  set_id: string; player_id: string; team_id: string; position: string; champion_id: string | null;
  kills: number; deaths: number; assists: number; cs: number; gold: number;
  damage_to_champions: number; vision_score: number;
  dpm: number | string | null; damage_share: number | string | null;
  vision_score_per_minute: number | string | null; cs_per_minute: number | string | null;
};

async function fetchAll<T>(supabase: SupabaseClient, table: string, select: string, filter?: (q: any) => any): Promise<T[]> {
  const rows: T[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) throw new Error(`${table} 조회 실패: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < pageSize) return rows;
  }
}

function toNumber(value: number | string | null | undefined) {
  if (value == null) return null;
  const num = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(num) ? num : null;
}

function teamRef(team: TeamRow | undefined | null): ReportTeamRef | null {
  if (!team) return null;
  return {
    slug: team.slug,
    name: team.name,
    shortName: team.short_name,
    logoUrl: team.logo_url,
    logoWhiteUrl: team.logo_white_url,
    color: team.primary_color,
  };
}

// ── OpenAI 호출 ─────────────────────────────────────────────────

const AI_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "subtitle", "overview", "review", "meta", "preview"],
  properties: {
    headline: { type: "string", description: "리포트 헤드라인, 40자 이내, 이번 주를 관통하는 문장" },
    subtitle: { type: "string", description: "헤드라인을 보조하는 한 문장" },
    overview: { type: "array", items: { type: "string" }, description: "총평 2~3문단" },
    review: {
      type: "object",
      additionalProperties: false,
      required: ["matchNotes", "teamOfWeek", "playersOfWeek"],
      properties: {
        matchNotes: {
          type: "array",
          description: "이번 주 하이라이트 노트 3~5개",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "body"],
            properties: { title: { type: "string" }, body: { type: "string" } },
          },
        },
        teamOfWeek: {
          type: "object",
          additionalProperties: false,
          required: ["teamSlug", "title", "body"],
          properties: { teamSlug: { type: "string" }, title: { type: "string" }, body: { type: "string" } },
        },
        playersOfWeek: {
          type: "array",
          description: "이번 주 빛난 선수 정확히 3명",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["playerSlug", "body"],
            properties: { playerSlug: { type: "string" }, body: { type: "string" } },
          },
        },
      },
    },
    meta: {
      type: "object",
      additionalProperties: false,
      required: ["summary", "positions", "banSpotlight"],
      properties: {
        summary: { type: "array", items: { type: "string" }, description: "이번 주 메타 총평 1~2문단" },
        positions: {
          type: "array",
          description: "TOP/JGL/MID/BOT/SUP 5개 포지션 전부",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["position", "comment", "sTier", "aTier", "bTier", "rising"],
            properties: {
              position: { type: "string", enum: ["TOP", "JGL", "MID", "BOT", "SUP"] },
              comment: { type: "string" },
              sTier: { type: "array", items: { type: "string" } },
              aTier: { type: "array", items: { type: "string" } },
              bTier: { type: "array", items: { type: "string" } },
              rising: { type: ["string", "null"], description: "떠오르는 픽 챔피언 slug 또는 null" },
            },
          },
        },
        banSpotlight: {
          type: "object",
          additionalProperties: false,
          required: ["championSlug", "comment"],
          properties: { championSlug: { type: "string" }, comment: { type: "string" } },
        },
      },
    },
    preview: {
      type: "object",
      additionalProperties: false,
      required: ["intro", "matches"],
      properties: {
        intro: { type: "string" },
        matches: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["matchId", "pickTeamSlug", "confidence", "reasoning", "keyPoint"],
            properties: {
              matchId: { type: "string" },
              pickTeamSlug: { type: "string" },
              confidence: { type: "integer" },
              reasoning: { type: "string" },
              keyPoint: { type: "string" },
            },
          },
        },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `너는 LCK 팬 커뮤니티 'MINION'의 AI 분석실이다. 매주 월요일에 발행되는 주간 리포트의 글을 쓴다.

[독자와 톤]
- 독자는 아이돌 덕질하듯 LCK를 응원하는 10~30대 팬(여성 비중 높음)이다.
- 존댓말("~했어요", "~예요")로, 따뜻하고 밝게, 그러나 데이터에 근거해 정확하게 쓴다.
- 과한 이모지·유행어는 쓰지 않는다. 세련된 스포츠 매거진의 온기 있는 문체를 유지한다.

[절대 규칙 — 부정 프레임 금지]
- 특정 선수·팀이 "못했다", "부진했다", "throw했다" 같은 비판·비하·조롱은 어떤 형태로도 쓰지 않는다.
- 패배한 팀은 스코어 등 중립적 사실까지만 언급하고, 평가하지 않는다.
- 잘한 선수·팀에 대한 칭찬, 흥미로운 메타 흐름, 기대되는 매치업만 다룬다.
- 승부예측 근거도 "상대가 약해서"가 아니라 "이 팀의 이런 강점 때문에"로 쓴다.

[데이터 규칙]
- 제공된 JSON의 수치만 사용한다. 새로운 수치·기록을 만들어내지 않는다.
- slug는 JSON의 slug 필드에만 사용한다. 문장 본문(overview, body, comment, reasoning 등)에는 slug를 절대 쓰지 않고 반드시 표기 이름(name)을 사용한다. 예: "bilibili-gaming"(X) → "Bilibili Gaming"(O).
- 챔피언 티어(S/A/B)는 해당 포지션의 픽 수·밴 수·승률·프레즌스를 근거로 판정하고, comment에 근거를 한 문장 이상 담는다.
- 각 포지션의 티어에는 그 포지션 챔피언 목록에 있는 slug만 배치한다. 3개 티어 합쳐 4~8개면 충분하다. 표본이 적은 챔피언(1픽)은 과대평가하지 않는다.
- 승부예측 confidence는 55~90 사이 정수. 데이터(주간 성적, 최근 폼, 시즌 성적)에 근거하되 겸손하게.

[출력]
- 전부 한국어. 제공된 JSON 스키마 형식으로만 출력한다.`;

type AiOutput = {
  headline: string;
  subtitle: string;
  overview: string[];
  review: {
    matchNotes: Array<{ title: string; body: string }>;
    teamOfWeek: { teamSlug: string; title: string; body: string };
    playersOfWeek: Array<{ playerSlug: string; body: string }>;
  };
  meta: {
    summary: string[];
    positions: Array<{ position: Position; comment: string; sTier: string[]; aTier: string[]; bTier: string[]; rising: string | null }>;
    banSpotlight: { championSlug: string; comment: string };
  };
  preview: {
    intro: string;
    matches: Array<{ matchId: string; pickTeamSlug: string; confidence: number; reasoning: string; keyPoint: string }>;
  };
};

async function callOpenAi(model: string, payload: unknown): Promise<{ output: AiOutput; usage: { input: number; output: number } }> {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const body = {
    model,
    reasoning: { effort: "high" },
    max_output_tokens: 32000,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `이번 주 LCK 데이터입니다. 이 데이터만 근거로 주간 리포트를 작성해 주세요.\n\n${JSON.stringify(payload)}`,
      },
    ],
    text: {
      format: { type: "json_schema", name: "weekly_lck_report", strict: true, schema: AI_OUTPUT_SCHEMA },
    },
  };

  for (let attempt = 1; ; attempt++) {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      const retriable = response.status === 429 || response.status >= 500;
      if (retriable && attempt < 3) {
        const waitMs = attempt * 15000;
        console.warn(`OpenAI ${response.status} — ${waitMs}ms 후 재시도합니다.`);
        await new Promise((resolveWait) => setTimeout(resolveWait, waitMs));
        continue;
      }
      throw new Error(`OpenAI 호출 실패 (${response.status}): ${text.slice(0, 500)}`);
    }

    const json = (await response.json()) as any;
    if (json.status === "incomplete") {
      throw new Error(`OpenAI 응답이 잘렸습니다: ${JSON.stringify(json.incomplete_details)}`);
    }
    const message = (json.output ?? []).find((item: any) => item.type === "message");
    const textPart = message?.content?.find((part: any) => part.type === "output_text");
    if (!textPart?.text) throw new Error("OpenAI 응답에서 본문을 찾지 못했습니다.");

    return {
      output: JSON.parse(textPart.text) as AiOutput,
      usage: { input: json.usage?.input_tokens ?? 0, output: json.usage?.output_tokens ?? 0 },
    };
  }
}

// ── 메인 ────────────────────────────────────────────────────────

async function main() {
  loadEnvFile();

  const dryRun = process.argv.includes("--dry-run");
  const model = argValue("model") ?? process.env.OPENAI_WEEKLY_REPORT_MODEL ?? "gpt-5.1";
  const fallback = defaultPeriod();
  const periodStart = argValue("start") ?? fallback.start;
  const periodEnd = argValue("end") ?? fallback.end;
  const weekKey = isoWeekKey(periodStart);
  const windowStartUtc = kstDayStartUtc(periodStart).toISOString();
  const windowEndUtc = kstDayStartUtc(addDays(periodEnd, 1)).toISOString();

  console.log(`대상 기간(KST): ${periodStart} ~ ${periodEnd} (${weekKey}), 모델: ${model}`);

  const supabase = createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. 기준 데이터
  const [teams, champions, tournaments] = await Promise.all([
    fetchAll<TeamRow>(supabase, "teams", "id,slug,name,short_name,logo_url,logo_white_url,primary_color"),
    fetchAll<ChampionRow>(supabase, "champions", "id,slug,name,image_url"),
    fetchAll<{ id: string; name: string }>(supabase, "tournaments", "id,name"),
  ]);
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const teamBySlug = new Map(teams.map((team) => [team.slug, team]));
  const championById = new Map(champions.map((champion) => [champion.id, champion]));
  const championBySlug = new Map(champions.map((champion) => [champion.slug, champion]));
  const tournamentNameById = new Map(tournaments.map((tournament) => [tournament.id, tournament.name]));

  // 2. 이번 주 완료 경기 + 세트/픽밴/스탯
  const matchSelect = "id,name,match_date,status,tournament_id,team_a_id,team_b_id,team_a_score,team_b_score,winner_team_id,best_of";
  const weekMatches = await fetchAll<MatchRow>(supabase, "matches", matchSelect, (q) =>
    q.eq("status", "completed").gte("match_date", windowStartUtc).lt("match_date", windowEndUtc).order("match_date"),
  );
  if (weekMatches.length === 0) throw new Error("해당 기간에 완료된 경기가 없습니다. --start/--end를 확인해 주세요.");

  const matchIds = weekMatches.map((match) => match.id);
  const sets = await fetchAll<SetRow>(supabase, "sets", "id,match_id,winner_team_id,patch,duration_seconds", (q) =>
    q.in("match_id", matchIds).not("winner_team_id", "is", null),
  );
  const setIds = sets.map((set) => set.id);
  const setById = new Map(sets.map((set) => [set.id, set]));
  const [picksBans, statRows] = await Promise.all([
    fetchAll<PickBanRow>(supabase, "set_picks_bans", "set_id,action_type,team_id,champion_id", (q) => q.in("set_id", setIds)),
    fetchAll<StatRow>(
      supabase,
      "set_player_stats",
      "set_id,player_id,team_id,position,champion_id,kills,deaths,assists,cs,gold,damage_to_champions,vision_score,dpm,damage_share,vision_score_per_minute,cs_per_minute",
      (q) => q.in("set_id", setIds),
    ),
  ]);
  const playerIds = [...new Set(statRows.map((row) => row.player_id))];
  const players = playerIds.length
    ? await fetchAll<PlayerRow>(supabase, "players", "id,slug,name,position,team_id,profile_image_url", (q) => q.in("id", playerIds))
    : [];
  const playerById = new Map(players.map((player) => [player.id, player]));
  const playerBySlug = new Map(players.map((player) => [player.slug, player]));

  console.log(`경기 ${weekMatches.length} · 세트 ${sets.length} · 스탯 ${statRows.length}행 로드 완료`);

  // 3. 다음 주 예정 경기 (지금 시점부터 8일)
  const upcomingMatches = await fetchAll<MatchRow>(supabase, "matches", matchSelect, (q) =>
    q.eq("status", "scheduled")
      .gte("match_date", new Date().toISOString())
      .lt("match_date", new Date(Date.now() + 8 * 86400000).toISOString())
      .order("match_date")
      .limit(10),
  );

  // 전체 완료 경기(최근 폼 계산용)
  const allCompleted = await fetchAll<MatchRow>(supabase, "matches", matchSelect, (q) =>
    q.eq("status", "completed").order("match_date", { ascending: false }).limit(200),
  );
  const recentForm = (teamId: string | null) =>
    teamId
      ? allCompleted
          .filter((match) => match.team_a_id === teamId || match.team_b_id === teamId)
          .slice(0, 5)
          .map((match) => (match.winner_team_id === teamId ? "W" : "L"))
          .join("")
      : "";
  const seasonRecord = (teamId: string | null) => {
    if (!teamId) return "";
    const games = allCompleted.filter((match) => match.team_a_id === teamId || match.team_b_id === teamId);
    const wins = games.filter((match) => match.winner_team_id === teamId).length;
    return `${wins}승 ${games.length - wins}패`;
  };

  // 4. 집계 ─ 챔피언
  const setCount = sets.length;
  const champAgg = new Map<string, { picks: number; bans: number; wins: number; positions: Map<string, number> }>();
  const aggFor = (championId: string) => {
    let agg = champAgg.get(championId);
    if (!agg) {
      agg = { picks: 0, bans: 0, wins: 0, positions: new Map() };
      champAgg.set(championId, agg);
    }
    return agg;
  };
  for (const row of statRows) {
    if (!row.champion_id) continue;
    const agg = aggFor(row.champion_id);
    agg.picks += 1;
    agg.positions.set(row.position, (agg.positions.get(row.position) ?? 0) + 1);
    if (setById.get(row.set_id)?.winner_team_id === row.team_id) agg.wins += 1;
  }
  for (const row of picksBans) {
    if (row.action_type !== "ban" || !row.champion_id) continue;
    aggFor(row.champion_id).bans += 1;
  }

  const championStats: ReportChampionStat[] = [...champAgg.entries()]
    .map(([championId, agg]): ReportChampionStat | null => {
      const champion = championById.get(championId);
      if (!champion) return null;
      const modalPosition = [...agg.positions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return {
        slug: champion.slug,
        name: champion.name,
        imageUrl: champion.image_url,
        position: modalPosition,
        picks: agg.picks,
        bans: agg.bans,
        wins: agg.wins,
        losses: agg.picks - agg.wins,
        winRate: agg.picks > 0 ? agg.wins / agg.picks : 0,
        presenceRate: setCount > 0 ? (agg.picks + agg.bans) / setCount : 0,
      } satisfies ReportChampionStat;
    })
    .filter((stat): stat is ReportChampionStat => stat !== null)
    .sort((a, b) => b.presenceRate - a.presenceRate || b.picks - a.picks);

  // 5. 집계 ─ 선수
  type PlayerAgg = {
    player: PlayerRow; sets: number; wins: number; kills: number; deaths: number; assists: number;
    dpmSum: number; dpmN: number; shareSum: number; shareN: number; vspmSum: number; vspmN: number; cspmSum: number; cspmN: number;
    champions: Map<string, number>;
  };
  const playerAgg = new Map<string, PlayerAgg>();
  for (const row of statRows) {
    const player = playerById.get(row.player_id);
    if (!player) continue;
    let agg = playerAgg.get(row.player_id);
    if (!agg) {
      agg = { player, sets: 0, wins: 0, kills: 0, deaths: 0, assists: 0, dpmSum: 0, dpmN: 0, shareSum: 0, shareN: 0, vspmSum: 0, vspmN: 0, cspmSum: 0, cspmN: 0, champions: new Map() };
      playerAgg.set(row.player_id, agg);
    }
    const set = setById.get(row.set_id);
    const duration = set?.duration_seconds ?? null;
    agg.sets += 1;
    if (set?.winner_team_id === row.team_id) agg.wins += 1;
    agg.kills += row.kills;
    agg.deaths += row.deaths;
    agg.assists += row.assists;
    const dpm = toNumber(row.dpm) ?? (duration ? (row.damage_to_champions * 60) / duration : null);
    if (dpm != null) { agg.dpmSum += dpm; agg.dpmN += 1; }
    const share = toNumber(row.damage_share);
    if (share != null) { agg.shareSum += share; agg.shareN += 1; }
    const vspm = toNumber(row.vision_score_per_minute) ?? (duration ? (row.vision_score * 60) / duration : null);
    if (vspm != null) { agg.vspmSum += vspm; agg.vspmN += 1; }
    const cspm = toNumber(row.cs_per_minute) ?? (duration ? (row.cs * 60) / duration : null);
    if (cspm != null) { agg.cspmSum += cspm; agg.cspmN += 1; }
    const champName = row.champion_id ? championById.get(row.champion_id)?.name : null;
    if (champName) agg.champions.set(champName, (agg.champions.get(champName) ?? 0) + 1);
  }

  const aggregates = [...playerAgg.values()];
  const minSets = Math.min(2, Math.max(...aggregates.map((agg) => agg.sets)));
  const kdaOf = (agg: PlayerAgg) => (agg.kills + agg.assists) / Math.max(1, agg.deaths);
  const leaderDefs: Array<{ key: string; label: string; unit: string; metric: (agg: PlayerAgg) => number; format: (value: number) => string; gate?: boolean }> = [
    { key: "kills", label: "주간 최다 킬", unit: "킬", metric: (agg) => agg.kills, format: (value) => String(Math.round(value)) },
    { key: "kda", label: "KDA 리더", unit: "KDA", metric: kdaOf, format: (value) => value.toFixed(1), gate: true },
    { key: "dpm", label: "분당 데미지(DPM)", unit: "DPM", metric: (agg) => (agg.dpmN ? agg.dpmSum / agg.dpmN : 0), format: (value) => String(Math.round(value)), gate: true },
    { key: "share", label: "팀 내 딜 지분", unit: "%", metric: (agg) => (agg.shareN ? (agg.shareSum / agg.shareN) * 100 : 0), format: (value) => value.toFixed(1), gate: true },
    { key: "vspm", label: "분당 시야 점수", unit: "VS/분", metric: (agg) => (agg.vspmN ? agg.vspmSum / agg.vspmN : 0), format: (value) => value.toFixed(2), gate: true },
    { key: "cspm", label: "분당 CS", unit: "CS/분", metric: (agg) => (agg.cspmN ? agg.cspmSum / agg.cspmN : 0), format: (value) => value.toFixed(1), gate: true },
  ];
  const statLeaders: ReportStatLeader[] = leaderDefs.map((def): ReportStatLeader | null => {
    const pool = aggregates.filter((agg) => (def.gate ? agg.sets >= minSets : true) && def.metric(agg) > 0);
    const ranked = pool.sort((a, b) => def.metric(b) - def.metric(a)).slice(0, 3);
    const top = ranked[0];
    if (!top) return null;
    return {
      key: def.key,
      label: def.label,
      unit: def.unit,
      value: def.format(def.metric(top)),
      playerName: top.player.name,
      playerSlug: top.player.slug,
      playerImageUrl: top.player.profile_image_url,
      position: top.player.position,
      team: teamRef(top.player.team_id ? teamById.get(top.player.team_id) : null),
      championNames: [...top.champions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name),
      runnersUp: ranked.slice(1).map((agg) => ({
        playerName: agg.player.name,
        teamShort: (agg.player.team_id ? teamById.get(agg.player.team_id)?.short_name : null) ?? "",
        value: def.format(def.metric(agg)),
      })),
    } satisfies ReportStatLeader;
  }).filter((leader): leader is ReportStatLeader => leader !== null);

  // 6. 집계 ─ 팀 주간 성적 / 경기 결과
  const teamWeeklyAgg = new Map<string, { wins: number; losses: number; setWins: number; setLosses: number }>();
  const weeklyFor = (teamId: string) => {
    let agg = teamWeeklyAgg.get(teamId);
    if (!agg) {
      agg = { wins: 0, losses: 0, setWins: 0, setLosses: 0 };
      teamWeeklyAgg.set(teamId, agg);
    }
    return agg;
  };
  const matchResults: ReportMatchResult[] = weekMatches.map((match) => {
    const teamA = match.team_a_id ? teamById.get(match.team_a_id) : null;
    const teamB = match.team_b_id ? teamById.get(match.team_b_id) : null;
    if (match.team_a_id && match.team_b_id && match.winner_team_id) {
      const scoreA = match.team_a_score ?? 0;
      const scoreB = match.team_b_score ?? 0;
      const aggA = weeklyFor(match.team_a_id);
      const aggB = weeklyFor(match.team_b_id);
      aggA.setWins += scoreA; aggA.setLosses += scoreB;
      aggB.setWins += scoreB; aggB.setLosses += scoreA;
      if (match.winner_team_id === match.team_a_id) { aggA.wins += 1; aggB.losses += 1; } else { aggB.wins += 1; aggA.losses += 1; }
    }
    return {
      matchId: match.id,
      date: match.match_date,
      tournament: match.tournament_id ? tournamentNameById.get(match.tournament_id) ?? null : null,
      teamA: teamRef(teamA),
      teamB: teamRef(teamB),
      scoreA: match.team_a_score ?? 0,
      scoreB: match.team_b_score ?? 0,
      winnerSlug: match.winner_team_id ? teamById.get(match.winner_team_id)?.slug ?? null : null,
    } satisfies ReportMatchResult;
  });
  const teamWeekly = [...teamWeeklyAgg.entries()]
    .map(([teamId, agg]) => ({ team: teamRef(teamById.get(teamId))!, ...agg }))
    .filter((row) => row.team)
    .sort((a, b) => b.wins - a.wins || (b.setWins - b.setLosses) - (a.setWins - a.setLosses));

  const patches = [...new Set(sets.map((set) => set.patch).filter((patch): patch is string => Boolean(patch)))];
  const durations = sets.map((set) => set.duration_seconds).filter((duration): duration is number => duration != null);
  const avgGameMinutes = durations.length ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length / 60 : null;

  // 7. AI 페이로드
  const pct = (value: number) => Math.round(value * 100);
  const championsByPosition: Record<string, unknown[]> = {};
  for (const position of POSITIONS) {
    championsByPosition[position] = championStats
      .filter((stat) => stat.position === position)
      .map((stat) => ({ slug: stat.slug, name: stat.name, picks: stat.picks, bans: stat.bans, wins: stat.wins, winRatePct: pct(stat.winRate), presencePct: pct(stat.presenceRate) }));
  }
  const aiPayload = {
    period: { start: periodStart, end: periodEnd, patches, setCount, matchCount: weekMatches.length },
    results: matchResults.map((match) => ({
      matchId: match.matchId,
      dateKst: kstDateKey(match.date),
      tournament: match.tournament,
      teamA: match.teamA ? { slug: match.teamA.slug, name: match.teamA.name } : null,
      teamB: match.teamB ? { slug: match.teamB.slug, name: match.teamB.name } : null,
      score: `${match.scoreA}:${match.scoreB}`,
      winnerSlug: match.winnerSlug,
    })),
    teamWeekly: teamWeekly.map((row) => ({ slug: row.team.slug, name: row.team.name, wins: row.wins, losses: row.losses, setWins: row.setWins, setLosses: row.setLosses })),
    championsByPosition,
    topBans: championStats.filter((stat) => stat.bans > 0).sort((a, b) => b.bans - a.bans).slice(0, 8)
      .map((stat) => ({ slug: stat.slug, name: stat.name, bans: stat.bans, presencePct: pct(stat.presenceRate) })),
    statLeaders: statLeaders.map((leader) => ({
      metric: leader.label,
      playerSlug: leader.playerSlug,
      playerName: leader.playerName,
      teamSlug: leader.team?.slug ?? null,
      position: leader.position,
      value: `${leader.value} ${leader.unit}`,
      champions: leader.championNames,
      runnersUp: leader.runnersUp,
    })),
    players: [...playerAgg.values()]
      .sort((a, b) => kdaOf(b) - kdaOf(a))
      .slice(0, 30)
      .map((agg) => ({
        slug: agg.player.slug,
        name: agg.player.name,
        teamSlug: agg.player.team_id ? teamById.get(agg.player.team_id)?.slug ?? null : null,
        position: agg.player.position,
        sets: agg.sets,
        wins: agg.wins,
        kda: Number(kdaOf(agg).toFixed(2)),
        champions: [...agg.champions.keys()].slice(0, 4),
      })),
    upcoming: upcomingMatches.map((match) => ({
      matchId: match.id,
      dateKst: kstDateKey(match.match_date),
      tournament: match.tournament_id ? tournamentNameById.get(match.tournament_id) ?? null : null,
      bestOf: match.best_of,
      teamA: match.team_a_id
        ? { slug: teamById.get(match.team_a_id)?.slug, name: teamById.get(match.team_a_id)?.name, recentForm: recentForm(match.team_a_id), seasonRecord: seasonRecord(match.team_a_id) }
        : null,
      teamB: match.team_b_id
        ? { slug: teamById.get(match.team_b_id)?.slug, name: teamById.get(match.team_b_id)?.name, recentForm: recentForm(match.team_b_id), seasonRecord: seasonRecord(match.team_b_id) }
        : null,
    })),
  };

  console.log("OpenAI 호출 중... (추론 강도 high, 수 분 걸릴 수 있어요)");
  const { output: ai, usage } = await callOpenAi(model, aiPayload);
  const estimatedUsd = (usage.input * 1.25 + usage.output * 10) / 1_000_000;
  console.log(`OpenAI 완료 — 입력 ${usage.input.toLocaleString()} · 출력 ${usage.output.toLocaleString()} 토큰 (약 $${estimatedUsd.toFixed(2)})`);

  // 8. AI 출력 검증 + 병합
  const appearedBySlug = new Map(championStats.map((stat) => [stat.slug, stat]));
  const validTierSlugs = (slugs: string[], position: Position, used: Set<string>) =>
    slugs.filter((slug) => {
      const stat = appearedBySlug.get(slug);
      if (!stat || used.has(slug)) return false;
      if (stat.position !== position) return false;
      used.add(slug);
      return true;
    });
  const positionsMeta = POSITIONS.map((position) => {
    const aiPosition = ai.meta.positions.find((row) => row.position === position);
    const used = new Set<string>();
    const sTier = validTierSlugs(aiPosition?.sTier ?? [], position, used);
    const aTier = validTierSlugs(aiPosition?.aTier ?? [], position, used);
    const bTier = validTierSlugs(aiPosition?.bTier ?? [], position, used);
    const rising = aiPosition?.rising && appearedBySlug.has(aiPosition.rising) ? aiPosition.rising : null;
    return { position, comment: aiPosition?.comment ?? "", sTier, aTier, bTier, rising };
  });

  const topWeeklyTeam = teamWeekly[0]?.team ?? null;
  const teamOfWeekTeam = teamBySlug.get(ai.review.teamOfWeek.teamSlug) ?? null;
  const playersOfWeek = ai.review.playersOfWeek
    .map((entry) => {
      const player = playerBySlug.get(entry.playerSlug);
      if (!player) return null;
      const agg = playerAgg.get(player.id);
      return {
        playerName: player.name,
        playerSlug: player.slug,
        playerImageUrl: player.profile_image_url,
        position: player.position,
        team: teamRef(player.team_id ? teamById.get(player.team_id) : null),
        championNames: agg ? [...agg.champions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name) : [],
        body: entry.body,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const upcomingById = new Map(upcomingMatches.map((match) => [match.id, match]));
  const previewMatches: ReportUpcomingMatch[] = ai.preview.matches
    .map((entry) => {
      const match = upcomingById.get(entry.matchId);
      if (!match) return null;
      const teamA = match.team_a_id ? teamById.get(match.team_a_id) : null;
      const teamB = match.team_b_id ? teamById.get(match.team_b_id) : null;
      const pickValid = entry.pickTeamSlug === teamA?.slug || entry.pickTeamSlug === teamB?.slug;
      if (!pickValid) return null;
      return {
        matchId: match.id,
        date: match.match_date,
        tournament: match.tournament_id ? tournamentNameById.get(match.tournament_id) ?? null : null,
        teamA: teamRef(teamA),
        teamB: teamRef(teamB),
        bestOf: match.best_of,
        pickTeamSlug: entry.pickTeamSlug,
        confidence: Math.max(55, Math.min(90, Math.round(entry.confidence))),
        reasoning: entry.reasoning,
        keyPoint: entry.keyPoint,
      } satisfies ReportUpcomingMatch;
    })
    .filter((entry): entry is ReportUpcomingMatch => entry !== null);

  const banSpotlightValid = appearedBySlug.has(ai.meta.banSpotlight.championSlug);
  const topBan = championStats.filter((stat) => stat.bans > 0).sort((a, b) => b.bans - a.bans)[0];

  const content: WeeklyReportContent = {
    headline: ai.headline,
    subtitle: ai.subtitle,
    overview: ai.overview,
    stats: {
      matchCount: weekMatches.length,
      setCount,
      patches,
      avgGameMinutes: avgGameMinutes ? Number(avgGameMinutes.toFixed(1)) : null,
      matches: matchResults,
      champions: championStats,
      statLeaders,
      teamWeekly,
    },
    review: {
      matchNotes: ai.review.matchNotes.slice(0, 6),
      teamOfWeek: {
        team: teamRef(teamOfWeekTeam) ?? topWeeklyTeam,
        title: ai.review.teamOfWeek.title,
        body: ai.review.teamOfWeek.body,
      },
      playersOfWeek,
    },
    meta: {
      summary: ai.meta.summary,
      positions: positionsMeta,
      banSpotlight: banSpotlightValid
        ? { championSlug: ai.meta.banSpotlight.championSlug, comment: ai.meta.banSpotlight.comment }
        : topBan
          ? { championSlug: topBan.slug, comment: ai.meta.banSpotlight.comment }
          : null,
    },
    preview: { intro: ai.preview.intro, matches: previewMatches },
  };

  if (dryRun) {
    console.log(JSON.stringify(content, null, 2));
    console.log("--dry-run: 저장하지 않았습니다.");
    return;
  }

  const { error } = await supabase.from("weekly_reports").upsert(
    {
      week_key: weekKey,
      title: ai.headline,
      period_start: periodStart,
      period_end: periodEnd,
      patches,
      status: "published",
      content,
      model,
      generated_at: new Date().toISOString(),
    },
    { onConflict: "week_key" },
  );
  if (error) throw new Error(`weekly_reports 저장 실패: ${error.message}`);

  console.log(`저장 완료: ${weekKey} — "${ai.headline}" (/reports)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
