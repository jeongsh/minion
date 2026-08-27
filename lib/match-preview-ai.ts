import "server-only";

import { createHash } from "node:crypto";

import {
  getAllTeams,
  getMatchById,
  getMatches,
  getPlayerCareerHistories,
  getPlayerStatLines,
  getPlayers,
  getSets,
  getStages,
  getTournaments,
} from "@/lib/data/lck";
import {
  buildMatchPreviewFacts,
  type MatchPreviewFacts,
} from "@/lib/match-preview-facts";
import {
  isPremiumMatchPreview,
  matchPreviewGenerationPhase,
  matchPreviewNeedsRefresh,
  type MatchPreviewGenerationPhase,
} from "@/lib/match-preview-policy";
import {
  buildMatchPreviewStoryContext,
  type MatchPreviewStoryContext,
} from "@/lib/match-preview-story";
import {
  combineOpenAiUsage,
  measureOpenAiResponseUsage,
  type MeasuredOpenAiUsage,
} from "@/lib/openai-usage-cost";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  Match,
  Player,
  PlayerCareerHistory,
  PlayerStatLine,
  SetResult,
  Stage,
  Team,
  Tournament,
} from "@/lib/types";

const RESEARCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["claims"],
  properties: {
    claims: {
      type: "array",
      minItems: 0,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "claim", "attribution", "publishedAt", "sourceUrls"],
        properties: {
          kind: { type: "string", enum: ["fact", "assessment", "statement"] },
          claim: { type: "string" },
          attribution: { type: "string" },
          publishedAt: { type: "string" },
          sourceUrls: {
            type: "array",
            minItems: 1,
            maxItems: 3,
            items: { type: "string" },
          },
        },
      },
    },
  },
} as const;

const WRITER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "summary",
    "narrativeTitle",
    "narrativeBody",
    "narrativeTags",
    "narrativeClaimIndexes",
    "matchMeaning",
    "meaningClaimIndexes",
    "recentViewTitle",
    "recentViewBody",
    "recentViewClaimIndexes",
    "teamAWinCondition",
    "teamBWinCondition",
    "liveCheck",
    "winProbabilityA",
    "confidence",
    "evidenceIds",
  ],
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    narrativeTitle: { type: "string" },
    narrativeBody: { type: "string" },
    narrativeTags: {
      type: "array",
      minItems: 0,
      maxItems: 3,
      items: { type: "string" },
    },
    narrativeClaimIndexes: {
      type: "array",
      minItems: 0,
      maxItems: 5,
      items: { type: "integer", minimum: 0, maximum: 4 },
    },
    matchMeaning: { type: "string" },
    meaningClaimIndexes: {
      type: "array",
      minItems: 0,
      maxItems: 5,
      items: { type: "integer", minimum: 0, maximum: 4 },
    },
    recentViewTitle: { type: "string" },
    recentViewBody: { type: "string" },
    recentViewClaimIndexes: {
      type: "array",
      minItems: 0,
      maxItems: 5,
      items: { type: "integer", minimum: 0, maximum: 4 },
    },
    teamAWinCondition: { type: "string" },
    teamBWinCondition: { type: "string" },
    liveCheck: { type: "string" },
    winProbabilityA: { type: "integer", minimum: 5, maximum: 95 },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    evidenceIds: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string" },
    },
  },
} as const;

const MATCH_PREVIEW_PROMPT_VERSION = 10;
const MATCH_PREVIEW_CONTENT_VERSION = 2;
const DEFAULT_RESEARCH_MODEL = "gpt-5.4-mini";
const DEFAULT_STANDARD_MODEL = "gpt-5.4-mini";
const DEFAULT_PREMIUM_MODEL = "gpt-5.6-sol";

export type MatchAiPreviewSource = {
  title: string;
  url: string;
  publisher: string | null;
  publishedAt: string | null;
};

export type MatchAiPreviewNarrative = {
  title: string;
  body: string;
  tags: string[];
  sources: MatchAiPreviewSource[];
};

export type MatchAiPreviewRecentView = {
  title: string;
  body: string;
  asOf: string | null;
  sources: MatchAiPreviewSource[];
};

export type MatchAiPreviewConfidence = "low" | "medium" | "high";

export type MatchAiPreview = {
  headline: string;
  summary: string;
  narrative: MatchAiPreviewNarrative | null;
  matchMeaning: string | null;
  recentView: MatchAiPreviewRecentView | null;
  teamAWinCondition: string | null;
  teamBWinCondition: string | null;
  liveCheck: string;
  /** 이전 웹·모바일 소비자와의 호환을 위한 liveCheck 별칭. */
  watchPoint: string;
  /** teamA 기준 예상 승률(%). 캐시 이전 세대 데이터나 fallback에서는 null. */
  winProbabilityA: number | null;
  confidence: MatchAiPreviewConfidence;
  generatedAt: string | null;
  generationPhase: MatchPreviewGenerationPhase | "legacy" | null;
  evidence: string[];
  sources: MatchAiPreviewSource[];
  source: "ai" | "fallback";
};

type MatchAiPreviewInputs = {
  match: Match;
  tournament?: Tournament;
  stage?: Stage;
  teams: Team[];
  matches: Match[];
  sets: SetResult[];
  tournaments?: Tournament[];
  players?: Player[];
  playerStats?: PlayerStatLine[];
  careerHistories?: PlayerCareerHistory[];
};

type StoredEvidence = {
  facts: string[];
  sources: MatchAiPreviewSource[];
  winProbabilityA: number | null;
};

type MatchAiPreviewCacheRow = {
  input_hash?: string;
  summary: string;
  watch_point: string;
  evidence: unknown;
  content?: unknown;
  generated_at?: string;
  generation_phase?: string;
};

type WebSearchSource = {
  type?: string;
  title?: string;
  url?: string;
};

type OpenAiResponseJson = {
  id?: string;
  status?: string;
  incomplete_details?: unknown;
  usage?: unknown;
  output?: Array<{
    type?: string;
    action?: { sources?: WebSearchSource[] };
    content?: Array<{
      type?: string;
      text?: string;
      annotations?: WebSearchSource[];
    }>;
  }>;
};

