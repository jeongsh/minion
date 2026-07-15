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

import { championImage } from "../lib/champions.ts";
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
type ChampionRow = { id: string; slug: string; name: string; image_url: string | null; ddragon_id: string | null };
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
  gold_diff_at_15: number | string | null;
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

// 종합 점수(0~100) = 밴픽률 30% + 보정 승률 40% + 스탯 점수 30%.
// - 보정 승률: 라플라스 보정 (wins+1)/(picks+2) — 1~2픽 표본의 0%/100% 왜곡을 완화한다.
// - 스탯 점수: KDA(0~6)와 15분 골드차(±600)를 0~100으로 정규화한 평균. 밴만 된 챔피언은 중립값 50.
function championScores(
  agg: { picks: number; bans: number; wins: number; kills: number; deaths: number; assists: number; gd15Sum: number; gd15N: number },
  setCount: number,
) {
  const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
  const banPick = setCount > 0 ? (agg.picks + agg.bans) / setCount : 0;
  const winAdj = (agg.wins + 1) / (agg.picks + 2);
  const kdaScore = clamp01((agg.kills + agg.assists) / Math.max(1, agg.deaths) / 6);
  const gd15Score = agg.gd15N > 0 ? clamp01((agg.gd15Sum / agg.gd15N + 600) / 1200) : null;
  const statScore = agg.picks === 0 ? 0.5 : gd15Score == null ? kdaScore : (kdaScore + gd15Score) / 2;
  return {
    statScore: Math.round(statScore * 100),
    score: Math.round((0.3 * clamp01(banPick) + 0.4 * winAdj + 0.3 * statScore) * 100),
  };
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
      required: ["teamOfWeek", "playersOfWeek"],
      properties: {
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
      required: ["summary", "positions", "banSpotlight", "sources"],
      properties: {
        summary: { type: "array", items: { type: "string" }, description: "이번 주 메타 총평 1~2문단" },
        sources: {
          type: "array",
          description: "웹 검색에서 실제로 참고한 자료 3~5개",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "url"],
            properties: { title: { type: "string" }, url: { type: "string" } },
          },
        },
        positions: {
          type: "array",
          description: "TOP/JGL/MID/BOT/SUP 5개 포지션 전부",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["position", "comment", "sTier", "aTier", "bTier", "rising"],
            properties: {
              position: { type: "string", enum: ["TOP", "JGL", "MID", "BOT", "SUP"] },
              comment: { type: "string", description: "최소 6문장. 주요 챔피언의 종합점수 구성(밴픽률·승률·스탯점수) 풀이 + 그 수치가 나온 이유 분석 + 하락 챔피언의 원인" },
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

const SYSTEM_PROMPT = `너는 LCK 팬 커뮤니티 'MINION'의 AI 분석실이다. 매주 발행되는 주간 리포트의 글을 쓴다.

[문체 — 스포츠 기사체]
- 네이버 스포츠 e스포츠 기사처럼 간결한 문어체로 쓴다. 문장은 "~했다", "~이다", "~된다"로 끝낸다. 존댓말("~했어요")은 쓰지 않는다.
- 이모지·유행어·감탄사 금지. 짧고 명확한 문장. 한 문장에 하나의 사실만 담는다.

[분량 — 매우 간결하게, 전체가 A4 두 장 안에 들어와야 한다]
- overview: 1개 문단, 3문장 이내. 이번 주의 핵심만.
- teamOfWeek.body: 2문장 이내. playersOfWeek body: 각 2문장 이내.
- meta.summary: 1개 문단, 4문장 이내. positions comment: 각 최소 6문장~8문장(아래 메타 규칙 참고). banSpotlight comment: 1~2문장.
- preview intro: 1~2문장. reasoning: 2문장 이내. keyPoint: 한 구절(문장 하나).
- 수치 나열은 문장당 최대 2개까지만(메타 positions comment의 종합점수 풀이는 예외). 나머지는 UI의 차트·카드가 보여주므로 글에서 반복하지 않는다.

[절대 규칙 — 선수·팀 부정 프레임 금지]
- 특정 선수·팀이 "못했다", "부진했다" 같은 비판·비하·조롱은 어떤 형태로도 쓰지 않는다.
- 패배한 팀은 스코어 등 중립적 사실까지만 언급하고, 평가하지 않는다.
- 승부예측 근거도 "상대가 약해서"가 아니라 "이 팀의 이런 강점 때문에"로 쓴다.
- 단, 챔피언(캐릭터)에 대해서는 데이터에 근거한 하락·부진 서술이 허용된다(예: "나르는 승률 38%에 그치며 힘이 빠졌다"). 챔피언 평가를 그 챔피언을 플레이한 선수 개인의 평가로 이어가지는 않는다.

[위클리 스포트라이트 — 스탯이 아니라 '이번 주의 사건'으로 뽑는다]
- teamOfWeek와 playersOfWeek(정확히 3명)는 KDA·지표 순위로 기계적으로 뽑지 않는다. 이번 주 실제 대회에서 가장 의미 있는 활약을 한 팀·선수를 고른다. 판단 기준의 1순위는 '경기의 무게와 서사'다 — 우승·결승 승리, 파이널/경기 MVP, 시리즈를 뒤집은 캐리, 중요한 승부처에서의 결정적 활약. 스탯은 그 서사를 뒷받침하는 근거로만 쓴다.
- 그래서 KDA가 가장 높은 선수가 아니라, 큰 경기를 캐리한 선수가 스포트라이트의 주인공이 될 수 있다(예: 결승을 지배한 TOP 라이너). 제공된 players 목록에는 주간 승수·출전이 많은 결승 주역과 KDA 스탠드아웃이 함께 들어 있으니, 검색으로 파악한 서사와 대조해 고른다.
- teamOfWeek.body와 각 playersOfWeek.body에는 그 선수·팀이 '이번 주에 무엇을 해냈는지'(예: MSI 우승, 파이널 MVP, 결승 5세트 캐리)를 반드시 한 문장 이상 담는다. 검색으로 확인된 사실만 쓰고 지어내지 않으며, 확인이 안 되면 스탯이 보여주는 사실만 쓴다. 수치는 제공 JSON만 사용한다.

[외부 컨텍스트 — 웹 검색 필수]
- 이번 주 리포트는 스탯 표만으로 쓰지 않는다. web_search 도구로 (A) 이번 주 대회 '서사'와 (B) 패치·메타 두 축을 모두 조사한 뒤에 글을 쓴다. 특히 스포트라이트(팀·선수)는 반드시 (A)를 근거로 뽑는다.
- (A) 이번 주 서사 조사(스포트라이트·총평용, 최우선): 제공된 results의 대회명·스코어를 실마리로, 이번 주에 실제로 무슨 일이 있었는지를 뉴스·유튜브·커뮤니티에서 찾는다. 반드시 확인할 것 — 결승/플레이오프 결과와 우승팀, 파이널·경기 MVP 수상자, 시리즈를 가른 캐리 활약, 승격/강등·로스터·이적 등 화제. 예: "제우스가 압도적 폼으로 한화생명을 MSI 우승으로 이끌고 파이널 MVP를 수상했다"는 스탯 표에는 없지만 스포트라이트의 핵심이므로 검색으로 반드시 파악해 반영한다. 이런 사실(수상·우승·시리즈 활약)은 수치가 아니므로 검색으로 확인되면 본문에 적극 쓴다(수치는 여전히 제공 JSON만 사용).
- (B) web_search 도구로 이번 패치·대회의 메타에 대한 (1) 커뮤니티 여론(인벤, 레딧, 디시 등), (2) 전문가·방송 분석(해설진, 프로 관계자, 분석 유튜브), (3) 기사(네이버 e스포츠 등)를 반드시 조사한다.
- 최우선 참고 채널 두 곳을 반드시 먼저 검색한다: ① '프로관전러 PS'(youtube.com/@ProfessionalSpectator)의 이번 패치 티어리스트·메타 분석, ② '클라우드템플러'(youtube.com/@CloudTemplar_official)의 '찍어' 시리즈 주요 경기 분석. 영상 제목·설명·커뮤니티 요약·기사 인용을 통해 이들의 관점을 파악하고 메타 코멘트에 적극 반영한다. 인용할 때는 "클템은 찍어 시리즈에서 ~라고 짚었다", "PS 티어리스트에서는 ~로 평가됐다"처럼 출처를 드러낸다. 해당 패치 자료를 못 찾으면 억지로 지어내지 말고 생략한다.
- 검색으로 얻은 맥락(패치 변경점, 아이템·룬 트렌드, 챔피언 재평가, 대회 이슈)을 메타 분석(summary, positions comment)과 프리뷰 근거에 녹인다.
- 단, 티어 순위와 모든 수치는 제공된 경기 데이터가 우선이다. 외부 자료와 상충하면 경기 데이터를 따르고, 외부 여론은 "커뮤니티에서는 ~라는 평가다"처럼 출처의 성격을 드러내며 인용한다.
- 실제로 참고한 자료만 sources 배열에 제목+URL로 담는다(3~5개).

[메타 티어 규칙 — 밴픽만으로 판정하지 않는다]
- 각 챔피언에는 totalScore(밴픽률 30% + 보정승률 40% + 스탯점수 30%, 0~100)가 제공된다. 티어(S/A/B)는 totalScore 순위를 기본으로 삼되, 표본 크기·역할·검색으로 얻은 메타 맥락을 감안해 조정한다.
- '프레즌스'라는 용어는 쓰지 않는다. 픽+밴 비율은 반드시 '밴픽률'이라고 부른다.
- positions comment는 최소 6문장, 8문장까지 쓴다. 반드시 담을 것:
  (1) 상위 티어 챔피언 2~3개는 종합점수가 왜 그렇게 나왔는지 구성 요소를 풀어서 쓴다 — 예: "럼블은 밴픽률 57%(픽 7·밴 13)에 승률 43%, 스탯 점수 61점이 더해져 종합 58점에 그쳤다".
  (2) 각 수치가 나온 경기 내적 이유를 분석한다 — 챔피언의 역할과 강점, 패치·아이템 맥락, 어떤 조합·운영과 맞물렸는지, 커뮤니티·전문가 평가와 일치하는지.
  (3) 티어가 내려온 챔피언은 어떤 구성 요소(승률인지 스탯인지)가 점수를 깎았는지와 그 이유(견제 밴, 카운터 등장, 라인전 열세 등)를 짚는다.
  (4) 포지션마다 최소 2문장은 실제 선수 활용 사례여야 한다 — 각 챔피언의 playedBy 목록에 있는 선수만 언급하고, "누가 어떤 방식으로 활용해서 좋았는지"를 구체적으로 쓴다(예: "Zeka는 카시오페아를 후방 광역 유지력 축으로 굴리며 6세트 전승의 중심이 됐다"). 경기 내용 묘사는 검색으로 확인된 사실이나 스탯에서 추론 가능한 수준까지만 쓰고, 보지 않은 장면을 지어내지 않는다.
  수치만 나열한 문장을 이어붙이지 말고, 모든 수치 뒤에는 해석을 붙인다. 지표 얘기만 하는 코멘트는 실패작이다 — 독자는 "누가, 무엇으로, 어떻게"를 읽고 싶어 한다.
- 표본이 적은 챔피언(1픽)은 과대평가하지 않는다. 각 포지션의 티어에는 그 포지션 챔피언 목록에 있는 slug만 배치하고, 3개 티어 합쳐 4~8개면 충분하다.

[데이터 규칙]
- 제공된 JSON의 수치만 사용한다. 새로운 수치·기록을 만들어내지 않는다.
- slug는 JSON의 slug 필드에만 사용한다. 문장 본문(overview, body, comment, reasoning 등)에는 slug를 절대 쓰지 않고 반드시 표기 이름(name)을 사용한다. 예: "bilibili-gaming"(X) → "Bilibili Gaming"(O).
- 승부예측 confidence는 55~90 사이 정수. 데이터(주간 성적, 최근 폼, 시즌 성적)에 근거하되 겸손하게.

[출력]
- 전부 한국어. 제공된 JSON 스키마 형식으로만 출력한다.
- 문장 본문에 URL·마크다운 링크·출처 각주를 넣지 않는다. 출처는 sources 배열에만 담는다.`;

// 본문에 섞여 들어온 마크다운 링크/출처 각주를 제거한다. 예: "문장이다. ([site.com](https://...))"
function stripMarkdownCitations<T>(value: T): T {
  if (typeof value === "string") {
    return value
      .replace(/\s*\(\[[^\]]*\]\([^)]*\)\)/g, "")
      .replace(/\[([^\]]*)\]\(https?:[^)]*\)/g, "$1") as T;
  }
  if (Array.isArray(value)) return value.map(stripMarkdownCitations) as T;
  if (value && typeof value === "object") {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      // sources의 url 필드는 링크 그 자체이므로 건드리지 않는다.
      if (key === "url") continue;
      (value as Record<string, unknown>)[key] = stripMarkdownCitations((value as Record<string, unknown>)[key]);
    }
    return value;
  }
  return value;
}

