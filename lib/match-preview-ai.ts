import "server-only";

import { createHash } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Match, SetResult, Team, Tournament } from "@/lib/types";
import {
  getAllTeams,
  getMatchById,
  getMatches,
  getSets,
  getTournaments,
} from "@/lib/data/lck";
import {
  buildMatchPreviewFacts,
  type MatchPreviewFacts,
} from "@/lib/match-preview-facts";

const MATCH_PREVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "watchPoint", "winProbabilityA", "evidence", "sourceUrls"],
  properties: {
    summary: { type: "string" },
    watchPoint: { type: "string" },
    winProbabilityA: { type: "integer", minimum: 5, maximum: 95 },
    evidence: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { type: "string" },
    },
    sourceUrls: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string" },
    },
  },
} as const;
const MATCH_PREVIEW_PROMPT_VERSION = 5;
const DEFAULT_MATCH_PREVIEW_MODEL = "gpt-5.5";

export type MatchAiPreviewSource = {
  title: string;
  url: string;
};

export type MatchAiPreview = {
  summary: string;
  watchPoint: string;
  /** teamA 기준 예상 승률(%). 캐시 이전 세대 데이터나 fallback에서는 null. */
  winProbabilityA: number | null;
  evidence: string[];
  sources: MatchAiPreviewSource[];
  source: "ai" | "fallback";
};

type MatchAiPreviewInputs = {
  match: Match;
  tournament?: Tournament;
  teams: Team[];
  matches: Match[];
  sets: SetResult[];
};

type StoredEvidence = {
  facts: string[];
  sources: MatchAiPreviewSource[];
  winProbabilityA: number | null;
};

type WebSearchSource = {
  type?: string;
  title?: string;
  url?: string;
};

type GeneratedPreviewText = {
  summary: string;
  watchPoint: string;
  winProbabilityA: number | null;
  evidence: string[];
  sourceUrls: string[];
};

type MatchAiPreviewCacheRow = {
  summary: string;
  watch_point: string;
  evidence: unknown;
};

type RefreshMatchAiPreviewOptions = {
  force?: boolean;
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
    summary: `${meetingLead} ${scheduleLine}`,
    watchPoint: contrast,
    winProbabilityA: null,
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

function normalizedPreview(value: unknown): GeneratedPreviewText {
  if (!value || typeof value !== "object") throw new Error("AI 프리뷰 응답이 객체가 아닙니다.");
  const row = value as {
    summary?: unknown;
    watchPoint?: unknown;
    winProbabilityA?: unknown;
    evidence?: unknown;
    sourceUrls?: unknown;
  };
  if (typeof row.summary !== "string" || typeof row.watchPoint !== "string") {
    throw new Error("AI 프리뷰의 필수 문장이 없습니다.");
  }
  const evidence = Array.isArray(row.evidence)
    ? row.evidence.filter((item): item is string => typeof item === "string").slice(0, 3)
    : [];
  return {
    summary: row.summary.trim().slice(0, 240),
    watchPoint: row.watchPoint.trim().slice(0, 120),
    winProbabilityA: normalizedWinProbability(row.winProbabilityA),
    evidence,
    sourceUrls: Array.isArray(row.sourceUrls)
      ? row.sourceUrls.filter((item): item is string => typeof item === "string").slice(0, 4)
      : [],
  };
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

function normalizedSources(value: unknown): MatchAiPreviewSource[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const source = item as WebSearchSource;
    const url = source.url?.trim();
    if (!url || seen.has(url)) return [];

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return [];
      seen.add(url);
      return [{
        title: source.title?.trim().slice(0, 100) || parsed.hostname.replace(/^www\./, ""),
        url,
      }];
    } catch {
      return [];
    }
  }).slice(0, 5);
}

function parseStoredEvidence(value: unknown): StoredEvidence {
  if (Array.isArray(value)) {
    return {
      facts: value.filter((item): item is string => typeof item === "string").slice(0, 3),
      sources: [],
      winProbabilityA: null,
    };
  }
  if (!value || typeof value !== "object") return { facts: [], sources: [], winProbabilityA: null };

  const stored = value as { facts?: unknown; sources?: unknown; winProbabilityA?: unknown };
  return {
    facts: Array.isArray(stored.facts)
      ? stored.facts.filter((item): item is string => typeof item === "string").slice(0, 3)
      : [],
    sources: normalizedSources(stored.sources),
    winProbabilityA: normalizedWinProbability(stored.winProbabilityA),
  };
}