type ResearchClaimKind = "fact" | "assessment" | "statement";

type ResearchClaim = {
  kind: ResearchClaimKind;
  claim: string;
  attribution: string | null;
  publishedAt: string | null;
  sources: MatchAiPreviewSource[];
};

type InternalEvidence = {
  id: string;
  text: string;
};

type NormalizedWriterPreview = Omit<MatchAiPreview, "source" | "generatedAt" | "generationPhase">;

type ResearchResult = {
  claims: ResearchClaim[];
  responseId: string | null;
  usage: MeasuredOpenAiUsage;
};

type WriterResult = {
  preview: NormalizedWriterPreview;
  responseId: string | null;
  usage: MeasuredOpenAiUsage;
};

type PreviewGenerationPlan = {
  context: ReturnType<typeof previewContext>;
  facts: MatchPreviewFacts;
  storyContext: MatchPreviewStoryContext;
  evidenceCatalog: InternalEvidence[];
  inputHash: string;
  writerModel: string;
  researchModel: string;
  phase: MatchPreviewGenerationPhase;
};

type GenerateAndStoreResult = {
  preview: MatchAiPreview;
  estimatedCostUsd: number | null;
  stored: boolean;
};

type RefreshMatchAiPreviewOptions = { force?: boolean };
type RefreshMissingMatchAiPreviewsOptions = { concurrency?: number; limit?: number };

export type RefreshMissingMatchAiPreviewsSummary = {
  eligible: number;
  missing: number;
  stale: number;
  generated: number;
  estimatedCostUsd: number;
  generatedByPhase: Record<MatchPreviewGenerationPhase, number>;
  failed: Array<{ matchId: string; error: string }>;
};

function fallbackPreview(facts: MatchPreviewFacts): MatchAiPreview {
  const { teamA, teamB } = facts;
  const opponentGap =
    teamA.averageOpponentRating !== null && teamB.averageOpponentRating !== null
      ? teamA.averageOpponentRating - teamB.averageOpponentRating
      : 0;
  const harderSchedule = Math.abs(opponentGap) >= 35
    ? opponentGap > 0 ? teamA.team : teamB.team
    : null;
  const cleanerTeam = teamA.cleanWins === teamB.cleanWins
    ? null
    : teamA.cleanWins > teamB.cleanWins ? teamA.team : teamB.team;
  const resilientTeam = teamA.closeWins === teamB.closeWins
    ? null
    : teamA.closeWins > teamB.closeWins ? teamA.team : teamB.team;
  const meetingLead = facts.firstMeeting
    ? "두 팀의 최근 기록상 첫 맞대결이다."
    : `최근 맞대결 기록은 ${facts.priorMeetings}번이다.`;
  const scheduleLine = harderSchedule
    ? `${harderSchedule}은 최근 더 강한 상대들을 거쳐와 단순 승패 이상의 무게가 있다.`
    : "최근 대진 난이도는 큰 차이가 없어 경기 내용의 완성도가 더 중요하다.";
  const contrast = cleanerTeam && resilientTeam && cleanerTeam !== resilientTeam
    ? `${cleanerTeam}의 깔끔한 마무리와 ${resilientTeam}의 접전 대응력이 맞부딪힌다.`
    : `${teamA.team}과 ${teamB.team}의 최근 경기력이 직접 비교되는 매치업이다.`;

  return {
    headline: "데이터로 보는 매치업",
    summary: `${meetingLead} ${scheduleLine}`,
    narrative: null,
    matchMeaning: null,
    recentView: null,
    teamAWinCondition: null,
    teamBWinCondition: null,
    liveCheck: contrast,
    watchPoint: contrast,
    winProbabilityA: null,
    confidence: "low",
    generatedAt: null,
    generationPhase: null,
    evidence: [
      `${teamA.team} 상대 평균 레이팅 ${teamA.averageOpponentRating ?? "-"}`,
      `${teamB.team} 상대 평균 레이팅 ${teamB.averageOpponentRating ?? "-"}`,
    ],
    sources: [],
    source: "fallback",
  };
}

function normalizedWinProbability(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(95, Math.max(5, Math.round(value)));
}

function normalizedText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizedOptionalDate(value: unknown) {
  const text = normalizedText(value, 32);
  if (!text) return null;
  return Number.isFinite(new Date(text).getTime()) ? text : null;
}

function canonicalSourceUrl(value: string) {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return value.trim().replace(/\/$/, "");
  }
}

function sourcePublisher(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isBlockedResearchSource(url: string) {
  const hostname = sourcePublisher(url)?.toLowerCase() ?? "";
  return [
    "reddit.com",
    "dcinside.com",
    "fmkorea.com",
    "theqoo.net",
    "namu.wiki",
    "blog.naver.com",
    "cafe.naver.com",
    "x.com",
    "twitter.com",
  ].some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

function normalizedSources(value: unknown): MatchAiPreviewSource[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as WebSearchSource & { publisher?: unknown; publishedAt?: unknown };
    const url = source.url?.trim();
    if (!url) return [];
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return [];
      const canonical = canonicalSourceUrl(url);
      if (seen.has(canonical)) return [];
      seen.add(canonical);
      return [{
        title: source.title?.trim().slice(0, 120) || parsed.hostname.replace(/^www\./, ""),
        url,
        publisher: normalizedText(source.publisher, 80) || sourcePublisher(url),
        publishedAt: normalizedOptionalDate(source.publishedAt),
      }];
    } catch {
      return [];
    }
  }).slice(0, 8);
}

function parseStoredEvidence(value: unknown): StoredEvidence {
  if (Array.isArray(value)) {
    return {
      facts: value.filter((item): item is string => typeof item === "string").slice(0, 4),
      sources: [],
      winProbabilityA: null,
    };
  }
  if (!value || typeof value !== "object") {
    return { facts: [], sources: [], winProbabilityA: null };
  }
  const stored = value as { facts?: unknown; sources?: unknown; winProbabilityA?: unknown };
  return {
    facts: Array.isArray(stored.facts)
      ? stored.facts.filter((item): item is string => typeof item === "string").slice(0, 4)
      : [],
    sources: normalizedSources(stored.sources),
    winProbabilityA: normalizedWinProbability(stored.winProbabilityA),
  };
}