type AiOutput = {
  headline: string;
  subtitle: string;
  overview: string[];
  review: {
    teamOfWeek: { teamSlug: string; title: string; body: string };
    playersOfWeek: Array<{ playerSlug: string; body: string }>;
  };
  meta: {
    summary: string[];
    positions: Array<{ position: Position; comment: string; sTier: string[]; aTier: string[]; bTier: string[]; rising: string | null }>;
    banSpotlight: { championSlug: string; comment: string };
    sources: Array<{ title: string; url: string }>;
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
    tools: [{ type: "web_search" }],
    tool_choice: "auto",
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `이번 주 LCK 데이터입니다. 모든 수치·티어·순위는 이 데이터를 근거로 삼되, 스포트라이트와 총평의 '서사'(우승·MVP·시리즈 활약 등 대회 맥락)는 web_search로 조사해 반영해 주세요.\n\n${JSON.stringify(payload)}`,
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
    // web_search 도구 호출이 섞여 있으므로 마지막 message 아이템에서 본문을 찾는다.
    const messages = (json.output ?? []).filter((item: any) => item.type === "message");
    const message = messages[messages.length - 1];
    const textPart = message?.content?.find((part: any) => part.type === "output_text");
    if (!textPart?.text) throw new Error("OpenAI 응답에서 본문을 찾지 못했습니다.");

    return {
      output: stripMarkdownCitations(JSON.parse(textPart.text) as AiOutput),
      usage: { input: json.usage?.input_tokens ?? 0, output: json.usage?.output_tokens ?? 0 },
    };
  }
}

