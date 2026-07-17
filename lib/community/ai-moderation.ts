// 커뮤니티 AI 검수 — 순수 판정 로직(외부 의존 없음: fetch 만 사용).
// 글쓰기 응답을 막지 않도록 서버 액션의 after() 안에서 호출된다(lib/community/actions.ts).
//
// 2단 검사:
// 1) OpenAI Moderation API(무료) — 혐오·괴롭힘·성적·폭력 등 정책 위반.
// 2) 소형 모델 분류 — 상업 광고/도박·불법 사이트 홍보(모더레이션 API 가 못 잡는 영역).
//
// 실패 정책: fail-open. API 오류/타임아웃/키 미설정이면 "정상"으로 통과시킨다 —
// 검수 장애가 글쓰기를 막으면 안 되고, 놓친 글은 신고 누적 블라인드가 받아준다.
// 판정 결과 적용(블라인드 + 신고함 등록)은 lib/data/community.ts applyAiFlag 가 담당한다.

export type AiScreenVerdict =
  | { flagged: false }
  | { flagged: true; category: string; detail: string };

const NOT_FLAGGED: AiScreenVerdict = { flagged: false };

/** Moderation API 카테고리 → 한국어 라벨(신고함 노출용). 접두 매칭. */
const MODERATION_CATEGORY_LABELS: [prefix: string, label: string][] = [
  ["harassment", "괴롭힘·모욕"],
  ["hate", "혐오 표현"],
  ["sexual", "성적 콘텐츠"],
  ["violence", "폭력·위협"],
  ["self-harm", "자해·자살"],
  ["illicit", "불법 행위"],
];

function moderationLabel(category: string): string {
  for (const [prefix, label] of MODERATION_CATEGORY_LABELS) {
    if (category.startsWith(prefix)) return label;
  }
  return category;
}

type ModerationResponse = {
  results?: Array<{
    flagged?: boolean;
    categories?: Record<string, boolean>;
    category_scores?: Record<string, number>;
  }>;
};

/** 1단계: OpenAI Moderation API(omni-moderation-latest, 무료). */
async function screenWithModerationApi(text: string, apiKey: string): Promise<AiScreenVerdict> {
  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: text.slice(0, 8_000),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Moderation API 실패 (${response.status})`);
  }

  const json = (await response.json()) as ModerationResponse;
  const result = json.results?.[0];
  if (!result?.flagged) return NOT_FLAGGED;

  // 걸린 카테고리 중 점수가 가장 높은 것을 대표로 노출한다.
  const scores = result.category_scores ?? {};
  const flaggedCategories = Object.entries(result.categories ?? {})
    .filter(([, isFlagged]) => isFlagged)
    .map(([category]) => category)
    .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0));
  const top = flaggedCategories[0] ?? "unknown";

  return {
    flagged: true,
    category: moderationLabel(top),
    detail: `모더레이션 점수 ${((scores[top] ?? 0) * 100).toFixed(0)}%`,
  };
}

const SPAM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "reason"],
  properties: {
    verdict: { type: "string", enum: ["ad", "gambling", "normal"] },
    reason: { type: "string" },
  },
} as const;

type SpamResponse = {
  status?: string;
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
};

/** 2단계: 소형 모델로 광고/도박 홍보 분류. */
async function screenForSpam(text: string, apiKey: string): Promise<AiScreenVerdict> {
  const model = process.env.OPENAI_COMMUNITY_MODERATION_MODEL ?? "gpt-5.4-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      reasoning: { effort: "low" },
      max_output_tokens: 500,
      input: [
        {
          role: "system",
          content: [
            "당신은 LCK 팬 커뮤니티의 게시물 검수 담당이다.",
            "글이 상업적 스팸인지 분류한다.",
            "ad: 상품·서비스의 상업적 홍보, 외부 사이트 유입 유도, 계정·아이템 판매 등.",
            "gambling: 도박, 토토, 카지노, 불법 사이트 홍보.",
            "normal: 그 외 전부. 경기 이야기, 선수 응원·비평, 팬 잡담, 굿즈 나눔·양도, 직관 후기, 팬아트 홍보 등 팬 활동은 모두 normal 이다.",
            "확실하지 않으면 normal 로 판정한다.",
            "reason 은 한국어 한 문장으로 짧게 쓴다.",
          ].join(" "),
        },
        { role: "user", content: text.slice(0, 4_000) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "community_spam_check",
          strict: true,
          schema: SPAM_SCHEMA,
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`스팸 분류 호출 실패 (${response.status})`);
  }

  const json = (await response.json()) as SpamResponse;
  if (json.status === "incomplete") throw new Error("스팸 분류 응답이 잘렸습니다.");
  const messages = (json.output ?? []).filter((item) => item.type === "message");
  const outputText = messages[messages.length - 1]?.content?.find(
    (item) => item.type === "output_text",
  )?.text;
  if (!outputText) throw new Error("스팸 분류 응답 본문이 없습니다.");

  const parsed = JSON.parse(outputText) as { verdict?: string; reason?: string };
  if (parsed.verdict === "ad") {
    return { flagged: true, category: "광고·홍보", detail: parsed.reason ?? "" };
  }
  if (parsed.verdict === "gambling") {
    return { flagged: true, category: "도박·불법 사이트", detail: parsed.reason ?? "" };
  }
  return NOT_FLAGGED;
}

/**
 * 본문 AI 검수. 위반이면 카테고리/사유를 돌려준다.
 * 키 미설정·API 장애 시에는 fail-open(정상 판정)한다.
 */
export async function screenCommunityText(input: {
  title?: string;
  text: string;
}): Promise<AiScreenVerdict> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NOT_FLAGGED;

  const combined = [input.title ?? "", input.text].join("\n").trim();
  if (!combined) return NOT_FLAGGED;

  // 1단계: 무료 모더레이션(혐오/성적/폭력 등). 걸리면 2단계 비용을 아낀다.
  try {
    const verdict = await screenWithModerationApi(combined, apiKey);
    if (verdict.flagged) return verdict;
  } catch (error) {
    console.warn("[ai-moderation] 모더레이션 API 실패", error);
  }

  // 2단계: 광고/도박 분류.
  try {
    return await screenForSpam(combined, apiKey);
  } catch (error) {
    console.warn("[ai-moderation] 스팸 분류 실패", error);
    return NOT_FLAGGED;
  }
}