function parseStoredNarrative(value: unknown): MatchAiPreviewNarrative | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { title?: unknown; body?: unknown; tags?: unknown; sources?: unknown };
  const title = normalizedText(row.title, 80);
  const body = normalizedText(row.body, 420);
  const sources = normalizedSources(row.sources);
  if (!title || !body || sources.length === 0) return null;
  return {
    title,
    body,
    tags: Array.isArray(row.tags)
      ? row.tags.flatMap((item) => {
          const tag = normalizedText(item, 20);
          return tag ? [tag] : [];
        }).slice(0, 3)
      : [],
    sources,
  };
}

function parseStoredRecentView(value: unknown): MatchAiPreviewRecentView | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { title?: unknown; body?: unknown; asOf?: unknown; sources?: unknown };
  const title = normalizedText(row.title, 80);
  const body = normalizedText(row.body, 360);
  const sources = normalizedSources(row.sources);
  if (!title || !body || sources.length === 0) return null;
  return {
    title,
    body,
    asOf: normalizedOptionalDate(row.asOf),
    sources,
  };
}

function previewContext(match: Match, tournament?: Tournament, stage?: Stage) {
  return {
    matchName: match.name,
    tournament: tournament?.name ?? null,
    tournamentSeason: tournament?.season ?? null,
    stage: stage?.name ?? null,
    matchStart: match.matchDate,
    bestOf: match.bestOf ?? null,
    bracketSide: match.bracketSide ?? null,
    advancesToMatchId: match.advancesToMatchId ?? null,
    leaguepediaMatchId: match.leaguepediaMatchId ?? null,
  };
}

function isTbdTeam(team: Team | undefined) {
  if (!team) return true;
  const names = [team.shortName, team.name, team.slug].map((value) => value.trim().toLowerCase());
  return names.some((value) => value === "tbd");
}

function hasResolvedParticipants(match: Match, teams: Team[]) {
  if (!match.teamAId || !match.teamBId) return false;
  return !isTbdTeam(teams.find((team) => team.id === match.teamAId)) &&
    !isTbdTeam(teams.find((team) => team.id === match.teamBId));
}

function isUpcomingMatch(match: Match) {
  return new Date(match.matchDate).getTime() > Date.now();
}