// ── 메인 ────────────────────────────────────────────────────────

async function main() {
  loadEnvFile();

  const dryRun = process.argv.includes("--dry-run");
  const model = argValue("model") ?? process.env.OPENAI_WEEKLY_REPORT_MODEL ?? "gpt-5.5";
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
    fetchAll<ChampionRow>(supabase, "champions", "id,slug,name,image_url,ddragon_id"),
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
      "set_id,player_id,team_id,position,champion_id,kills,deaths,assists,cs,gold,damage_to_champions,vision_score,dpm,damage_share,vision_score_per_minute,cs_per_minute,gold_diff_at_15",
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
  const champAgg = new Map<string, {
    picks: number; bans: number; wins: number; positions: Map<string, number>;
    kills: number; deaths: number; assists: number;
    dpmSum: number; dpmN: number; gd15Sum: number; gd15N: number;
  }>();
  const aggFor = (championId: string) => {
    let agg = champAgg.get(championId);
    if (!agg) {
      agg = { picks: 0, bans: 0, wins: 0, positions: new Map(), kills: 0, deaths: 0, assists: 0, dpmSum: 0, dpmN: 0, gd15Sum: 0, gd15N: 0 };
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
    agg.kills += row.kills;
    agg.deaths += row.deaths;
    agg.assists += row.assists;
    const duration = setById.get(row.set_id)?.duration_seconds ?? null;
    const dpm = toNumber(row.dpm) ?? (duration ? (row.damage_to_champions * 60) / duration : null);
    if (dpm != null) { agg.dpmSum += dpm; agg.dpmN += 1; }
    const gd15 = toNumber(row.gold_diff_at_15);
    if (gd15 != null) { agg.gd15Sum += gd15; agg.gd15N += 1; }
  }
  for (const row of picksBans) {
    if (row.action_type !== "ban" || !row.champion_id) continue;
    aggFor(row.champion_id).bans += 1;
  }

  // 챔피언별 "누가 플레이했는지" 집계 — AI가 선수 활용 사례를 쓸 수 있게 페이로드에 넣는다.
  const champPlayerAgg = new Map<string, Map<string, { sets: number; wins: number; kills: number; deaths: number; assists: number }>>();
  for (const row of statRows) {
    if (!row.champion_id) continue;
    let byPlayer = champPlayerAgg.get(row.champion_id);
    if (!byPlayer) {
      byPlayer = new Map();
      champPlayerAgg.set(row.champion_id, byPlayer);
    }
    let usage = byPlayer.get(row.player_id);
    if (!usage) {
      usage = { sets: 0, wins: 0, kills: 0, deaths: 0, assists: 0 };
      byPlayer.set(row.player_id, usage);
    }
    usage.sets += 1;
    if (setById.get(row.set_id)?.winner_team_id === row.team_id) usage.wins += 1;
    usage.kills += row.kills;
    usage.deaths += row.deaths;
    usage.assists += row.assists;
  }

  const championStats: ReportChampionStat[] = [...champAgg.entries()]
    .map(([championId, agg]): ReportChampionStat | null => {
      const champion = championById.get(championId);
      if (!champion) return null;
      const modalPosition = [...agg.positions.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      // image_url이 비어 있는 챔피언이 많아 사이트 공통 규칙(ddragon 타일)으로 이미지를 확정해 저장한다.
      const imageUrl = championImage({ id: championId, slug: champion.slug, name: champion.name, imageUrl: champion.image_url ?? undefined, ddragonId: champion.ddragon_id ?? undefined });
      return {
        slug: champion.slug,
        name: champion.name,
        imageUrl: imageUrl || null,
        position: modalPosition,
        picks: agg.picks,
        bans: agg.bans,
        wins: agg.wins,
        losses: agg.picks - agg.wins,
        winRate: agg.picks > 0 ? agg.wins / agg.picks : 0,
        presenceRate: setCount > 0 ? (agg.picks + agg.bans) / setCount : 0,
        kda: agg.picks > 0 ? Number(((agg.kills + agg.assists) / Math.max(1, agg.deaths)).toFixed(2)) : null,
        avgDpm: agg.dpmN > 0 ? Math.round(agg.dpmSum / agg.dpmN) : null,
        avgGd15: agg.gd15N > 0 ? Math.round(agg.gd15Sum / agg.gd15N) : null,
        ...championScores(agg, setCount),
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
      .map((stat) => {
        const championId = championBySlug.get(stat.slug)?.id;
        const playedBy = [...(championId ? champPlayerAgg.get(championId) ?? new Map() : new Map()).entries()]
          .map(([playerId, usage]: [string, { sets: number; wins: number; kills: number; deaths: number; assists: number }]) => {
            const player = playerById.get(playerId);
            if (!player) return null;
            return {
              player: player.name,
              playerSlug: player.slug,
              teamSlug: player.team_id ? teamById.get(player.team_id)?.slug ?? null : null,
              sets: usage.sets,
              wins: usage.wins,
              kda: Number(((usage.kills + usage.assists) / Math.max(1, usage.deaths)).toFixed(1)),
            };
          })
          .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
          .sort((a, b) => b.sets - a.sets)
          .slice(0, 3);
        return {
          slug: stat.slug,
          name: stat.name,
          picks: stat.picks,
          bans: stat.bans,
          wins: stat.wins,
          winRatePct: pct(stat.winRate),
          banPickRatePct: pct(stat.presenceRate),
          kda: stat.kda,
          dpm: stat.avgDpm,
          goldDiffAt15: stat.avgGd15,
          statScore: stat.statScore,
          totalScore: stat.score,
          playedBy,
        };
      });
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
      .map((stat) => ({ slug: stat.slug, name: stat.name, bans: stat.bans, banPickRatePct: pct(stat.presenceRate) })),
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
    // 스포트라이트 후보 풀: KDA 순위만으로 뽑으면 캐리형 TOP/정글이 빠지므로,
    // (1) 주간 승수·출전이 많은 선수(결승·주요 시리즈 주역) 20명을 먼저 보장 포함하고
    // (2) 나머지 자리는 KDA 스탠드아웃으로 채워 서사와 스탯을 함께 넘긴다.
    players: (() => {
      const all = [...playerAgg.values()];
      const byImpact = [...all].sort((a, b) => b.wins - a.wins || b.sets - a.sets || kdaOf(b) - kdaOf(a));
      const byKda = [...all].sort((a, b) => kdaOf(b) - kdaOf(a));
      const chosen = new Map<string, PlayerAgg>();
      for (const agg of byImpact.slice(0, 20)) chosen.set(agg.player.id, agg);
      for (const agg of byKda) {
        if (chosen.size >= 45) break;
        chosen.set(agg.player.id, agg);
      }
      return [...chosen.values()]
        .sort((a, b) => b.wins - a.wins || kdaOf(b) - kdaOf(a))
        .map((agg) => ({
          slug: agg.player.slug,
          name: agg.player.name,
          teamSlug: agg.player.team_id ? teamById.get(agg.player.team_id)?.slug ?? null : null,
          position: agg.player.position,
          sets: agg.sets,
          wins: agg.wins,
          kda: Number(kdaOf(agg).toFixed(2)),
          champions: [...agg.champions.keys()].slice(0, 4),
        }));
    })(),
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
  console.log(`OpenAI 완료 — 입력 ${usage.input.toLocaleString()} · 출력 ${usage.output.toLocaleString()} 토큰`);

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
      sources: (ai.meta.sources ?? [])
        .filter((source) => typeof source.url === "string" && /^https?:\/\//.test(source.url) && source.title)
        .slice(0, 5),
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
