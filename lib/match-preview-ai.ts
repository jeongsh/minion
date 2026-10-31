import "server-only";

import { createHash, randomUUID } from "node:crypto";

import {
  getAllTeams,
  getMatchById,
  getMatches,
  getPlayerStatLines,
  getAllPlayers,
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
  matchPreviewFailureRetryAllowed,
  matchPreviewGenerationPhase,
  type MatchPreviewGenerationPhase,
} from "@/lib/match-preview-policy";
import {
  combineOpenAiUsage,
  measureOpenAiResponseUsage,
  type MeasuredOpenAiUsage,
} from "@/lib/openai-usage-cost";
import {
  buildMatchPreviewWinConditionCandidates,
  resolveMatchPreviewWinConditions,
} from "@/lib/match-preview-win-conditions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { supplementMatchBriefingData } from "@/lib/data/match-briefing";
import { getStoredMatchAiPreview, type MatchAiPreviewCacheRow } from "@/lib/data/match-ai-preview-cache";
import { createMatchBriefingSnapshot, type LeaguepediaBriefingRows } from "@/lib/match-briefing-data";
import { getPowerRankings } from "@/lib/data/power-rankings";
import { getTeamBriefingSourceRows } from "@/lib/data/team-briefing-sources";
import { backfillMatchBriefingSnapshot } from "@/lib/data/match-briefing-snapshot";
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

const WRITER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["oneLiner", "watchPoints"],
  properties: {
    oneLiner: { type: "string", maxLength: 160, pattern: "^[^\\u00b7]*$" },
    watchPoints: {
      type: "array", minItems: 3, maxItems: 3, items: { type: "string", maxLength: 120, pattern: "^[^\\u00b7]*$" },
    },
  },
} as const;

const MATCH_PREVIEW_PROMPT_VERSION = 19;
const MATCH_PREVIEW_CONTENT_VERSION = 4;
const DEFAULT_STANDARD_MODEL = "gpt-5.4-mini";
const DEFAULT_PREMIUM_MODEL = "gpt-5.6-sol";
// 두줄평과 관전 포인트만 생성하며 추론을 포함한 출력량도 제한한다.
const MATCH_PREVIEW_WRITER_MAX_OUTPUT_TOKENS = 3_000;
const MATCH_PREVIEW_STEP_TIMEOUT_MS = 55_000;
const MATCH_PREVIEW_LEASE_MS = 6 * 60 * 1_000;

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
  /** 차트 위에 놓는 두 줄 평. 기존 필드명은 캐시와 소비자 호환을 위해 유지한다. */
  oneLiner: string | null;
  /** 데이터 근거와 확인할 장면을 담은 관전 포인트 3개. 이전 세대 캐시와 fallback에서는 빈 배열. */
  watchPoints: string[];
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
  briefingRows?: LeaguepediaBriefingRows[];
};

type StoredEvidence = {
  facts: string[];
  sources: MatchAiPreviewSource[];
  winProbabilityA: number | null;
};

type MatchAiPreviewRunRetryRow = {
  match_id: string;
  input_hash: string;
  generation_phase: string;
  status: string;
  started_at: string;
  completed_at?: string | null;
};

type WebSearchSource = {
  type?: string;
  title?: string;
  url?: string;
  start_index?: number;
  end_index?: number;
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

type NormalizedWriterPreview = Omit<MatchAiPreview, "source" | "generatedAt" | "generationPhase">;

class MeasuredOpenAiStepError extends Error {
  readonly responseId: string | null;
  readonly usage: MeasuredOpenAiUsage;

  constructor(message: string, responseId: string | null, usage: MeasuredOpenAiUsage) {
    super(message);
    this.name = "MeasuredOpenAiStepError";
    this.responseId = responseId;
    this.usage = usage;
  }
}

type WriterResult = {
  preview: NormalizedWriterPreview;
  responseId: string | null;
  usage: MeasuredOpenAiUsage;
};

type PreviewGenerationPlan = {
  context: ReturnType<typeof previewContext>;
  facts: MatchPreviewFacts;
  inputHash: string;
  writerModel: string;
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
  deferred: number;
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
    oneLiner: null,
    watchPoints: [],
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

function normalizedWatchPoints(value: unknown) {
  return Array.isArray(value)
    ? value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim()] : []).slice(0, 3)
    : [];
}

