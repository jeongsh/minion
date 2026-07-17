import "server-only";

import { createHash } from "node:crypto";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Match, SetResult, Team } from "@/lib/types";
import {
  buildMatchPreviewFacts,
  type MatchPreviewFacts,
} from "@/lib/match-preview-facts";

const MATCH_PREVIEW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "watchPoint", "evidence"],
  properties: {
    summary: { type: "string" },
    watchPoint: { type: "string" },
    evidence: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { type: "string" },
    },
  },
} as const;
const MATCH_PREVIEW_PROMPT_VERSION = 2;

export type MatchAiPreview = {
  summary: string;
  watchPoint: string;
  evidence: string[];
  source: "ai" | "fallback";
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
    evidence: [
      `${teamA.team} 상대 평균 레이팅 ${teamA.averageOpponentRating ?? "-"}`,
      `${teamB.team} 상대 평균 레이팅 ${teamB.averageOpponentRating ?? "-"}`,
    ],
    source: "fallback",
  };
}

function normalizedPreview(value: unknown): Omit<MatchAiPreview, "source"> {
  if (!value || typeof value !== "object") throw new Error("AI 프리뷰 응답이 객체가 아닙니다.");
  const row = value as { summary?: unknown; watchPoint?: unknown; evidence?: unknown };
  if (typeof row.summary !== "string" || typeof row.watchPoint !== "string") {
    throw new Error("AI 프리뷰의 필수 문장이 없습니다.");
  }
  const evidence = Array.isArray(row.evidence)
    ? row.evidence.filter((item): item is string => typeof item === "string").slice(0, 3)
    : [];
  return {
    summary: row.summary.trim().slice(0, 240),
    watchPoint: row.watchPoint.trim().slice(0, 120),
    evidence,
  };
}

async function callOpenAi(facts: MatchPreviewFacts, model: string) {
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
      reasoning: { effort: "low" },
      max_output_tokens: 600,
      input: [
        {
          role: "system",
          content: [
            "당신은 리그 오브 레전드 e스포츠 경기 프리뷰 에디터다.",
            "제공된 JSON 수치만 근거로 한국어 프리뷰를 작성한다.",
            "단순 승패나 세트 스코어만으로 강약을 단정하지 말고 상대 평균 레이팅, 접전 승리, 완승, 공통 상대를 함께 해석한다.",
            "첫 맞대결이면 맞대결 데이터 부족을 약점처럼 표현하지 말고 두 팀 스타일이 처음 충돌한다는 관전 요소로 쓴다.",
            "summary는 2문장, 90~180자. watchPoint는 1문장, 35~80자다.",
            "summary와 watchPoint에는 내부 Elo 레이팅 숫자를 직접 노출하지 말고 대진 난이도가 높다·낮다처럼 자연어로 해석한다.",
            "대진 난이도가 높은 팀은 '더 까다로운 상대들을 거쳤다'고 표현한다. 그 팀 자체가 '한 수 위 난이도'라고 표현하지 않는다.",
            "averageGameMinutes는 전체 경기 시간이다. 교전 시간이나 교전 길이라고 바꿔 쓰지 않는다.",
            "초반·후반·라인전·운영 성향은 입력에 시간대별 데이터가 없으므로 언급하지 않는다.",
            "statSetCount가 적으면 킬·골드·오브젝트 평균을 강한 근거로 사용하지 않는다.",
            "승패를 확정적으로 예언하거나 입력에 없는 선수, 밴픽, 메타, 경기 양상을 만들지 않는다.",
            "evidence에는 실제 사용한 수치 근거를 최대 3개만 짧게 적는다.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify(facts),
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
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI 호출 실패 (${response.status}): ${detail.slice(0, 240)}`);
  }

  const json = (await response.json()) as {
    status?: string;
    incomplete_details?: unknown;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  if (json.status === "incomplete") {
    throw new Error(`OpenAI 응답이 잘렸습니다: ${JSON.stringify(json.incomplete_details)}`);
  }
  const messages = (json.output ?? []).filter((item) => item.type === "message");
  const message = messages[messages.length - 1];
  const text = message?.content?.find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("OpenAI 응답 본문이 없습니다.");
  return normalizedPreview(JSON.parse(text));
}

export async function getMatchAiPreview({
  match,
  teams,
  matches,
  sets,
}: {
  match: Match;
  teams: Team[];
  matches: Match[];
  sets: SetResult[];
}): Promise<MatchAiPreview> {
  const facts = buildMatchPreviewFacts({ match, teams, matches, sets });
  const fallback = fallbackPreview(facts);
  const model = process.env.OPENAI_MATCH_PREVIEW_MODEL ?? "gpt-5.4-mini";
  const inputHash = createHash("sha256")
    .update(JSON.stringify({ version: MATCH_PREVIEW_PROMPT_VERSION, model, facts }))
    .digest("hex");

  let admin: ReturnType<typeof createSupabaseAdminClient> | null = null;
  try {
    admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("match_ai_previews")
      .select("input_hash,summary,watch_point,evidence")
      .eq("match_id", match.id)
      .maybeSingle();
    if (!error && data?.input_hash === inputHash) {
      return {
        summary: data.summary,
        watchPoint: data.watch_point,
        evidence: Array.isArray(data.evidence)
          ? data.evidence.filter((item): item is string => typeof item === "string")
          : [],
        source: "ai",
      };
    }
  } catch (error) {
    console.warn("[match-ai-preview] 캐시 조회 실패", error);
  }

  try {
    const generated = await callOpenAi(facts, model);
    if (admin) {
      const { error } = await admin.from("match_ai_previews").upsert({
        match_id: match.id,
        input_hash: inputHash,
        model,
        summary: generated.summary,
        watch_point: generated.watchPoint,
        evidence: generated.evidence,
        generated_at: new Date().toISOString(),
      });
      if (error) console.warn("[match-ai-preview] 캐시 저장 실패", error.message);
    }
    return { ...generated, source: "ai" };
  } catch (error) {
    console.error("[match-ai-preview] 생성 실패", error);
    return fallback;
  }
}
