import "server-only";

import { createHash, randomUUID } from "node:crypto";

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
import { bindUrlCitationsToClaims } from "@/lib/match-preview-citations";
import {
  isPremiumMatchPreview,
  matchPreviewFailureRetryAllowed,
  matchPreviewGenerationPhase,
  matchPreviewNeedsRefresh,
  matchPreviewResearchRetryDue,
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
import {
  buildMatchPreviewWinConditionCandidates,
  resolveMatchPreviewWinConditions,
} from "@/lib/match-preview-win-conditions";
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
    "teamAWinConditionCandidateId",
    "teamBWinCondition",
    "teamBWinConditionCandidateId",
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
    teamAWinConditionCandidateId: { type: "string" },
    teamBWinCondition: { type: "string" },
    teamBWinConditionCandidateId: { type: "string" },
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

const MATCH_PREVIEW_PROMPT_VERSION = 13;
const MATCH_PREVIEW_CONTENT_VERSION = 3;
const DEFAULT_RESEARCH_MODEL = "gpt-5.4-mini";
const DEFAULT_STANDARD_MODEL = "gpt-5.4-mini";
const DEFAULT_PREMIUM_MODEL = "gpt-5.6-sol";
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
  generation_lock_token?: string | null;
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

function isBlockedResearchSource(url: string) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const blockedHost = [
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
    const blockedForumPath = hostname.endsWith("inven.co.kr") && parsed.pathname.startsWith("/board/");
    return blockedHost || blockedForumPath;
  } catch {
    return true;
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

function citedSourcesByClaim(
  outputText: string,
  annotations: WebSearchSource[],
  searchedSources: WebSearchSource[],
) {
  const searchedByUrl = new Map(
    normalizedSources(searchedSources).map((source) => [canonicalSourceUrl(source.url), source]),
  );
  return bindUrlCitationsToClaims(outputText, annotations).map((claimAnnotations) =>
    normalizedSources(
      claimAnnotations.flatMap((annotation) => {
        if (!annotation.url) return [];
        const searched = searchedByUrl.get(canonicalSourceUrl(annotation.url));
        return [{
          title: searched?.title ?? annotation.title,
          url: annotation.url,
          publisher: searched?.publisher,
          publishedAt: searched?.publishedAt,
        }];
      }),
    ),
  );
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

function parseStoredResearchState(value: unknown) {
  if (!value || typeof value !== "object") {
    return { researchFailed: false, researchFailureCount: 0 };
  }
  const content = value as { researchFailed?: unknown; researchFailureCount?: unknown };
  return {
    researchFailed: content.researchFailed === true,
    researchFailureCount: typeof content.researchFailureCount === "number" &&
        Number.isFinite(content.researchFailureCount)
      ? Math.max(0, Math.trunc(content.researchFailureCount))
      : content.researchFailed === true ? 1 : 0,
  };
}

function isResearchRetryDue(row: { content?: unknown; generated_at?: string }) {
  const state = parseStoredResearchState(row.content);
  return matchPreviewResearchRetryDue({
    ...state,
    generatedAt: row.generated_at ?? null,
  });
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

function normalizeResearchClaims(
  value: unknown,
  sourcesByClaim: MatchAiPreviewSource[][],
  searchedSources: WebSearchSource[],
): ResearchClaim[] {
  if (!value || typeof value !== "object") return [];
  const rows = (value as { claims?: unknown }).claims;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap<ResearchClaim>((item, claimIndex) => {
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
    // Structured JSON responses do not always carry output_text annotations.
    // A URL explicitly declared inside this claim is still acceptable when it
    // exactly matches the Responses API's web-search source inventory.
    const actualByUrl = new Map(
      normalizedSources([
        ...searchedSources,
        ...(sourcesByClaim[claimIndex] ?? []),
      ])
        .filter((source) => !isBlockedResearchSource(source.url))
        .map((source) => [canonicalSourceUrl(source.url), source]),
    );
    const sources = selectedUrls.flatMap((url) => {
      const source = actualByUrl.get(url);
      return source ? [{ ...source, publishedAt: publishedAt ?? source.publishedAt }] : [];
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
          "각 claim의 sourceUrls에는 실제 검색에서 확인한 원문 URL만 넣고, 그 claim 객체 안의 claim 또는 URL에 해당 원문을 직접 인용한다. 출력은 지정된 JSON 스키마만 따른다.",
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
  }, model);
  const usage = measureOpenAiResponseUsage(json, model);
  try {
    const outputText = responseOutputText(json);
    if (!outputText?.text) throw new Error("OpenAI 리서치 응답 본문이 없습니다.");
    const parsed = JSON.parse(outputText.text) as { claims?: unknown };
    const searchedSources = (json.output ?? []).flatMap((item) => item.action?.sources ?? []);
    const sourcesByClaim = citedSourcesByClaim(
      outputText.text,
      outputText.annotations ?? [],
      searchedSources,
    );
    const claims = normalizeResearchClaims(parsed, sourcesByClaim, searchedSources);
    if (Array.isArray(parsed.claims) && parsed.claims.length > 0 && claims.length === 0) {
      throw new Error("검색 주장의 인용 위치와 원문 URL을 검증하지 못했습니다.");
    }
    return {
      claims,
      responseId: json.id ?? null,
      usage,
    };
  } catch (error) {
    throw new MeasuredOpenAiStepError(
      error instanceof Error ? error.message : String(error),
      json.id ?? null,
      usage,
    );
  }
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

function isRecentAttributedClaim(claim: ResearchClaim | undefined, nowMs = Date.now()) {
  if (!claim || (claim.kind !== "assessment" && claim.kind !== "statement")) return false;
  if (!claim.attribution || !claim.publishedAt) return false;
  const publishedAt = new Date(claim.publishedAt).getTime();
  const age = nowMs - publishedAt;
  return Number.isFinite(publishedAt) && age >= 0 && age <= 14 * 86_400_000;
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
  facts,
}: {
  value: unknown;
  claims: ResearchClaim[];
  evidenceCatalog: InternalEvidence[];
  facts: MatchPreviewFacts;
}): NormalizedWriterPreview {
  if (!value || typeof value !== "object") throw new Error("AI 프리뷰 응답이 객체가 아닙니다.");
  const row = value as Record<string, unknown>;
  const headline = normalizedText(row.headline, 80);
  const summary = normalizedText(row.summary, 420);
  const liveCheck = normalizedText(row.liveCheck, 180);
  if (!headline || !summary || !liveCheck) throw new Error("AI 프리뷰의 필수 문장이 없습니다.");

  const evidenceById = new Map(evidenceCatalog.map((item) => [item.id, item.text]));
  const winConditionCandidates = buildMatchPreviewWinConditionCandidates(facts);
  const winConditions = resolveMatchPreviewWinConditions({
    candidates: winConditionCandidates,
    teamACandidateId: row.teamAWinConditionCandidateId,
    teamBCandidateId: row.teamBWinConditionCandidateId,
    teamAText: normalizedText(row.teamAWinCondition, 220) || null,
    teamBText: normalizedText(row.teamBWinCondition, 220) || null,
  });
  const writerEvidenceIds = Array.isArray(row.evidenceIds)
    ? [...new Set(row.evidenceIds.flatMap((item) =>
        typeof item === "string" && evidenceById.has(item) ? [item] : [],
      ))]
    : [];
  const evidenceIds = [...new Set([
    ...winConditions.evidenceIds,
    ...writerEvidenceIds,
  ])].filter((id) => evidenceById.has(id)).slice(0, 6);
  const fallbackEvidenceIds = evidenceCatalog.slice(0, 2).map((item) => item.id);
  const evidence = (evidenceIds.length > 0 ? evidenceIds : fallbackEvidenceIds)
    .flatMap((id) => evidenceById.get(id) ?? []);

  const narrativeIndexes = claimIndexes(row.narrativeClaimIndexes, claims);
  const narrativeSources = sourcesForClaims(claims, narrativeIndexes);
  const narrativeTitle = normalizedText(row.narrativeTitle, 80);
  const narrativeBody = normalizedText(row.narrativeBody, 420);
  const narrativeConsensusLanguage = /세간|대체로|중론|공통된 평가|전반적인 평가/.test(narrativeBody);
  const narrativeConsensusSupported =
    !narrativeConsensusLanguage || sourceDomainCount(narrativeSources) >= 2;
  const narrative =
    narrativeTitle && narrativeBody && narrativeSources.length > 0 && narrativeConsensusSupported
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
  const hasOnlyRecentAttributedAssessments =
    recentViewIndexes.length > 0 &&
    recentViewIndexes.every((index) => isRecentAttributedClaim(claims[index]));
  const recentViewTitle = normalizedText(row.recentViewTitle, 80);
  const recentViewBody = normalizedText(row.recentViewBody, 360);
  const mentionsAttribution = recentViewIndexes.some((index) => {
    const attribution = claims[index]?.attribution?.toLowerCase();
    return attribution ? recentViewBody.toLowerCase().includes(attribution) : false;
  });
  const consensusLanguage = /세간|대체로|중론|공통된 평가|전반적인 평가/.test(recentViewBody);
  const consensusSupported = !consensusLanguage || sourceDomainCount(recentViewSources) >= 2;
  const recentDates = recentViewSources
    .flatMap((source) => source.publishedAt ?? [])
    .sort((left, right) => right.localeCompare(left));
  const recentView =
    recentViewTitle && recentViewBody && recentViewSources.length > 0 &&
    hasOnlyRecentAttributedAssessments && mentionsAttribution && consensusSupported
      ? {
          title: recentViewTitle,
          body: recentViewBody,
          asOf: recentDates[0] ?? null,
          sources: recentViewSources,
        }
      : null;

  const meaningIndexes = claimIndexes(row.meaningClaimIndexes, claims);
  const meaningSources = sourcesForClaims(claims, meaningIndexes);
  const matchMeaning = meaningSources.length > 0
    ? normalizedText(row.matchMeaning, 240) || null
    : null;
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
    matchMeaning,
    recentView,
    teamAWinCondition: winConditions.teamA,
    teamBWinCondition: winConditions.teamB,
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
  const winConditionCandidates = buildMatchPreviewWinConditionCandidates(facts);
  const json = await createOpenAiResponse({
    model,
    reasoning: { effort: "medium" },
    max_output_tokens: 4_200,
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
          "teamAWinCondition/teamBWinCondition은 각각 1문장이다. winConditionCandidates에서 팀별로 후보 하나를 골라 그 id를 각 CandidateId에 그대로 넣고, 해당 후보의 근거 범위 안에서 구체화한다.",
          "두 팀의 CandidateId는 axis가 반드시 달라야 한다. 같은 경기에서 양 팀을 모두 DPM·화력으로 설명하거나 같은 오브젝트 문장을 대칭 복제하지 않는다.",
          "후보 우선순위는 팀 운영(economy/objectives), 라인 주도권(laning), 교전 화력(damage), 접전 대응(resilience) 순이다. damage는 다른 축이 더 뚜렷하지 않을 때 한 팀에만 사용한다.",
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
          winConditionCandidates,
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
  }, model);
  const usage = measureOpenAiResponseUsage(json, model);
  try {
    const outputText = responseOutputText(json);
    if (!outputText?.text) throw new Error("OpenAI 프리뷰 응답 본문이 없습니다.");
    return {
      preview: normalizeWriterPreview({
        value: JSON.parse(outputText.text),
        claims,
        evidenceCatalog,
        facts,
      }),
      responseId: json.id ?? null,
      usage,
    };
  } catch (error) {
    throw new MeasuredOpenAiStepError(
      error instanceof Error ? error.message : String(error),
      json.id ?? null,
      usage,
    );
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
  let research: ResearchResult | null = null;
  let researchResponseId: string | null = null;
  let writerResponseId: string | null = null;
  let researchErrorMessage: string | null = null;
  let usageComplete = true;
  const measuredUsage: MeasuredOpenAiUsage[] = [];

  const usageFields = () => {
    const usage = combineOpenAiUsage(measuredUsage);
    return {
      usage,
      fields: {
        response_id: writerResponseId,
        research_response_id: researchResponseId,
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
        research_model: plan.researchModel,
      })
      .select("id")
      .single();
    if (runError || !run) {
      throw new Error(`AI 프리뷰 비용 원장 생성 실패: ${runError?.message ?? "row missing"}`);
    }
    runId = run.id as string;

    try {
      research = await researchMatch({
        context: plan.context,
        storyContext: plan.storyContext,
        phase: plan.phase,
        model: plan.researchModel,
      });
      researchResponseId = research.responseId;
      measuredUsage.push(research.usage);
    } catch (error) {
      researchErrorMessage = error instanceof Error ? error.message : String(error);
      if (error instanceof MeasuredOpenAiStepError) {
        researchResponseId = error.responseId;
        measuredUsage.push(error.usage);
      } else {
        usageComplete = false;
      }
      console.warn(`[match-ai-preview] research failed for ${inputs.match.id}`, error);
    }

    const claims = research?.claims ?? [];
    let writer: WriterResult;
    try {
      writer = await writeMatchPreview({
        context: plan.context,
        facts: plan.facts,
        storyContext: plan.storyContext,
        evidenceCatalog: plan.evidenceCatalog,
        claims,
        phase: plan.phase,
        model: plan.writerModel,
      });
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
    if (latest && phaseRank(latest.generation_phase as string) > phaseRank(plan.phase)) {
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

    const priorResearch = latest &&
        latest.input_hash === plan.inputHash && latest.generation_phase === plan.phase
      ? parseStoredResearchState(latest.content)
      : { researchFailed: false, researchFailureCount: 0 };
    const researchFailureCount = research
      ? 0
      : priorResearch.researchFailureCount + 1;
    const { data: storedRow, error: storeError } = await admin
      .from("match_ai_previews")
      .upsert({
        match_id: inputs.match.id,
        input_hash: plan.inputHash,
        model: plan.writerModel,
        research_model: plan.researchModel,
        generation_phase: plan.phase,
        generation_lock_token: lockToken,
        response_id: writer.responseId,
        research_response_id: researchResponseId,
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
          researchFailureCount,
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
    const status = superseded ? "superseded" : research ? "success" : "research_failed";
    const { error: completeError } = await admin
      .from("match_ai_preview_runs")
      .update({
        status,
        error_message: researchErrorMessage?.slice(0, 1_000) ?? null,
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
  if (!hasResolvedParticipants(match, teams)) return fallback;
  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("match_ai_previews")
      .select("summary,watch_point,evidence,content,generated_at,generation_phase")
      .eq("match_id", match.id)
      .maybeSingle();
    if (!error && data) {
      return upgradedCachedWinConditions(
        previewFromCacheRow(data as MatchAiPreviewCacheRow),
        facts,
        data.content,
      );
    }
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

  const phase = matchPreviewGenerationPhase(match.matchDate, Date.now(), options.force === true);
  // 경기 시작 후에는 새 프리뷰를 만들지 않되, 시작 전에 생성한 브리핑은
  // 실시간 세트 동기화가 실행되어도 보존해 경기 중·종료 후에도 보여준다.
  if (!isUpcomingMatch(match)) {
    return cached ? previewFromCacheRow(cached as MatchAiPreviewCacheRow) : null;
  }
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
  const needsGeneration = !cached || matchPreviewNeedsRefresh({
      cachedHash: cached.input_hash as string | null,
      expectedHash: plan.inputHash,
      cachedPhase: cached.generation_phase as string | null,
      expectedPhase: phase,
    }) || isResearchRetryDue(cached);
  if (!options.force && !needsGeneration) {
    return previewFromCacheRow(cached as MatchAiPreviewCacheRow);
  }
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
  return (await generateAndStoreMatchAiPreview(inputs, plan)).preview;
}

/**
 * 참가 팀이 확정됐고 24시간 안에 시작하는 경기만 자동 생성한다.
 * 각 경기는 story(24시간)와 final(2시간) phase에서 생성된다.
 * 같은 phase는 입력이 바뀌거나 실패 후 30분이 지난 경우에만 한 번 재시도한다.
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
      deferred: 0,
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
    .select("match_id,input_hash,generation_phase,content,generated_at")
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
  const allMissing = planned.filter(({ inputs }) => !cachedByMatchId.has(inputs.match.id));
  const allStale = planned.filter(({ inputs, plan }) => {
    const cached = cachedByMatchId.get(inputs.match.id);
    if (!cached) return false;
    return matchPreviewNeedsRefresh({
      cachedHash: cached.input_hash as string | null,
      expectedHash: plan.inputHash,
      cachedPhase: cached.generation_phase as string | null,
      expectedPhase: plan.phase,
    }) || isResearchRetryDue(cached);
  });
  const allCandidates = [...allMissing, ...allStale];
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
    stale: allStale.length,
    deferred: allCandidates.length - allPending.length,
    generated,
    estimatedCostUsd,
    generatedByPhase,
    failed,
  };
}