function parseConfidence(value: unknown): MatchAiPreviewConfidence {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function previewFromCacheRow(data: MatchAiPreviewCacheRow): MatchAiPreview {
  const storedEvidence = parseStoredEvidence(data.evidence);
  const content = data.content && typeof data.content === "object"
    ? data.content as {
        headline?: unknown;
        narrative?: unknown;
        matchMeaning?: unknown;
        recentView?: unknown;
        teamAWinCondition?: unknown;
        teamBWinCondition?: unknown;
        liveCheck?: unknown;
        confidence?: unknown;
      }
    : {};
  const liveCheck = normalizedText(content.liveCheck, 160) || data.watch_point;
  const phase = data.generation_phase === "story" || data.generation_phase === "final"
    ? data.generation_phase
    : "legacy";
  return {
    headline: normalizedText(content.headline, 80) || "AI 매치업 브리핑",
    summary: data.summary,
    narrative: parseStoredNarrative(content.narrative),
    matchMeaning: normalizedText(content.matchMeaning, 240) || null,
    recentView: parseStoredRecentView(content.recentView),
    teamAWinCondition: normalizedText(content.teamAWinCondition, 220) || null,
    teamBWinCondition: normalizedText(content.teamBWinCondition, 220) || null,
    liveCheck,
    watchPoint: liveCheck,
    winProbabilityA: storedEvidence.winProbabilityA,
    confidence: parseConfidence(content.confidence),
    generatedAt: data.generated_at ?? null,
    generationPhase: phase,
    evidence: storedEvidence.facts,
    sources: storedEvidence.sources,
    source: "ai",
  };
}

function buildInternalEvidenceCatalog(
  facts: MatchPreviewFacts,
  storyContext: MatchPreviewStoryContext,
): InternalEvidence[] {
  const entries: InternalEvidence[] = [
    { id: "team-a-recent", text: `${facts.teamA.team} 최근 전적 ${facts.teamA.recentRecord}, 세트 ${facts.teamA.setRecord}` },
    { id: "team-b-recent", text: `${facts.teamB.team} 최근 전적 ${facts.teamB.recentRecord}, 세트 ${facts.teamB.setRecord}` },
    {
      id: "team-a-series",
      text: `${facts.teamA.team} 최근 ${facts.teamA.statSetCount}세트 평균 킬 ${facts.teamA.averageKills ?? "-"}, 평균 골드 차이 ${facts.teamA.averageGoldDiff ?? "-"}`,
    },
    {
      id: "team-b-series",
      text: `${facts.teamB.team} 최근 ${facts.teamB.statSetCount}세트 평균 킬 ${facts.teamB.averageKills ?? "-"}, 평균 골드 차이 ${facts.teamB.averageGoldDiff ?? "-"}`,
    },
    {
      id: "team-a-objectives",
      text: `${facts.teamA.team} 세트 평균 드래곤 ${facts.teamA.averageDragons ?? "-"}, 바론 ${facts.teamA.averageBarons ?? "-"}, 타워 ${facts.teamA.averageTowers ?? "-"}`,
    },
    {
      id: "team-b-objectives",
      text: `${facts.teamB.team} 세트 평균 드래곤 ${facts.teamB.averageDragons ?? "-"}, 바론 ${facts.teamB.averageBarons ?? "-"}, 타워 ${facts.teamB.averageTowers ?? "-"}`,
    },
    {
      id: "schedule-strength",
      text: `최근 상대 평균 레이팅 ${facts.teamA.team} ${facts.teamA.averageOpponentRating ?? "-"}, ${facts.teamB.team} ${facts.teamB.averageOpponentRating ?? "-"}`,
    },
  ];
  for (const matchup of facts.roleMatchups) {
    if (!matchup.teamA && !matchup.teamB) continue;
    const describe = (side: typeof matchup.teamA) => side
      ? `${side.player} ${side.games}세트 KDA ${side.kda ?? "-"}, DPM ${side.dpm ?? "-"}, 15분 골드 차이 ${side.goldDiffAt15 ?? "-"}`
      : "데이터 없음";
    entries.push({
      id: `role-${matchup.position.toLowerCase()}`,
      text: `${matchup.position}: ${describe(matchup.teamA)} / ${describe(matchup.teamB)}`,
    });
  }
  if (storyContext.recentMeeting) {
    entries.push({
      id: "recent-meeting",
      text: `최근 맞대결 ${storyContext.recentMeeting.date}, ${storyContext.recentMeeting.winner} ${storyContext.recentMeeting.score} 승리`,
    });
  }
  return entries;
}

function responseOutputText(json: OpenAiResponseJson) {
  const messages = (json.output ?? []).filter((item) => item.type === "message");
  const message = messages[messages.length - 1];
  return message?.content?.find((item) => item.type === "output_text");
}

async function createOpenAiResponse(body: Record<string, unknown>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI 호출 실패 (${response.status}): ${detail.slice(0, 320)}`);
  }
  const json = await response.json() as OpenAiResponseJson;
  if (json.status === "incomplete") {
    throw new Error(`OpenAI 응답이 잘렸습니다: ${JSON.stringify(json.incomplete_details)}`);
  }
  return json;
}

function normalizeResearchClaims(
  value: unknown,
  actualSources: MatchAiPreviewSource[],
): ResearchClaim[] {
  if (!value || typeof value !== "object") return [];
  const rows = (value as { claims?: unknown }).claims;
  if (!Array.isArray(rows)) return [];
  const actualByUrl = new Map(
    actualSources
      .filter((source) => !isBlockedResearchSource(source.url))
      .map((source) => [canonicalSourceUrl(source.url), source]),
  );
  return rows.flatMap<ResearchClaim>((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as {
      kind?: unknown;
      claim?: unknown;
      attribution?: unknown;
      publishedAt?: unknown;
      sourceUrls?: unknown;
    };
    const kind = row.kind === "fact" || row.kind === "assessment" || row.kind === "statement"
      ? row.kind
      : null;
    const claim = normalizedText(row.claim, 320);
    const attribution = normalizedText(row.attribution, 100) || null;
    const publishedAt = normalizedOptionalDate(row.publishedAt);
    const selectedUrls = Array.isArray(row.sourceUrls)
      ? row.sourceUrls.flatMap((url) => typeof url === "string" ? [canonicalSourceUrl(url)] : [])
      : [];
    const sources = selectedUrls.flatMap((url) => {
      const source = actualByUrl.get(url);
      return source ? [{ ...source, publisher: attribution || source.publisher, publishedAt }] : [];
    });
    const uniqueSources = normalizedSources(sources);
    if (!kind || !claim || uniqueSources.length === 0) return [];
    if ((kind === "assessment" || kind === "statement") && !attribution) return [];
    return [{ kind, claim, attribution, publishedAt, sources: uniqueSources }];
  }).slice(0, 5);
}

async function researchMatch({
  context,
  storyContext,
  phase,
  model,
}: {
  context: ReturnType<typeof previewContext>;
  storyContext: MatchPreviewStoryContext;
  phase: MatchPreviewGenerationPhase;
  model: string;
}): Promise<ResearchResult> {
  const json = await createOpenAiResponse({
    model,
    reasoning: { effort: "low" },
    tools: [{ type: "web_search", search_context_size: "medium" }],
    tool_choice: "auto",
    max_tool_calls: 2,
    include: ["web_search_call.action.sources"],
    max_output_tokens: 2_200,
    prompt_cache_key: `match-preview-research-v${MATCH_PREVIEW_PROMPT_VERSION}`,
    input: [
      {
        role: "system",
        content: [
          "역할: 리그 오브 레전드 e스포츠 경기의 서사와 최근 평가를 검증하는 한국어 리서처다.",
          "검색 목표 1: 두 팀 사이의 최근 이적·맞트레이드·친정팀 재회·직전 중요한 리매치·선수나 팀의 직접 발언을 찾는다.",
          "검색 목표 2: 같은 경기 주간의 공식 파워랭킹, 기명 기사, 공식 인터뷰처럼 귀속 가능한 최근 평가를 찾는다.",
          "rosterLinks는 내부 경력 DB가 만든 검색 힌트일 뿐이다. 이 항목만으로 이적, 트레이드, 시점, 감정, 동기를 사실로 쓰지 말고 반드시 검색 출처로 확인한다.",
          "출처 우선순위: 리그·팀·선수 공식 발표, 공식 경기/로스터 페이지, Riot 파워랭킹, 직접 인터뷰, 기명된 신뢰도 높은 e스포츠 매체 순이다.",
          "커뮤니티 게시물·댓글·위키·검색 스니펫만 있는 결과는 근거로 쓰지 않는다. 출처가 약하면 claims를 비워 둔다.",
          "fact는 이적·대진·결과처럼 확인 가능한 사실, assessment는 매체·공식 지표의 평가, statement는 당사자 발언의 충실한 요약이다.",
          "assessment와 statement는 attribution에 평가 주체나 발언자를 반드시 적는다. 긴 직접 인용은 피하고 한국어로 요약한다.",
          "최근 평가는 원칙적으로 14일 이내, 해당 경기 프리뷰는 72시간 이내 자료를 우선한다. 날짜를 확인하지 못하면 publishedAt을 빈 문자열로 둔다.",
          "'세간의 평가', '대체로', '중론' 같은 합의 표현의 후보는 서로 독립적인 출처가 2개 이상일 때만 만든다.",
          "복수심, 앙금, 각오 같은 내면은 선수·팀의 직접 발언 없이는 만들지 않는다. stage 이름만 보고 탈락이나 진출 조건을 추론하지 않는다.",
          "각 claim의 sourceUrls에는 실제 검색에서 확인한 원문 URL만 넣는다. 출력은 지정된 JSON 스키마만 따른다.",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          currentDate: new Date().toISOString(),
          generationPhase: phase,
          match: context,
          storyCandidates: storyContext,
        }),
      },
    ],
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "match_preview_research",
        strict: true,
        schema: RESEARCH_SCHEMA,
      },
    },
  });
  const outputText = responseOutputText(json);
  if (!outputText?.text) throw new Error("OpenAI 리서치 응답 본문이 없습니다.");
  const searchedSources = (json.output ?? []).flatMap((item) => item.action?.sources ?? []);
  const citedSources = outputText.annotations ?? [];
  const actualSources = normalizedSources([...citedSources, ...searchedSources]);
  return {
    claims: normalizeResearchClaims(JSON.parse(outputText.text), actualSources),
    responseId: json.id ?? null,
    usage: measureOpenAiResponseUsage(json, model),
  };
}

function claimIndexes(value: unknown, claims: ResearchClaim[]) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) =>
    Number.isInteger(item) && (item as number) >= 0 && (item as number) < claims.length
      ? [item as number]
      : [],
  ))];
}

function sourcesForClaims(claims: ResearchClaim[], indexes: number[]) {
  return normalizedSources(indexes.flatMap((index) => claims[index]?.sources ?? []));
}

function sourceDomainCount(sources: MatchAiPreviewSource[]) {
  return new Set(sources.flatMap((source) => sourcePublisher(source.url) ?? [])).size;
}

function cappedConfidence(
  requested: MatchAiPreviewConfidence,
  sourceCount: number,
  evidenceCount: number,
): MatchAiPreviewConfidence {
  const max: MatchAiPreviewConfidence = sourceCount >= 2 && evidenceCount >= 2
    ? "high"
    : sourceCount >= 1 || evidenceCount >= 2 ? "medium" : "low";
  const rank: Record<MatchAiPreviewConfidence, number> = { low: 0, medium: 1, high: 2 };
  return rank[requested] <= rank[max] ? requested : max;
}

function normalizeWriterPreview({
  value,
  claims,
  evidenceCatalog,
}: {
  value: unknown;
  claims: ResearchClaim[];
  evidenceCatalog: InternalEvidence[];
}): NormalizedWriterPreview {
  if (!value || typeof value !== "object") throw new Error("AI 프리뷰 응답이 객체가 아닙니다.");
  const row = value as Record<string, unknown>;
  const headline = normalizedText(row.headline, 80);
  const summary = normalizedText(row.summary, 420);
  const liveCheck = normalizedText(row.liveCheck, 180);
  if (!headline || !summary || !liveCheck) throw new Error("AI 프리뷰의 필수 문장이 없습니다.");

  const evidenceById = new Map(evidenceCatalog.map((item) => [item.id, item.text]));
  const evidenceIds = Array.isArray(row.evidenceIds)
    ? [...new Set(row.evidenceIds.flatMap((item) =>
        typeof item === "string" && evidenceById.has(item) ? [item] : [],
      ))].slice(0, 4)
    : [];
  const fallbackEvidenceIds = evidenceCatalog.slice(0, 2).map((item) => item.id);
  const evidence = (evidenceIds.length > 0 ? evidenceIds : fallbackEvidenceIds)
    .flatMap((id) => evidenceById.get(id) ?? []);

  const narrativeIndexes = claimIndexes(row.narrativeClaimIndexes, claims);
  const narrativeSources = sourcesForClaims(claims, narrativeIndexes);
  const narrativeTitle = normalizedText(row.narrativeTitle, 80);
  const narrativeBody = normalizedText(row.narrativeBody, 420);
  const narrative = narrativeTitle && narrativeBody && narrativeSources.length > 0
    ? {
        title: narrativeTitle,
        body: narrativeBody,
        tags: Array.isArray(row.narrativeTags)
          ? row.narrativeTags.flatMap((item) => {
              const tag = normalizedText(item, 20);
              return tag ? [tag] : [];
            }).slice(0, 3)
          : [],
        sources: narrativeSources,
      }
    : null;

  const recentViewIndexes = claimIndexes(row.recentViewClaimIndexes, claims);
  const recentViewSources = sourcesForClaims(claims, recentViewIndexes);
  const hasAttributedAssessment = recentViewIndexes.some((index) => {
    const claim = claims[index];
    return claim?.kind === "assessment" || claim?.kind === "statement";
  });
  const recentViewTitle = normalizedText(row.recentViewTitle, 80);
  const recentViewBody = normalizedText(row.recentViewBody, 360);
  const consensusLanguage = /세간|대체로|중론|공통된 평가|전반적인 평가/.test(recentViewBody);
  const consensusSupported = !consensusLanguage || sourceDomainCount(recentViewSources) >= 2;
  const recentDates = recentViewSources
    .flatMap((source) => source.publishedAt ?? [])
    .sort((left, right) => right.localeCompare(left));
  const recentView =
    recentViewTitle && recentViewBody && recentViewSources.length > 0 &&
    hasAttributedAssessment && consensusSupported
      ? {
          title: recentViewTitle,
          body: recentViewBody,
          asOf: recentDates[0] ?? null,
          sources: recentViewSources,
        }
      : null;

  const meaningIndexes = claimIndexes(row.meaningClaimIndexes, claims);
  const meaningSources = sourcesForClaims(claims, meaningIndexes);
  const sources = normalizedSources([
    ...(narrative?.sources ?? []),
    ...(recentView?.sources ?? []),
    ...meaningSources,
  ]);
  const requestedConfidence = parseConfidence(row.confidence);
  const winProbabilityA = normalizedWinProbability(row.winProbabilityA);
  if (winProbabilityA === null) throw new Error("AI 프리뷰의 예상 승률이 없습니다.");
  return {
    headline,
    summary,
    narrative,
    matchMeaning: normalizedText(row.matchMeaning, 240) || null,
    recentView,
    teamAWinCondition: normalizedText(row.teamAWinCondition, 220) || null,
    teamBWinCondition: normalizedText(row.teamBWinCondition, 220) || null,
    liveCheck,
    watchPoint: liveCheck,
    winProbabilityA,
    confidence: cappedConfidence(requestedConfidence, sourceDomainCount(sources), evidence.length),
    evidence,
    sources,
  };
}

async function writeMatchPreview({
  context,
  facts,
  storyContext,
  evidenceCatalog,
  claims,
  phase,
  model,
}: {
  context: ReturnType<typeof previewContext>;
  facts: MatchPreviewFacts;
  storyContext: MatchPreviewStoryContext;
  evidenceCatalog: InternalEvidence[];
  claims: ResearchClaim[];
  phase: MatchPreviewGenerationPhase;
  model: string;
}): Promise<WriterResult> {
  const json = await createOpenAiResponse({
    model,
    reasoning: { effort: "medium" },
    max_output_tokens: 2_600,
    prompt_cache_key: `match-preview-writer-v${MATCH_PREVIEW_PROMPT_VERSION}`,
    input: [
      {
        role: "system",
        content: [
          "역할: 검증된 자료와 경기 데이터로 한국어 LoL e스포츠 프리뷰를 쓰는 에디터다.",
          "독자가 경기 전 1분 안에 오늘의 서사, 최근 평가, 양 팀 승리 조건, 경기 중 확인할 장면을 이해하게 한다.",
          "externalClaims만 외부 사실로 사용할 수 있다. claim에 없는 이적 시점·트레이드 관계·부상·감정·동기·탈락 조건을 만들지 않는다.",
          "narrativeTitle/body를 썼다면 실제로 사용한 externalClaims의 0부터 시작하는 인덱스를 narrativeClaimIndexes에 넣는다. 근거가 없으면 제목·본문·태그·인덱스를 모두 비운다.",
          "recentView는 평가 주체를 문장 안에 명시하고 assessment 또는 statement claim만 사용한다. 합의 표현은 독립 출처 2개 이상일 때만 쓴다. 근거가 없으면 관련 필드를 비운다.",
          "matchMeaning은 stage·bracket 정보나 검증된 claim에 명시된 범위만 쓴다. stage 이름만으로 '패자 탈락', 진출권, 시드를 추정하지 않는다.",
          "summary는 정확히 2문장이다. 최근 팀·선수 지표를 비교해 한 팀의 강점과 상대의 반격 경로를 구체적으로 설명한다.",
          "teamAWinCondition/teamBWinCondition은 각각 1문장이다. 15분 골드·경험치, DPM, 오브젝트 전환, 한타 진입처럼 internalFacts가 뒷받침하는 실행 조건을 쓴다.",
          "liveCheck는 정확히 1문장이다. 팀명 또는 선수명을 넣고 시청 중 확인 가능한 기준 하나만 쓴다.",
          "선수 수치는 roleMatchups에서 games가 1 이상일 때만 쓴다. 밴픽 성향, 컨디션, 집중력처럼 데이터에 없는 내용을 만들지 않는다.",
          "winProbabilityA는 internalFacts.teamA의 승률을 5~95 정수로 쓴다. 확정적 승패 표현은 금지한다.",
          "evidenceIds에는 최종 데이터 문장에 실제로 쓴 internalEvidenceCatalog의 id만 넣는다. 숫자를 새로 작성한 evidence 문장은 출력하지 않는다.",
          "headline은 서사가 있으면 가장 강한 검증 서사를, 없으면 데이터상 가장 선명한 대결 구도를 18~45자로 쓴다.",
          "confidence는 출처 수·최신성·내부 표본을 함께 보고 low/medium/high 중 고른다. 출력은 지정된 JSON 스키마만 따른다.",
        ].join("\n"),
      },
      {
        role: "user",
        content: JSON.stringify({
          generationPhase: phase,
          match: context,
          internalFacts: facts,
          storyCandidates: storyContext,
          internalEvidenceCatalog: evidenceCatalog,
          externalClaims: claims.map((claim) => ({
            kind: claim.kind,
            claim: claim.claim,
            attribution: claim.attribution,
            publishedAt: claim.publishedAt,
            sourceUrls: claim.sources.map((source) => source.url),
          })),
        }),
      },
    ],
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: "match_preview",
        strict: true,
        schema: WRITER_SCHEMA,
      },
    },
  });
  const outputText = responseOutputText(json);
  if (!outputText?.text) throw new Error("OpenAI 프리뷰 응답 본문이 없습니다.");
  return {
    preview: normalizeWriterPreview({
      value: JSON.parse(outputText.text),
      claims,
      evidenceCatalog,
    }),
    responseId: json.id ?? null,
    usage: measureOpenAiResponseUsage(json, model),
  };
}

function previewGenerationPlan(
  inputs: MatchAiPreviewInputs,
  phase: MatchPreviewGenerationPhase,
): PreviewGenerationPlan {
  const {
    match,
    tournament,
    stage,
    teams,
    matches,
    sets,
    tournaments,
    players,
    playerStats,
    careerHistories,
  } = inputs;
  const facts = buildMatchPreviewFacts({
    match,
    teams,
    matches,
    sets,
    tournaments,
    players,
    playerStats,
  });
  const storyContext = buildMatchPreviewStoryContext({
    match,
    tournament,
    stage,
    teams,
    matches,
    players,
    careerHistories,
  });
  const premium = isPremiumMatchPreview({ match, tournament, stage });
  const writerModel = process.env.OPENAI_MATCH_PREVIEW_MODEL ??
    (premium
      ? process.env.OPENAI_MATCH_PREVIEW_PREMIUM_MODEL ?? DEFAULT_PREMIUM_MODEL
      : process.env.OPENAI_MATCH_PREVIEW_STANDARD_MODEL ?? DEFAULT_STANDARD_MODEL);
  const researchModel = process.env.OPENAI_MATCH_PREVIEW_RESEARCH_MODEL ?? DEFAULT_RESEARCH_MODEL;
  const context = previewContext(match, tournament, stage);
  const evidenceCatalog = buildInternalEvidenceCatalog(facts, storyContext);
  const inputHash = createHash("sha256")
    .update(JSON.stringify({
      version: MATCH_PREVIEW_PROMPT_VERSION,
      phase,
      writerModel,
      researchModel,
      context,
      facts,
      storyContext,
      evidenceCatalog,
    }))
    .digest("hex");
  return {
    context,
    facts,
    storyContext,
    evidenceCatalog,
    inputHash,
    writerModel,
    researchModel,
    phase,
  };
}

function phaseRank(value: string | undefined) {
  if (value === "final") return 2;
  if (value === "story") return 1;
  return 0;
}

async function generateAndStoreMatchAiPreview(
  inputs: MatchAiPreviewInputs,
  plan: PreviewGenerationPlan,
): Promise<GenerateAndStoreResult> {
  let research: ResearchResult | null = null;
  try {
    research = await researchMatch({
      context: plan.context,
      storyContext: plan.storyContext,
      phase: plan.phase,
      model: plan.researchModel,
    });
  } catch (error) {
    console.warn(`[match-ai-preview] research failed for ${inputs.match.id}`, error);
  }
  const claims = research?.claims ?? [];
  const writer = await writeMatchPreview({
    context: plan.context,
    facts: plan.facts,
    storyContext: plan.storyContext,
    evidenceCatalog: plan.evidenceCatalog,
    claims,
    phase: plan.phase,
    model: plan.writerModel,
  });
  const usage = combineOpenAiUsage([...(research ? [research.usage] : []), writer.usage]);
  const generatedAt = new Date().toISOString();
  const preview: MatchAiPreview = {
    ...writer.preview,
    generatedAt,
    generationPhase: plan.phase,
    source: "ai",
  };
  const admin = createSupabaseAdminClient();
  const { data: latest } = await admin
    .from("match_ai_previews")
    .select("summary,watch_point,evidence,content,generated_at,generation_phase")
    .eq("match_id", inputs.match.id)
    .maybeSingle();
  if (latest && phaseRank(latest.generation_phase as string) > phaseRank(plan.phase)) {
    return {
      preview: previewFromCacheRow(latest as MatchAiPreviewCacheRow),
      estimatedCostUsd: usage.estimatedCostUsd,
      stored: false,
    };
  }

  const { error } = await admin.from("match_ai_previews").upsert({
    match_id: inputs.match.id,
    input_hash: plan.inputHash,
    model: plan.writerModel,
    research_model: plan.researchModel,
    generation_phase: plan.phase,
    response_id: writer.responseId,
    research_response_id: research?.responseId ?? null,
    summary: preview.summary,
    watch_point: preview.watchPoint,
    evidence: {
      version: MATCH_PREVIEW_CONTENT_VERSION,
      facts: preview.evidence,
      sources: preview.sources,
      winProbabilityA: preview.winProbabilityA,
    },
    content: {
      version: MATCH_PREVIEW_CONTENT_VERSION,
      headline: preview.headline,
      narrative: preview.narrative,
      matchMeaning: preview.matchMeaning,
      recentView: preview.recentView,
      teamAWinCondition: preview.teamAWinCondition,
      teamBWinCondition: preview.teamBWinCondition,
      liveCheck: preview.liveCheck,
      confidence: preview.confidence,
      researchClaims: claims,
      researchFailed: research === null,
    },
    input_tokens: usage.inputTokens,
    cached_input_tokens: usage.cachedInputTokens,
    output_tokens: usage.outputTokens,
    reasoning_tokens: usage.reasoningTokens,
    total_tokens: usage.totalTokens,
    web_search_calls: usage.webSearchCalls,
    estimated_cost_usd: usage.estimatedCostUsd,
    pricing_snapshot: usage.pricingSnapshot,
    generated_at: generatedAt,
  });
  if (error) throw new Error(error.message);
  return { preview, estimatedCostUsd: usage.estimatedCostUsd, stored: true };
}

export async function getMatchAiPreview({
  match,
  teams,
  matches,
  sets,
  tournaments,
  players,
  playerStats,
}: MatchAiPreviewInputs): Promise<MatchAiPreview> {
  const facts = buildMatchPreviewFacts({
    match,
    teams,
    matches,
    sets,
    tournaments,
    players,
    playerStats,
  });
  const fallback = fallbackPreview(facts);
  if (!isUpcomingMatch(match) || !hasResolvedParticipants(match, teams)) return fallback;
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("match_ai_previews")
      .select("summary,watch_point,evidence,content,generated_at,generation_phase")
      .eq("match_id", match.id)
      .maybeSingle();
    if (!error && data) return previewFromCacheRow(data as MatchAiPreviewCacheRow);
  } catch (error) {
    console.warn("[match-ai-preview] cache lookup failed", error);
  }
  return fallback;
}

export async function refreshMatchAiPreviewCache(
  inputs: MatchAiPreviewInputs,
  phase = matchPreviewGenerationPhase(inputs.match.matchDate, Date.now(), true) ?? "story",
): Promise<MatchAiPreview> {
  const plan = previewGenerationPlan(inputs, phase);
  return (await generateAndStoreMatchAiPreview(inputs, plan)).preview;
}

export async function refreshMatchAiPreviewCacheForMatchId(
  matchId: string,
  options: RefreshMatchAiPreviewOptions = {},
) {
  const [match, teams] = await Promise.all([getMatchById(matchId), getAllTeams()]);
  if (!match) throw new Error(`Match not found for AI preview refresh: ${matchId}`);
  const admin = createSupabaseAdminClient();
  if (!hasResolvedParticipants(match, teams) || !isUpcomingMatch(match)) {
    const { error } = await admin.from("match_ai_previews").delete().eq("match_id", match.id);
    if (error) throw new Error(error.message);
    return null;
  }

  const phase = matchPreviewGenerationPhase(match.matchDate, Date.now(), options.force === true);
  const { data: cached, error: cacheError } = await admin
    .from("match_ai_previews")
    .select("input_hash,summary,watch_point,evidence,content,generated_at,generation_phase")
    .eq("match_id", match.id)
    .maybeSingle();
  if (cacheError) throw new Error(cacheError.message);
  if (!phase) return cached ? previewFromCacheRow(cached as MatchAiPreviewCacheRow) : null;

  const [matches, sets, tournaments, players, playerStats, stages] = await Promise.all([
    getMatches(),
    getSets(),
    getTournaments(),
    getPlayers(),
    getPlayerStatLines(),
    getStages(),
  ]);
  const relevantPlayers = players.filter(
    (player) => player.teamId === match.teamAId || player.teamId === match.teamBId,
  );
  const careerHistories = await getPlayerCareerHistories(relevantPlayers.map((player) => player.id));
  const tournament = tournaments.find((item) => item.id === match.tournamentId);
  const stage = stages.find((item) => item.id === match.stageId);
  const inputs: MatchAiPreviewInputs = {
    match,
    tournament,
    stage,
    teams,
    matches,
    sets,
    tournaments,
    players,
    playerStats,
    careerHistories,
  };
  const plan = previewGenerationPlan(inputs, phase);
  if (
    !options.force && cached &&
    !matchPreviewNeedsRefresh({
      cachedHash: cached.input_hash as string | null,
      expectedHash: plan.inputHash,
      cachedPhase: cached.generation_phase as string | null,
      expectedPhase: phase,
    })
  ) {
    return previewFromCacheRow(cached as MatchAiPreviewCacheRow);
  }
  return (await generateAndStoreMatchAiPreview(inputs, plan)).preview;
}

/**
 * 참가 팀이 확정됐고 24시간 안에 시작하는 경기만 자동 생성한다.
 * 각 경기는 story(24시간)와 final(2시간) phase에서 최대 한 번씩 생성되며,
 * 내부 경기 데이터나 프롬프트 버전이 바뀐 경우에만 같은 phase에서 갱신한다.
 */
export async function refreshMissingUpcomingMatchAiPreviews(
  options: RefreshMissingMatchAiPreviewsOptions = {},
): Promise<RefreshMissingMatchAiPreviewsSummary> {
  const [teams, matches, sets, tournaments, players, playerStats, stages] = await Promise.all([
    getAllTeams(),
    getMatches(),
    getSets(),
    getTournaments(),
    getPlayers(),
    getPlayerStatLines(),
    getStages(),
  ]);
  const now = Date.now();
  const eligible = matches
    .flatMap((match) => {
      const phase = matchPreviewGenerationPhase(match.matchDate, now);
      return phase && hasResolvedParticipants(match, teams) ? [{ match, phase }] : [];
    })
    .sort(
      (left, right) =>
        new Date(left.match.matchDate).getTime() - new Date(right.match.matchDate).getTime(),
    );
  if (eligible.length === 0) {
    return {
      eligible: 0,
      missing: 0,
      stale: 0,
      generated: 0,
      estimatedCostUsd: 0,
      generatedByPhase: { story: 0, final: 0 },
      failed: [],
    };
  }

  const participatingTeamIds = new Set(eligible.flatMap(({ match }) => [match.teamAId, match.teamBId]));
  const relevantPlayers = players.filter((player) => participatingTeamIds.has(player.teamId));
  const careerHistories = await getPlayerCareerHistories(relevantPlayers.map((player) => player.id));
  const admin = createSupabaseAdminClient();
  const { data: cachedRows, error: cacheError } = await admin
    .from("match_ai_previews")
    .select("match_id,input_hash,generation_phase")
    .in("match_id", eligible.map(({ match }) => match.id));
  if (cacheError) throw new Error(cacheError.message);
  const cachedByMatchId = new Map((cachedRows ?? []).map((row) => [row.match_id as string, row]));
  const planned = eligible.map(({ match, phase }) => {
    const tournament = tournaments.find((item) => item.id === match.tournamentId);
    const stage = stages.find((item) => item.id === match.stageId);
    const inputs: MatchAiPreviewInputs = {
      match,
      tournament,
      stage,
      teams,
      matches,
      sets,
      tournaments,
      players,
      playerStats,
      careerHistories,
    };
    return { inputs, plan: previewGenerationPlan(inputs, phase) };
  });
  const allMissing = planned.filter(({ inputs }) => !cachedByMatchId.has(inputs.match.id));
  const allStale = planned.filter(({ inputs, plan }) => {
    const cached = cachedByMatchId.get(inputs.match.id);
    return Boolean(cached) && matchPreviewNeedsRefresh({
      cachedHash: cached?.input_hash as string | null,
      expectedHash: plan.inputHash,
      cachedPhase: cached?.generation_phase as string | null,
      expectedPhase: plan.phase,
    });
  });
  const allPending = [...allMissing, ...allStale].sort(
    (left, right) =>
      new Date(left.inputs.match.matchDate).getTime() - new Date(right.inputs.match.matchDate).getTime(),
  );
  const limit = Math.max(0, options.limit ?? allPending.length);
  const pending = allPending.slice(0, limit);
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, pending.length || 1));
  const failed: Array<{ matchId: string; error: string }> = [];
  const generatedByPhase: Record<MatchPreviewGenerationPhase, number> = { story: 0, final: 0 };
  let generated = 0;
  let estimatedCostUsd = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < pending.length) {
      const item = pending[cursor++];
      try {
        const result = await generateAndStoreMatchAiPreview(item.inputs, item.plan);
        if (result.stored) {
          generated += 1;
          generatedByPhase[item.plan.phase] += 1;
        }
        estimatedCostUsd += result.estimatedCostUsd ?? 0;
      } catch (error) {
        failed.push({
          matchId: item.inputs.match.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return {
    eligible: eligible.length,
    missing: allMissing.length,
    stale: allStale.length,
    generated,
    estimatedCostUsd,
    generatedByPhase,
    failed,
  };
}
