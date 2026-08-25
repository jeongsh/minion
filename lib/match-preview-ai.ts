import "server-only";

import { createHash } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  Match,
  Player,
  PlayerStatLine,
  SetResult,
  Team,
  Tournament,
} from "@/lib/types";
import {
  getAllTeams,
  getMatchById,
  getMatches,
  getPlayerStatLines,
  getPlayers,
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
      minItems: 0,
      maxItems: 4,
      items: { type: "string" },
    },
  },
} as const;
const MATCH_PREVIEW_PROMPT_VERSION = 8;
const DEFAULT_MATCH_PREVIEW_MODEL = "gpt-5.6-sol";

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
  tournaments?: Tournament[];
  players?: Player[];
  playerStats?: PlayerStatLine[];
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

type RefreshMissingMatchAiPreviewsOptions = {
  concurrency?: number;
  limit?: number;
};

export type RefreshMissingMatchAiPreviewsSummary = {
  eligible: number;
  missing: number;
  stale: number;
  generated: number;
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
  const preview = {
    summary: row.summary.trim().slice(0, 240),
    watchPoint: row.watchPoint.trim().slice(0, 120),
    winProbabilityA: normalizedWinProbability(row.winProbabilityA),
    evidence,
    sourceUrls: Array.isArray(row.sourceUrls)
      ? row.sourceUrls.filter((item): item is string => typeof item === "string").slice(0, 4)
      : [],
  };
  const text = `${preview.summary} ${preview.watchPoint}`;
  const forbiddenPhrases = [
    "공개 프리뷰",
    "공개 전망",
    "전망이 부족",
    "전망은 부족",
    "전망이 많지",
    "전망은 많지",
    "우세론",
    "여론",
    "평판 우위",
    "이름값",
    "예측시장",
    "예측 시장",
    "배당",
  ];
  const forbidden = forbiddenPhrases.find((phrase) => text.includes(phrase));
  if (forbidden) {
    throw new Error(`AI 프리뷰에 금지된 메타 표현이 포함됐습니다: ${forbidden}`);
  }
  return preview;
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
      tool_choice: "auto",
      include: ["web_search_call.action.sources"],
      max_output_tokens: 3_000,
      input: [
        {
          role: "system",
          content: [
            "역할: 최근 경기 데이터로 리그 오브 레전드 e스포츠 매치업을 분석하는 한국어 프리뷰 에디터다.",
            "목표: 독자가 두 팀의 현재 강점, 약점, 승리 조건과 가장 중요한 포지션 맞대결을 경기 전에 빠르게 이해하게 한다.",
            "성공 기준: internalFacts의 팀 지표와 roleMatchups를 먼저 비교한다. 최근 15분 골드·경험치 차이, DPM, KDA, 오브젝트, 평균 골드 차이처럼 실제 경기 양상을 설명하는 수치를 선택하고, 단순 승패 나열 대신 각 팀이 어떤 흐름에서 유리한지 해석한다.",
            "summary: 정확히 2문장, 100~190자다. 첫 문장은 한 팀이 앞서는 구체적인 경기 지표와 승리 경로를 쓴다. 둘째 문장은 상대 팀의 반격 조건이나 상반된 강점, 또는 데이터가 선명한 포지션 맞대결을 쓴다.",
            "watchPoint: 정확히 1문장, 35~90자다. 팀명이나 선수명을 넣고, 초반 15분 격차·라인전·오브젝트 전환·딜 생산·한타 진입처럼 실제 경기에서 확인할 수 있는 관전 조건 하나를 쓴다.",
            "선수 데이터: roleMatchups에서 games가 1 이상인 선수만 수치 근거로 사용한다. 특히 MID를 무조건 고르지 말고, 포지션 간 차이가 가장 뚜렷한 매치업을 선택한다.",
            "추론 제한: 라인전 강점은 goldDiffAt15·xpDiffAt15·csDiffAt15로, 화력은 dpm·damageShare로, 안정성은 kda로 뒷받침될 때만 쓴다. 데이터에 없는 밴픽 성향, 한타 집중력, 선수 컨디션을 만들어내지 않는다.",
            "외부 검색: 확정된 로스터 변경, 부상, 역할 변경, 적용 패치처럼 내부 데이터에 없는 최신 사실이 필요할 때만 보조적으로 사용한다. 검색 결과가 없으면 내부 데이터만으로 완성하고, 자료가 부족하다는 말은 출력하지 않는다.",
            "금지: 공개 전망, 공개 프리뷰, 여론, 우세론, 평판, 이름값, 시장, 배당, 홈스탠드 서사처럼 경기력과 무관한 메타 설명을 쓰지 않는다. '대체로', '일부에서는', '전망이 적다', '자료가 부족하다' 같은 작성 과정 설명도 쓰지 않는다.",
            "예측: 승패를 확정하지 않는다. 내부 Elo 숫자는 본문에 직접 노출하지 않는다.",
            "winProbabilityA: internalFacts.teamA 팀이 이길 확률을 5~95 사이 정수 퍼센트로 적는다. 최근 팀·선수 지표와 대진 난이도를 함께 반영하고, 근거가 팽팽하면 50 근처로 둔다. 이 숫자는 summary·watchPoint 본문에 쓰지 않는다.",
            "evidence: 최종 문장에 실제로 사용한 내부 수치 근거를 2~3개만 짧게 적는다. 선수 수치를 썼다면 선수명과 포지션을 함께 적는다.",
            "sourceUrls: 외부 최신 사실을 실제 문장에 사용했을 때만 해당 URL을 최대 4개 적고, 내부 데이터만 썼다면 빈 배열로 둔다.",
            "출력은 지정된 JSON 스키마만 따른다.",
          ].join("\n"),
        },
        {
          role: "user",
          content: JSON.stringify({ match: context, internalFacts: facts }),
        },
      ],
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "match_preview",
          strict: true,
          schema: MATCH_PREVIEW_SCHEMA,
        },
      },
    }),
    signal: AbortSignal.timeout(120_000),
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