function previewContext(match: Match, tournament?: Tournament) {
  return {
    matchName: match.name,
    tournament: tournament?.name ?? null,
    tournamentSeason: tournament?.season ?? null,
    matchStart: match.matchDate,
    bestOf: match.bestOf ?? null,
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

function previewFromCacheRow(data: MatchAiPreviewCacheRow): MatchAiPreview {
  const storedEvidence = parseStoredEvidence(data.evidence);
  return {
    summary: data.summary,
    watchPoint: data.watch_point,
    winProbabilityA: storedEvidence.winProbabilityA,
    evidence: storedEvidence.facts,
    sources: storedEvidence.sources,
    source: "ai",
  };
}

async function callOpenAi({
  facts,
  context,
  model,
}: {
  facts: MatchPreviewFacts;
  context: ReturnType<typeof previewContext>;
  model: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY가 설정되지 않았습니다.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "medium" },
      tools: [{ type: "web_search", search_context_size: "medium" }],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      max_output_tokens: 3_000,
      input: [
        {
          role: "system",
          content: [
            "역할: 리그 오브 레전드 e스포츠의 짧은 경기 프리뷰를 쓰는 한국어 에디터다.",
            "목표: 내부 기록을 그대로 요약하지 말고, 공개된 프리뷰·뉴스·관계자 인터뷰·분석가 및 크리에이터 영상·커뮤니티 예상에서 형성된 주류 의견과 의미 있는 반론을 종합한다.",
            "검색: 정확한 대진, 대회명, 경기 시작 시각을 사용해 한국어와 영어로 검색한다. 가능하면 성격이 다른 공개 출처 3개 이상을 비교한다.",
            "시점: 경기 시작 전에 공개된 자료만 사용한다. 경기 결과, 진행 중 상황, 사후 분석이나 스포일러는 절대 반영하지 않는다. 게시 시각을 확인할 수 없으면 결과를 모르는 프리뷰성 자료만 제한적으로 사용한다.",
            "출처 우선순위: 팀·선수·코치 등 관계자의 직접 발언, 신뢰할 수 있는 e스포츠 뉴스와 공식 방송, 분석가·크리에이터의 전망, 규모 있는 커뮤니티 토론 순이다. 한 게시물의 사견을 전체 여론처럼 쓰지 않는다.",
            "출처 품질: 단순 일정·결과 모음, 배당 홍보, 근거 없는 자동 생성 예측은 주류 여론의 근거로 쓰지 않는다. 대진을 직접 다루며 작성 주체와 논거가 분명한 자료를 우선한다.",
            "내부 데이터: recentRecord, 상대 난이도, 공통 상대, 세트 지표는 외부 전망을 검증하거나 보완하는 근거다. 숫자 나열이 프리뷰의 중심이 되어서는 안 된다.",
            "작성: summary는 정확히 2문장, 110~200자다. 첫 문장은 어느 쪽 우세론이 주류인지와 그 이유를, 둘째 문장은 반대 의견 또는 접전론의 근거를 담는다.",
            "watchPoint는 1문장, 40~90자로 주류 의견이 갈리는 핵심 변수 하나를 짚는다. 독자가 실제 커뮤니티의 전망을 훑어본 듯한 밀도를 주되 과장된 말투는 피한다.",
            "표현: '대체로', '우세론', '일부에서는', '반면' 같은 귀속 표현으로 합의와 이견을 구분한다. 출처에 없는 선수 상태, 밴픽, 메타, 라인전, 운영 성향을 만들어내지 않는다.",
            "근거 부족: 관련 공개 전망이 충분하지 않으면 여론을 꾸며내지 말고 그 사실을 짧게 밝힌 뒤 내부 기록에서 확인되는 대비만 쓴다.",
            "예측: 승패를 확정하지 않는다. 내부 Elo 숫자는 노출하지 않고 '더 까다로운 상대를 거쳤다'처럼 해석한다.",
            "winProbabilityA: internalFacts.teamA 팀이 이길 확률을 5~95 사이 정수 퍼센트로 적는다. 외부 전망의 우세론과 내부 기록을 함께 반영하되, 근거가 팽팽하면 50 근처로 둔다. 이 숫자는 summary·watchPoint 본문에 쓰지 않는다.",
            "evidence: 최종 문장에 실제로 사용한 내부 수치 근거를 최대 3개만 짧게 적는다.",
            "sourceUrls: summary와 watchPoint의 외부 전망을 실제로 뒷받침한 검색 결과 URL만 2~4개 적는다. 검색 과정에서 참고만 했거나 대진과 무관한 페이지는 제외한다.",
            "출력은 지정된 JSON 스키마만 따른다.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({ match: context, internalFacts: facts }),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "match_preview",
          strict: true,
          schema: MATCH_PREVIEW_SCHEMA,
        },
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI 호출 실패 (${response.status}): ${detail.slice(0, 240)}`);
  }

  const json = (await response.json()) as {
    status?: string;
    incomplete_details?: unknown;
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
  if (json.status === "incomplete") {
    throw new Error(`OpenAI 응답이 잘렸습니다: ${JSON.stringify(json.incomplete_details)}`);
  }
  const messages = (json.output ?? []).filter((item) => item.type === "message");
  const message = messages[messages.length - 1];
  const outputText = message?.content?.find((item) => item.type === "output_text");
  const text = outputText?.text;
  if (!text) throw new Error("OpenAI 응답 본문이 없습니다.");
  const searchedSources = (json.output ?? []).flatMap((item) => item.action?.sources ?? []);
  const citedSources = outputText?.annotations ?? [];
  const generated = normalizedPreview(JSON.parse(text));
  const selectedUrls = new Set(generated.sourceUrls.map(canonicalSourceUrl));
  const sources = normalizedSources([...citedSources, ...searchedSources])
    .filter((item) => selectedUrls.has(canonicalSourceUrl(item.url)))
    .slice(0, 4);
  return {
    summary: generated.summary,
    watchPoint: generated.watchPoint,
    winProbabilityA: generated.winProbabilityA,
    evidence: generated.evidence,
    sources,
  };
}

export async function getMatchAiPreview({
  match,
  teams,
  matches,
  sets,
}: MatchAiPreviewInputs): Promise<MatchAiPreview> {
  const facts = buildMatchPreviewFacts({ match, teams, matches, sets });
  const fallback = fallbackPreview(facts);
  if (!isUpcomingMatch(match) || !hasResolvedParticipants(match, teams)) {
    return fallback;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("match_ai_previews")
      .select("summary,watch_point,evidence")
      .eq("match_id", match.id)
      .maybeSingle();

    if (!error && data) {
      return previewFromCacheRow(data);
    }
  } catch (error) {
    console.warn("[match-ai-preview] cache lookup failed", error);
  }

  return fallback;
}

export async function refreshMatchAiPreviewCache({
  match,
  tournament,
  teams,
  matches,
  sets,
}: MatchAiPreviewInputs): Promise<MatchAiPreview> {
  const facts = buildMatchPreviewFacts({ match, teams, matches, sets });
  const model = process.env.OPENAI_MATCH_PREVIEW_MODEL ?? DEFAULT_MATCH_PREVIEW_MODEL;
  const context = previewContext(match, tournament);
  const inputHash = createHash("sha256")
    .update(JSON.stringify({ version: MATCH_PREVIEW_PROMPT_VERSION, model, context, facts }))
    .digest("hex");

  const generated = await callOpenAi({ facts, context, model });
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("match_ai_previews").upsert({
    match_id: match.id,
    input_hash: inputHash,
    model,
    summary: generated.summary,
    watch_point: generated.watchPoint,
    evidence: {
      facts: generated.evidence,
      sources: generated.sources,
      winProbabilityA: generated.winProbabilityA,
    },
    generated_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
  return { ...generated, source: "ai" };
}

export async function refreshMatchAiPreviewCacheForMatchId(
  matchId: string,
  options: RefreshMatchAiPreviewOptions = {},
) {
  const [match, teams, matches, sets, tournaments] = await Promise.all([
    getMatchById(matchId),
    getAllTeams(),
    getMatches(),
    getSets(),
    getTournaments(),
  ]);

  if (!match) {
    throw new Error(`Match not found for AI preview refresh: ${matchId}`);
  }

  const admin = createSupabaseAdminClient();
  if (!hasResolvedParticipants(match, teams) || !isUpcomingMatch(match)) {
    const { error } = await admin.from("match_ai_previews").delete().eq("match_id", match.id);
    if (error) throw new Error(error.message);
    return null;
  }

  if (!options.force) {
    const { data, error } = await admin
      .from("match_ai_previews")
      .select("summary,watch_point,evidence")
      .eq("match_id", match.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    // 예상 승률이 없는 이전 세대 캐시는 재생성해서 채운다.
    const cached = data ? previewFromCacheRow(data) : null;
    if (cached && cached.winProbabilityA !== null) return cached;
  }

  const tournament = tournaments.find((item) => item.id === match.tournamentId);
  return refreshMatchAiPreviewCache({ match, tournament, teams, matches, sets });
}