function normalizedOptionalDate(value: unknown) {
  const text = normalizedText(value, 32);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function canonicalSourceUrl(value: string) {
  try {
    const parsed = new URL(value);
    parsed.hash = "";
    for (const key of [...parsed.searchParams.keys()]) {
      if (
        /^utm_/i.test(key) ||
        ["fbclid", "gclid", "ref_src", "ref_url", "mc_cid", "mc_eid"].includes(key.toLowerCase())
      ) {
        parsed.searchParams.delete(key);
      }
    }
    parsed.searchParams.sort();
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

function generationFailureState(rows: MatchAiPreviewRunRetryRow[], nowMs = Date.now()) {
  let failureCount = 0;
  let lastFailureAt: string | null = null;
  let hasActiveRun = false;
  for (const row of rows) {
    const startedTime = new Date(row.started_at).getTime();
    const staleRunning = row.status === "running" &&
      Number.isFinite(startedTime) && nowMs - startedTime >= MATCH_PREVIEW_LEASE_MS;
    if (row.status === "running" && !staleRunning) {
      hasActiveRun = true;
      break;
    }
    if (row.status !== "failed" && !staleRunning) break;
    failureCount += 1;
    if (!lastFailureAt) lastFailureAt = row.completed_at ?? row.started_at;
  }
  return { failureCount, lastFailureAt, hasActiveRun };
}

function generationRunKey(matchId: string, inputHash: string, phase: string) {
  return `${matchId}:${inputHash}:${phase}`;
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
  return names.some((value) => /^(?:tbd|tba|미정|미정 팀|unknown|-)$/.test(value));
}

function hasResolvedParticipants(match: Match, teams: Team[]) {
  if (!match.teamAId || !match.teamBId || match.teamAId === match.teamBId) return false;
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
        oneLiner?: unknown;
        watchPoints?: unknown;
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
    oneLiner: normalizedText(content.oneLiner, 160) || null,
    watchPoints: normalizedWatchPoints(content.watchPoints),
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

function upgradedCachedWinConditions(
  preview: MatchAiPreview,
  facts: MatchPreviewFacts,
  content: unknown,
) {
  const version = content && typeof content === "object"
    ? Number((content as { version?: unknown }).version)
    : 0;
  if (version >= MATCH_PREVIEW_CONTENT_VERSION) return preview;
  const resolved = resolveMatchPreviewWinConditions({
    candidates: buildMatchPreviewWinConditionCandidates(facts),
    teamACandidateId: null,
    teamBCandidateId: null,
    teamAText: null,
    teamBText: null,
  });
  return {
    ...preview,
    teamAWinCondition: resolved.teamA,
    teamBWinCondition: resolved.teamB,
  };
}

function responseOutputText(json: OpenAiResponseJson) {
  const messages = (json.output ?? []).filter((item) => item.type === "message");
  const message = messages[messages.length - 1];
  return message?.content?.find((item) => item.type === "output_text");
}

async function createOpenAiResponse(body: Record<string, unknown>, model: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(MATCH_PREVIEW_STEP_TIMEOUT_MS),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI 호출 실패 (${response.status}): ${detail.slice(0, 320)}`);
  }
  const json = await response.json() as OpenAiResponseJson;
  if (json.status === "incomplete") {
    throw new MeasuredOpenAiStepError(
      `OpenAI 응답이 잘렸습니다: ${JSON.stringify(json.incomplete_details)}`,
      json.id ?? null,
      measureOpenAiResponseUsage(json, model),
    );
  }
  return json;
}

function dataWinProbability(facts: MatchPreviewFacts) {
  const { teamA, teamB } = facts;
  if (!teamA.recentSeries.length && !teamB.recentSeries.length) return null;
  return normalizedWinProbability(100 / (1 + 10 ** ((teamB.rating - teamA.rating) / 400)));
}

function normalizeWriterPreview(value: unknown, facts: MatchPreviewFacts): NormalizedWriterPreview {
  if (!value || typeof value !== "object") throw new Error("AI 프리뷰 응답이 올바르지 않습니다.");
  const row = value as { oneLiner?: unknown; watchPoints?: unknown };
  const oneLiner = normalizedText(row.oneLiner, 160);
  const watchPoints = normalizedWatchPoints(row.watchPoints);
  if ([row.oneLiner, ...(Array.isArray(row.watchPoints) ? row.watchPoints : [])]
    .some((text) => typeof text === "string" && /\u00b7/u.test(text))) {
    throw new Error("AI 프리뷰에 금지된 가운데점 기호가 포함되어 있습니다.");
  }
  if (!oneLiner) throw new Error("AI 프리뷰의 두줄평이 없습니다.");
  if (!Array.isArray(row.watchPoints) || row.watchPoints.length !== 3 || new Set(watchPoints).size !== 3) {
    throw new Error("AI 프리뷰의 관전 포인트는 서로 다른 내용으로 정확히 3개가 필요합니다.");
  }
  // 저장 스키마와 이전 소비자는 유지하고, 별도 문구는 생성하지 않는다.
  return {
    ...fallbackPreview(facts),
    oneLiner,
    watchPoints,
    summary: oneLiner,
    liveCheck: watchPoints[0],
    watchPoint: watchPoints[0],
    winProbabilityA: dataWinProbability(facts),
  };
}

async function writeMatchPreview(plan: PreviewGenerationPlan): Promise<WriterResult> {
  const { context, facts, writerModel: model } = plan;
  const json = await createOpenAiResponse({
    model,
    reasoning: { effort: "low" },
    max_output_tokens: MATCH_PREVIEW_WRITER_MAX_OUTPUT_TOKENS,
    prompt_cache_key: `match-preview-writer-v${MATCH_PREVIEW_PROMPT_VERSION}`,
    input: [
      {
        role: "system",
        content: [
          "역할: 제공된 경기 데이터만으로 한국어 LoL e스포츠 프리뷰를 쓰는 에디터다.",
          "출력은 oneLiner(두줄평)와 watchPoints(관전 포인트 3개)뿐이다. 제목, 별도 요약, 서사, 평가, 승리 조건, 승률, 출처를 추가하지 않는다.",
          "핵심부터 짧게 쓴다. 도입문, 상투적 해설, 중복 요약과 반복 결론은 생략한다.",
          "oneLiner는 전체 60~100자 안팎의 짧은 두 문장으로 쓰고, 문장 사이에 줄바꿈 하나를 넣는다. 첫 문장은 팀명 또는 선수명과 핵심 대결 구도, 둘째 문장은 반격 경로나 승부 변수를 담는다.",
          "watchPoints는 서로 다른 관전 포인트 정확히 3개다. 항목마다 50~100자 안팎의 1~2문장으로, 어느 팀이나 선수의 어떤 상황과 행동을 볼지, 상대와의 승부에 왜 중요한지 설명한다.",
          "관전 포인트에 TOP: 같은 별도 제목이나 포지션 라벨을 붙이지 않는다. 가운데점 기호는 사용하지 않고 자연스러운 한국어 문장으로 쓴다.",
          "관전 포인트는 라인 주도권, 오브젝트 운영, 교전이나 접전 대응 등 서로 다른 축을 사용하고, 데이터에 있는 핵심 수치를 근거로 연결한다. 통계 나열이나 두줄평 반복은 피한다.",
          "한 번 작성한 문구는 경기 전까지 유지된다. '오늘', '현재', '직전 경기' 같은 상대적 시점 표현을 피하고, 수치의 표본과 기준을 분명하게 쓴다.",
          "제공된 사실만 사용한다. 이적, 부상, 인터뷰, 감정, 탈락 조건, 밴픽 성향처럼 데이터에 없는 내용을 만들지 않는다. 선수 수치는 games가 1 이상인 경우에만 사용한다.",
          "근거 없는 과장, 확정적 승패, 비하 표현, '치열한 승부' 같은 상투어는 피한다. 지정된 JSON 스키마만 출력한다.",
        ].join("\n"),
      },
      { role: "user", content: JSON.stringify({ match: context, internalFacts: facts }) },
    ],
    text: {
      verbosity: "low",
      format: { type: "json_schema", name: "match_preview", strict: true, schema: WRITER_SCHEMA },
    },
  }, model);
  const usage = measureOpenAiResponseUsage(json, model);
  try {
    const outputText = responseOutputText(json);
    if (!outputText?.text) throw new Error("OpenAI 프리뷰 응답 본문이 없습니다.");
    return { preview: normalizeWriterPreview(JSON.parse(outputText.text), facts), responseId: json.id ?? null, usage };
  } catch (error) {
    throw new MeasuredOpenAiStepError(error instanceof Error ? error.message : String(error), json.id ?? null, usage);
  }
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
  const premium = isPremiumMatchPreview({ match, tournament, stage });
  const writerModel = process.env.OPENAI_MATCH_PREVIEW_MODEL ??
    (premium
      ? process.env.OPENAI_MATCH_PREVIEW_PREMIUM_MODEL ?? DEFAULT_PREMIUM_MODEL
      : process.env.OPENAI_MATCH_PREVIEW_STANDARD_MODEL ?? DEFAULT_STANDARD_MODEL);
  const context = previewContext(match, tournament, stage);
  // 데이터나 프롬프트가 바뀌어도 자동 재시도 횟수를 초기화하지 않는다.
  const inputHash = createHash("sha256")
    .update(JSON.stringify({ matchId: match.id, teamAId: match.teamAId, teamBId: match.teamBId }))
    .digest("hex");
  return {
    context,
    facts,
    inputHash,
    writerModel,
    phase,
  };
}

async function generateAndStoreMatchAiPreview(
  inputs: MatchAiPreviewInputs,
  plan: PreviewGenerationPlan,
  { force = false }: RefreshMatchAiPreviewOptions = {},
): Promise<GenerateAndStoreResult> {
  const admin = createSupabaseAdminClient();
  const lockToken = randomUUID();
  const { data: claimed, error: claimError } = await admin.rpc(
    "claim_match_ai_preview_generation",
    {
      p_match_id: inputs.match.id,
      p_lock_token: lockToken,
      p_input_hash: plan.inputHash,
      p_generation_phase: plan.phase,
    },
  );
  if (claimError) throw new Error(`AI 프리뷰 생성 lease 획득 실패: ${claimError.message}`);

  if (claimed !== true) {
    const { data: current, error: currentError } = await admin
      .from("match_ai_previews")
      .select("input_hash,summary,watch_point,evidence,content,generated_at,generation_phase")
      .eq("match_id", inputs.match.id)
      .maybeSingle();
    if (currentError) throw new Error(currentError.message);
    return {
      preview: current
        ? previewFromCacheRow(current as MatchAiPreviewCacheRow)
        : fallbackPreview(plan.facts),
      estimatedCostUsd: 0,
      stored: false,
    };
  }

  let runId: string | null = null;
  let writerResponseId: string | null = null;
  let usageComplete = true;
  const measuredUsage: MeasuredOpenAiUsage[] = [];

  const usageFields = () => {
    const usage = combineOpenAiUsage(measuredUsage);
    return {
      usage,
      fields: {
        response_id: writerResponseId,
        research_response_id: null,
        input_tokens: usage.inputTokens,
        cached_input_tokens: usage.cachedInputTokens,
        output_tokens: usage.outputTokens,
        reasoning_tokens: usage.reasoningTokens,
        total_tokens: usage.totalTokens,
        web_search_calls: usage.webSearchCalls,
        estimated_cost_usd: usage.estimatedCostUsd,
        pricing_snapshot: usage.pricingSnapshot,
        usage_complete: usageComplete,
      },
    };
  };

  try {
    const existing = await getStoredMatchAiPreview(inputs.match.id);
    if (existing && !force) {
      return { preview: previewFromCacheRow(existing), estimatedCostUsd: 0, stored: false };
    }
    const staleRunCutoff = new Date(Date.now() - MATCH_PREVIEW_LEASE_MS).toISOString();
    const { error: staleRunError } = await admin
      .from("match_ai_preview_runs")
      .update({
        status: "failed",
        error_message: "Generation lease expired before completion.",
        completed_at: new Date().toISOString(),
      })
      .eq("match_id", inputs.match.id)
      .eq("status", "running")
      .lt("started_at", staleRunCutoff);
    if (staleRunError) throw new Error(`중단된 AI 프리뷰 실행 정리 실패: ${staleRunError.message}`);

    const { data: run, error: runError } = await admin
      .from("match_ai_preview_runs")
      .insert({
        match_id: inputs.match.id,
        input_hash: plan.inputHash,
        generation_phase: plan.phase,
        status: "running",
        model: plan.writerModel,
        // 원장 컬럼은 NOT NULL이다. 검색 미사용을 명시하고 호출 비용은 0으로 기록한다.
        research_model: "none",
      })
      .select("id")
      .single();
    if (runError || !run) {
      throw new Error(`AI 프리뷰 비용 원장 생성 실패: ${runError?.message ?? "row missing"}`);
    }
    runId = run.id as string;

    let writer: WriterResult;
    try {
      writer = await writeMatchPreview(plan);
      writerResponseId = writer.responseId;
      measuredUsage.push(writer.usage);
    } catch (error) {
      if (error instanceof MeasuredOpenAiStepError) {
        writerResponseId = error.responseId;
        measuredUsage.push(error.usage);
      } else {
        usageComplete = false;
      }
      throw error;
    }

    const generatedAt = new Date().toISOString();
    const preview: MatchAiPreview = {
      ...writer.preview,
      generatedAt,
      generationPhase: plan.phase,
      source: "ai",
    };
    const { usage, fields } = usageFields();
    const { error: usageError } = await admin
      .from("match_ai_preview_runs")
      .update(fields)
      .eq("id", runId);
    if (usageError) throw new Error(`AI 프리뷰 비용 기록 실패: ${usageError.message}`);

    const { data: latest, error: latestError } = await admin
      .from("match_ai_previews")
      .select("input_hash,summary,watch_point,evidence,content,generated_at,generation_phase")
      .eq("match_id", inputs.match.id)
      .maybeSingle();
    if (latestError) throw new Error(latestError.message);
    if (latest && !force) {
      const { error: supersededError } = await admin
        .from("match_ai_preview_runs")
        .update({ status: "superseded", completed_at: generatedAt })
        .eq("id", runId);
      if (supersededError) throw new Error(supersededError.message);
      return {
        preview: previewFromCacheRow(latest as MatchAiPreviewCacheRow),
        estimatedCostUsd: usage.estimatedCostUsd,
        stored: false,
      };
    }

    const { data: storedRow, error: storeError } = await admin
      .from("match_ai_previews")
      .upsert({
        match_id: inputs.match.id,
        input_hash: plan.inputHash,
        model: plan.writerModel,
        research_model: null,
        generation_phase: plan.phase,
        generation_lock_token: lockToken,
        response_id: writer.responseId,
        research_response_id: null,
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
          briefingData: createMatchBriefingSnapshot(inputs.match, inputs.briefingRows ?? [],
            await getPowerRankings(new Date(inputs.match.matchDate).getUTCFullYear())),
          oneLiner: preview.oneLiner,
          watchPoints: preview.watchPoints,
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
      })
      .select("input_hash,summary,watch_point,evidence,content,generated_at,generation_phase,generation_lock_token")
      .maybeSingle();
    if (storeError) {
      throw new Error(`AI 프리뷰 캐시 저장 실패: ${storeError.message}`);
    }

    const writeAccepted = storedRow?.generation_lock_token === lockToken;
    const superseded = !writeAccepted;
    const status = superseded ? "superseded" : "success";
    const { error: completeError } = await admin
      .from("match_ai_preview_runs")
      .update({
        status,
        error_message: null,
        completed_at: generatedAt,
      })
      .eq("id", runId);
    if (completeError) throw new Error(`AI 프리뷰 비용 원장 완료 처리 실패: ${completeError.message}`);
    return {
      preview: superseded
        ? storedRow
          ? previewFromCacheRow(storedRow as MatchAiPreviewCacheRow)
          : latest
            ? previewFromCacheRow(latest as MatchAiPreviewCacheRow)
            : fallbackPreview(plan.facts)
        : preview,
      estimatedCostUsd: usage.estimatedCostUsd,
      stored: !superseded,
    };
  } catch (error) {
    if (runId) {
      const { fields } = usageFields();
      const { error: failureError } = await admin
        .from("match_ai_preview_runs")
        .update({
          ...fields,
          status: "failed",
          error_message: (error instanceof Error ? error.message : String(error)).slice(0, 1_000),
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
      if (failureError) {
        console.error(`[match-ai-preview] failed to close run ${runId}`, failureError);
      }
    }
    throw error;
  } finally {
    const { error: releaseError } = await admin
      .from("match_ai_preview_generation_locks")
      .delete()
      .eq("match_id", inputs.match.id)
      .eq("lock_token", lockToken);
    if (releaseError) {
      console.error(`[match-ai-preview] failed to release lease for ${inputs.match.id}`, releaseError);
    }
  }
}

export async function getMatchAiPreview({
  match,
  teams,
  matches,
  sets,
  tournaments,
  players,
  playerStats,
}: MatchAiPreviewInputs, storedPreview?: MatchAiPreviewCacheRow | null): Promise<MatchAiPreview> {
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
  if (!hasResolvedParticipants(match, teams)) return fallback;
  try {
    // null은 조회 결과가 없다는 뜻이므로 다시 조회하지 않는다.
    const data = storedPreview === undefined ? await getStoredMatchAiPreview(match.id) : storedPreview;
    if (data) {
      return {
        ...upgradedCachedWinConditions(previewFromCacheRow(data), facts, data.content),
        winProbabilityA: dataWinProbability(facts),
      };
    }
  } catch (error) {
    console.warn("[match-ai-preview] cache lookup failed", error);
  }
  return fallback;
}

export async function refreshMatchAiPreviewCache(
  inputs: MatchAiPreviewInputs,
  phase: MatchPreviewGenerationPhase = "story",
): Promise<MatchAiPreview> {
  const cached = await getStoredMatchAiPreview(inputs.match.id);
  if (cached) return previewFromCacheRow(cached);
  inputs = { ...inputs, ...await supplementMatchBriefingData(inputs.match, inputs.teams, inputs.players ?? [], {
    matches: inputs.matches, sets: inputs.sets, playerStats: inputs.playerStats ?? [],
  }) };
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
  const { data: cached, error: cacheError } = await admin
    .from("match_ai_previews")
    .select("input_hash,summary,watch_point,evidence,content,generated_at,generation_phase")
    .eq("match_id", match.id)
    .maybeSingle();
  if (cacheError) throw new Error(cacheError.message);
  // 팀 조회가 일시적으로 실패하면 getAllTeams()가 빈 배열로 복구될 수 있다.
  // 이 상태를 실제 TBD 대진으로 오인해 이미 생성된 프리뷰를 지우지 않는다.
  if (!hasResolvedParticipants(match, teams)) {
    return cached ? previewFromCacheRow(cached as MatchAiPreviewCacheRow) : null;
  }

  const phase = options.force && cached?.generation_phase === "final"
    ? "final" : matchPreviewGenerationPhase(match.matchDate, Date.now()) ? "story" : null;
  // 경기 시작 후에는 새 프리뷰를 만들지 않되, 시작 전에 생성한 브리핑은
  // 실시간 세트 동기화가 실행되어도 보존해 경기 중·종료 후에도 보여준다.
  if (!isUpcomingMatch(match)) {
    return cached ? previewFromCacheRow(cached as MatchAiPreviewCacheRow) : null;
  }
  if (!phase) return cached ? previewFromCacheRow(cached as MatchAiPreviewCacheRow) : null;

  // 저장된 문구는 통계, 생성 단계, 프롬프트가 바뀌어도 재생성하지 않는다.
  if (cached && !options.force) return previewFromCacheRow(cached as MatchAiPreviewCacheRow);

  const [matches, sets, tournaments, players, playerStats, stages] = await Promise.all([
    getMatches(),
    getSets(),
    getTournaments(),
    getAllPlayers(),
    getPlayerStatLines(),
    getStages(),
  ]);
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
  };
  Object.assign(inputs, await supplementMatchBriefingData(match, teams, players, { matches, sets, playerStats }));
  const plan = previewGenerationPlan(inputs, phase);
  if (!options.force) {
    const { data: recentRuns, error: runsError } = await admin
      .from("match_ai_preview_runs")
      .select("match_id,input_hash,generation_phase,status,started_at,completed_at")
      .eq("match_id", match.id)
      .eq("input_hash", plan.inputHash)
      .eq("generation_phase", phase)
      .order("started_at", { ascending: false })
      .limit(3);
    if (runsError) throw new Error(runsError.message);
    const failureState = generationFailureState(
      (recentRuns ?? []) as MatchAiPreviewRunRetryRow[],
    );
    if (failureState.hasActiveRun || !matchPreviewFailureRetryAllowed(failureState)) {
      return cached
        ? previewFromCacheRow(cached as MatchAiPreviewCacheRow)
        : fallbackPreview(plan.facts);
    }
  }
  return (await generateAndStoreMatchAiPreview(inputs, plan, options)).preview;
}

/**
 * 참가 팀이 확정된 예정 경기는 최초 한 번만 생성한다.
 * 저장된 문구는 유지하고 그래프용 스냅샷만 최신 수집 자료로 갱신한다.
 * 미생성 경기의 실패만 30분 뒤 한 번 재시도한다.
 */
export async function refreshMissingUpcomingMatchAiPreviews(
  options: RefreshMissingMatchAiPreviewsOptions = {},
): Promise<RefreshMissingMatchAiPreviewsSummary> {
  const [teams, matches, sets, tournaments, players, playerStats, stages] = await Promise.all([
    getAllTeams(),
    getMatches(),
    getSets(),
    getTournaments(),
    getAllPlayers(),
    getPlayerStatLines(),
    getStages(),
  ]);
  const now = Date.now();
  const eligible = matches
    .flatMap((match) => {
      const phase = matchPreviewGenerationPhase(match.matchDate, now) ? "story" as const : null;
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
      deferred: 0,
      generated: 0,
      estimatedCostUsd: 0,
      generatedByPhase: { story: 0, final: 0 },
      failed: [],
    };
  }

  const admin = createSupabaseAdminClient();
  const { data: cachedRows, error: cacheError } = await admin
    .from("match_ai_previews")
    .select("match_id,input_hash,generation_phase,content,generated_at")
    .in("match_id", eligible.map(({ match }) => match.id));
  if (cacheError) throw new Error(cacheError.message);
  const cachedByMatchId = new Map((cachedRows ?? []).map((row) => [row.match_id as string, row]));
  const storedSources = await getTeamBriefingSourceRows([...new Set(eligible.flatMap(({ match }) => [match.teamAId, match.teamBId]))]);
  const rankingsByYear = new Map<number, ReturnType<typeof getPowerRankings>>();
  for (const { match } of eligible) {
    if (!cachedByMatchId.has(match.id)) continue;
    const year = new Date(match.matchDate).getUTCFullYear();
    if (!rankingsByYear.has(year)) rankingsByYear.set(year, getPowerRankings(year));
    const rankings = await rankingsByYear.get(year)!;
    const cached = cachedByMatchId.get(match.id)!;
    const prior = (cached.content as { briefingData?: { rows?: LeaguepediaBriefingRows[]; powerRankings?: typeof rankings } } | null)?.briefingData;
    await backfillMatchBriefingSnapshot(createMatchBriefingSnapshot(match,
      prior?.rows ?? [match.teamAId, match.teamBId].flatMap((id) => storedSources.get(id) ? [storedSources.get(id)!] : []),
      rankings.status === "ready" ? rankings : prior?.powerRankings ?? rankings), { replaceExisting: true });
  }
  const planned = await Promise.all(eligible.filter(({ match }) => !cachedByMatchId.has(match.id)).map(async ({ match, phase }) => {
    const inputs: MatchAiPreviewInputs = {
      match, tournament: tournaments.find((item) => item.id === match.tournamentId),
      stage: stages.find((item) => item.id === match.stageId), teams, matches, sets, tournaments, players, playerStats,
    };
    Object.assign(inputs, await supplementMatchBriefingData(match, teams, players, { matches, sets, playerStats }));
    return { inputs, plan: previewGenerationPlan(inputs, phase) };
  }));
  const { data: recentRunRows, error: runRowsError } = await admin
    .from("match_ai_preview_runs")
    .select("match_id,input_hash,generation_phase,status,started_at,completed_at")
    .in("match_id", eligible.map(({ match }) => match.id))
    .order("started_at", { ascending: false });
  if (runRowsError) throw new Error(runRowsError.message);
  const runsByGeneration = new Map<string, MatchAiPreviewRunRetryRow[]>();
  for (const row of (recentRunRows ?? []) as MatchAiPreviewRunRetryRow[]) {
    const key = generationRunKey(row.match_id, row.input_hash, row.generation_phase);
    const group = runsByGeneration.get(key) ?? [];
    group.push(row);
    runsByGeneration.set(key, group);
  }
  const allMissing = planned;
  const allCandidates = allMissing;
  const allPending = allCandidates.filter(({ inputs, plan }) => {
    const key = generationRunKey(inputs.match.id, plan.inputHash, plan.phase);
    const failureState = generationFailureState(runsByGeneration.get(key) ?? [], now);
    return !failureState.hasActiveRun && matchPreviewFailureRetryAllowed({
      failureCount: failureState.failureCount,
      lastFailureAt: failureState.lastFailureAt,
      nowMs: now,
    });
  }).sort(
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
    stale: 0,
    deferred: allCandidates.length - allPending.length,
    generated,
    estimatedCostUsd,
    generatedByPhase,
    failed,
  };
}