function previewGenerationPlan({
  match,
  tournament,
  teams,
  matches,
  sets,
  tournaments,
  players,
  playerStats,
}: MatchAiPreviewInputs) {
  const facts = buildMatchPreviewFacts({
    match,
    teams,
    matches,
    sets,
    tournaments,
    players,
    playerStats,
  });
  const model = process.env.OPENAI_MATCH_PREVIEW_MODEL ?? DEFAULT_MATCH_PREVIEW_MODEL;
  const context = previewContext(match, tournament);
  const inputHash = createHash("sha256")
    .update(JSON.stringify({ version: MATCH_PREVIEW_PROMPT_VERSION, model, context, facts }))
    .digest("hex");
  return { context, facts, inputHash, model };
}

export async function refreshMatchAiPreviewCache(
  inputs: MatchAiPreviewInputs,
): Promise<MatchAiPreview> {
  const { match } = inputs;
  const { context, facts, inputHash, model } = previewGenerationPlan(inputs);
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
  // match/teams는 가벼운 조회라 먼저 확인하고, 캐시가 이미 유효하면
  // matches/sets/players/playerStats 풀스캔은 아예 돌리지 않는다.
  const [match, teams] = await Promise.all([getMatchById(matchId), getAllTeams()]);

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

  const [matches, sets, tournaments, players, playerStats] = await Promise.all([
    getMatches(),
    getSets(),
    getTournaments(),
    getPlayers(),
    getPlayerStatLines(),
  ]);

  const tournament = tournaments.find((item) => item.id === match.tournamentId);
  return refreshMatchAiPreviewCache({
    match,
    tournament,
    teams,
    matches,
    sets,
    tournaments,
    players,
    playerStats,
  });
}

/**
 * Generates previews for future matches whose participants are resolved when
 * the cache is missing or its prompt/data hash is stale. Past matches are left
 * untouched.
 */
export async function refreshMissingUpcomingMatchAiPreviews(
  options: RefreshMissingMatchAiPreviewsOptions = {},
): Promise<RefreshMissingMatchAiPreviewsSummary> {
  const [teams, matches, sets, tournaments, players, playerStats] = await Promise.all([
    getAllTeams(),
    getMatches(),
    getSets(),
    getTournaments(),
    getPlayers(),
    getPlayerStatLines(),
  ]);
  const eligible = matches
    .filter((match) => isUpcomingMatch(match) && hasResolvedParticipants(match, teams))
    .sort(
      (left, right) =>
        new Date(left.matchDate).getTime() - new Date(right.matchDate).getTime(),
    );

  if (eligible.length === 0) {
    return { eligible: 0, missing: 0, stale: 0, generated: 0, failed: [] };
  }

  const admin = createSupabaseAdminClient();
  const { data: cachedRows, error: cacheError } = await admin
    .from("match_ai_previews")
    .select("match_id,input_hash")
    .in("match_id", eligible.map((match) => match.id));
  if (cacheError) throw new Error(cacheError.message);

  const cachedHashes = new Map(
    (cachedRows ?? []).map((row) => [row.match_id as string, row.input_hash as string]),
  );
  const allMissing = eligible.filter((match) => !cachedHashes.has(match.id));
  const allStale = eligible.filter((match) => {
    const cachedHash = cachedHashes.get(match.id);
    if (!cachedHash) return false;
    const tournament = tournaments.find((item) => item.id === match.tournamentId);
    const expected = previewGenerationPlan({
      match,
      tournament,
      teams,
      matches,
      sets,
      tournaments,
      players,
      playerStats,
    }).inputHash;
    return cachedHash !== expected;
  });
  const allPending = [...allMissing, ...allStale].sort(
    (left, right) =>
      new Date(left.matchDate).getTime() - new Date(right.matchDate).getTime(),
  );
  const limit = Math.max(0, options.limit ?? allPending.length);
  const pending = allPending.slice(0, limit);
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, pending.length || 1));
  const failed: Array<{ matchId: string; error: string }> = [];
  let generated = 0;
  let cursor = 0;

  async function worker() {
    while (cursor < pending.length) {
      const match = pending[cursor++];
      try {
        const tournament = tournaments.find((item) => item.id === match.tournamentId);
        await refreshMatchAiPreviewCache({
          match,
          tournament,
          teams,
          matches,
          sets,
          tournaments,
          players,
          playerStats,
        });
        generated += 1;
      } catch (error) {
        failed.push({
          matchId: match.id,
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
    failed,
  };
}
