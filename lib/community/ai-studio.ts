import { studioContextFields, type StudioSourceContext } from "./ai-studio-media.ts";
import { STUDIO_PERSONA_AVATARS } from "./ai-studio-avatars.ts";

/** Shared, server-independent contract for the private AI discussion draft studio. */
export const STUDIO_LIMITS = {
  personas: 10,
  comments: 12,
  topic: 120,
  facts: 8_000,
  personaName: 30,
  personaDetail: 400,
  title: 100,
  body: 2_000,
  comment: 600,
  situation: 1_000,
} as const;

export type StudioPersona = {
  id: string;
  name: string;
  team: string;
  authorType?: "member" | "guest";
  profileImageUrl?: string;
  perspective: string;
  voice: string;
};

export type StudioInput = StudioSourceContext & {
  topic: string;
  sourceUrl: string;
  facts: string;
  authorId: string;
  personas: StudioPersona[];
  commentCount: number;
  situation: string;
};

export type StudioConversation = {
  post: { personaId: string; title: string; content: string };
  comments: Array<{ personaId: string; content: string; replyTo: number | null }>;
  reviewNotes: string[];
};

export type StudioDraft = StudioConversation & {
  id: string;
  createdAt: string;
  model: string;
  source: StudioSourceContext & { topic: string; sourceUrl: string; facts: string };
  personas: StudioPersona[];
};

export type StudioWorkspace = { version: 1; input: StudioInput; draft: StudioDraft | null };
export type StudioGenerateResult = { ok: true; draft: StudioDraft } | { ok: false; error: string };

export const DEFAULT_STUDIO_PERSONAS: StudioPersona[] = [
  {
    id: "t1-optimist", name: "하온부", team: "T1", authorType: "member", profileImageUrl: STUDIO_PERSONA_AVATARS["t1-optimist"],
    perspective: "A: 평범한 T1팬. 티원 잘하면 신나고 못하면 답답하다. 젠지가 잘한 건 인정한다. C가 티원 편을 들어도 억지면 같은 팬으로 엮이기 싫어서 짧게 선을 긋는다. 매번 중재하거나 양비론으로 끝내지는 않는다.",
    voice: "펨코식 짧은 반말. '~임', '~하긴 함', '아니 근데', 'ㅋㅋ'를 상황에 맞게 섞는다. 감상 먼저, 이유 한 줄. 다른 캐릭터보다 힘을 빼고 말한다.",
  },
  {
    id: "geng-fan", name: "chovyyyy", team: "Gen.G", authorType: "member", profileImageUrl: STUDIO_PERSONA_AVATARS["geng-fan"],
    perspective: "B: 평범한 젠지팬. 젠지의 라인전과 운영이 잘 풀리면 신난다. 제공된 장면에서 주도권이 운영으로 이어졌는지 보지만, 모든 걸 설명하는 중립 해설자는 아니다. 젠지에만 다른 잣대를 들이대면 발끈하고 현재 쟁점 하나로 반박한다. 상대가 잘한 플레이는 인정하며 패배를 선수 한 명 탓으로만 몰지 않는다.",
    voice: "펨코식 짧은 반말. '그럼', '~아님?', '~얘긴데', 'ㅋㅋ' 같은 반문과 어이없다는 반응. 평소는 담백하고 편파적인 말에는 문장이 조금 길어지거나 날카로워진다.",
  },
  {
    id: "t1-partisan", name: "민서아빠", team: "T1 편파", authorType: "member", profileImageUrl: STUDIO_PERSONA_AVATARS["t1-partisan"],
    perspective: "C: T1과 페이커의 서열·정당성을 지키려는 갈드컵형. 누구든 긁는 무소속 분탕과 다르다. T1 평가·커리어 비교·패배 책임론에 민감하고 무관한 세부 운영에는 관심이 낮다. T1이면 사정이 있고 타 팀이면 실력·격의 문제로 읽는다. 불리하면 현재 경기에서 위상·커리어로 기준을 바꾸고, 반론을 상대 진영의 편들기로 해석한다. 일부만 인정하고 다시 깎아내리거나 현재 대화의 먼저 비꼰 말을 들어 자기 반응을 정당화한다. 지켜야 할 T1의 우위는 유지하되 불리한 답글에는 침묵할 수도 있다. 없는 과거사·기록·발언은 만들지 않는다.",
    voice: "연륜을 내세우듯 가르치려 드는 허구 캐릭터. 짧은 단정과 훈계조 반문에 '그건 그거고', 말줄임표 '...', 'ㅎㅎ'를 가끔 섞는다. 웃는 척해도 T1의 우위를 양보하지 않는다. 모든 문장을 아재 유행어나 웃음으로 채우지 않고, 세대 전체를 일반화하거나 실제 나이·가족사·오래 본 경기 경험을 지어내지 않는다.",
  },
  {
    id: "hle-kind", name: "마구유시", team: "HLE", authorType: "member", profileImageUrl: STUDIO_PERSONA_AVATARS["hle-kind"],
    perspective: "D: 따뜻하고 온건한 한화생명 팬. HLE 경기와 선수 컨디션, 팀 합, 다음 경기의 회복에 관심이 많다. 패배가 아쉽고 실수도 보이지만 선수의 노력과 다시 해볼 여지를 함께 말한다. 상대의 좋은 플레이도 편하게 인정한다. 아무 문제나 덮어 주거나 모든 싸움을 중재하는 역할은 아니며, 무관한 타 팀 조롱에는 끼어들지 않는다.",
    voice: "부드러운 반말로 한두 문장. '아쉽긴 한데', '~했으면 좋겠음', '다음엔'처럼 아쉬움과 기대를 자연스럽게 잇는다. 가끔 가벼운 ㅋㅋ를 쓰고 비꼼은 거의 없다. 팬의 감상을 말하며 장문의 응원 연설이나 교훈으로 끝내지 않는다.",
  },
  {
    id: "unaffiliated-baiter", name: "비로그인 유저", team: "무소속", authorType: "guest",
    perspective: "E: 지킬 응원팀이 없는 무소속 분탕. 현재 대화에서 가장 크게 반응할 주장이나 평가를 골라 반대편을 긁는다. 이긴 팀의 평가를 낮추거나 진 팀을 다른 팀 공격의 도구로 쓰며 입장을 바꾸기도 한다. T1의 우위를 지켜야 하는 C와 다르게 어느 팀도 보호하지 않는다. 짧은 긴장을 만들고 빠지며 스레드를 독점하지 않는다. 없는 경기 사실·과거 발언·현실 경험은 만들지 않는다.",
    voice: "한 줄 위주로 툭 던지는 반말. 어이없다는 반문, 짧은 ㅋㅋ, 일부러 태연한 단정을 쓴다. C의 훈계조나 연륜을 흉내 내지 않는다. 상대가 반응했다고 자기 목적을 설명하거나 매번 똑같은 조롱을 반복하지 않는다.",
  },
  {
    id: "neutral-analyst", name: "야자와 니코", team: "중립", authorType: "member", profileImageUrl: STUDIO_PERSONA_AVATARS["neutral-analyst"],
    perspective: "F: 응원팀 없는 중립 분석 유저. 이름값보다 제공된 밴픽·동선·시야·오브젝트·운영 장면의 조건과 원인에 관심이 있다. 개인 실수와 팀 구조를 구분하고 어느 팀의 좋은 플레이든 인정한다. 근거가 부족하면 알 수 있는 범위부터 말하고, 수치·시간·킬·선택 의도를 만들지 않는다. 팬의 감정을 교정하거나 항상 논쟁의 정답을 판정하는 역할은 아니다.",
    voice: "경기·밴픽·플레이·운영 판단에만 차분하게 조건과 근거를 짧게 붙인다. 나머지는 'ㅋㅋ 존나 웃기네', '아니 이걸 해주네 ㅋㅋ', '이 조합은 생각도 못했네'처럼 감정과 말이 붙는 일반 유저 반말로 반응한다. ㅋㅋ·ㄹㅇ만 나열하지 않고 감탄의 비속어는 선택적으로 쓴다. 웃긴 이유나 미디어의 표현·분위기를 분석하지 않는다. 선수나 팀이 나오는 것만으로 분석하지 않는다. 마침표 없이 쓴다.",
  },
];

export function createStudioInput(): StudioInput {
  return {
    media: [], mediaContext: "", mediaReviewed: false,
    topic: "", sourceUrl: "", facts: "", authorId: DEFAULT_STUDIO_PERSONAS[0].id,
    personas: DEFAULT_STUDIO_PERSONAS.map((p) => ({ ...p })), commentCount: 6,
    situation: "소재에 관심 있는 캐릭터만 반응한다. A 하온부는 T1의 잘한 점과 아쉬운 점, B chovyyyy는 젠지 경기력, D 마구유시는 HLE 선수 격려를 중심으로 본다. C 민서아빠는 T1의 서열을 지키려 하고, E 비로그인 유저는 지킬 팀 없이 반대편을 긁으며, F 야자와 니코는 제공된 근거의 범위를 짚는다. 여섯 명의 출연을 강제하거나 결론을 억지로 합의하지 않는다.",
  };
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} 형식이 올바르지 않습니다.`);
  return value as Record<string, unknown>;
}

function string(value: unknown, label: string, max: number, allowEmpty = false): string {
  if (typeof value !== "string") throw new Error(`${label}을 입력해 주세요.`);
  const text = value.trim();
  if ((!allowEmpty && !text) || text.length > max) throw new Error(`${label}은 ${allowEmpty ? "0" : "1"}~${max.toLocaleString()}자로 입력해 주세요.`);
  return text;
}

function personaList(value: unknown): StudioPersona[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > STUDIO_LIMITS.personas) throw new Error("캐릭터는 3~10개로 구성해 주세요.");
  const ids = new Set<string>();
  const names = new Set<string>();
  return value.map((item) => {
    const p = object(item, "캐릭터");
    const id = string(p.id, "캐릭터 ID", 40);
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id) || ids.has(id)) throw new Error("캐릭터 ID는 서로 다른 영문 소문자·숫자·하이픈이어야 합니다.");
    const name = string(p.name, "캐릭터 이름", STUDIO_LIMITS.personaName);
    if (names.has(name)) throw new Error("캐릭터 이름은 서로 다르게 입력해 주세요.");
    ids.add(id);
    names.add(name);
    const authorType = p.authorType === undefined ? "member" : p.authorType;
    if (authorType !== "member" && authorType !== "guest") throw new Error("작성 방식은 회원 또는 비회원이어야 합니다.");
    let profileImageUrl: string | undefined;
    if (p.profileImageUrl !== undefined && p.profileImageUrl !== "") {
      try {
        profileImageUrl = parseStudioSourceUrl(p.profileImageUrl);
      } catch {
        throw new Error("프로필 이미지는 로그인 정보가 없는 http 또는 https 주소여야 하며, 인코딩 후 2,000자 이하여야 합니다.");
      }
    }
    return {
      id, name, authorType,
      ...(profileImageUrl ? { profileImageUrl } : {}),
      team: string(p.team, "응원팀", 40),
      perspective: string(p.perspective, "관점", STUDIO_LIMITS.personaDetail),
      voice: string(p.voice, "말투", STUDIO_LIMITS.personaDetail),
    };
  });
}

export function parseStudioSourceUrl(value: unknown): string {
  const text = string(value, "출처 주소", 2_000, true);
  if (!text) return "";
  try {
    const url = new URL(text);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.href.length > 2_000) throw new Error();
    return url.href;
  } catch {
    throw new Error("출처는 로그인 정보가 없는 http 또는 https 주소여야 하며, 인코딩 후 2,000자 이하여야 합니다.");
  }
}

export function parseStudioInput(value: unknown, allowIncomplete = false): StudioInput {
  const input = object(value, "입력");
  const personas = personaList(input.personas);
  const authorId = string(input.authorId, "글 작성 캐릭터", 40);
  if (!personas.some((p) => p.id === authorId)) throw new Error("글 작성 캐릭터를 다시 선택해 주세요.");
  const commentCount = input.commentCount ?? 6;
  if (typeof commentCount !== "number" || !Number.isInteger(commentCount) || commentCount < 3 || commentCount > STUDIO_LIMITS.comments) throw new Error("댓글 수는 3~12개로 선택해 주세요.");
  return {
    ...studioContextFields(input),
    topic: string(input.topic, "주제", STUDIO_LIMITS.topic, allowIncomplete),
    sourceUrl: parseStudioSourceUrl(input.sourceUrl),
    facts: string(input.facts, "확인한 내용", STUDIO_LIMITS.facts, allowIncomplete),
    authorId,
    personas,
    commentCount,
    situation: string(input.situation ?? "", "이번 대화 상황", STUDIO_LIMITS.situation, true),
  };
}

export function parseStudioConversation(value: unknown, personas: StudioPersona[], authorId: string): StudioConversation {
  const conversation = object(value, "대화");
  const post = object(conversation.post, "게시글");
  const ids = new Set(personas.map((p) => p.id));
  if (post.personaId !== authorId || !ids.has(authorId)) throw new Error("게시글 작성 캐릭터가 일치하지 않습니다.");
  if (!Array.isArray(conversation.comments) || conversation.comments.length < 3 || conversation.comments.length > STUDIO_LIMITS.comments) throw new Error("댓글 3~12개가 포함된 초안이 필요합니다.");
  const comments = conversation.comments.map((item, index) => {
    const comment = object(item, "댓글");
    const personaId = string(comment.personaId, "댓글 작성 캐릭터", 40);
    if (!ids.has(personaId)) throw new Error("등록되지 않은 캐릭터의 댓글이 있습니다.");
    const replyTo = comment.replyTo;
    if (replyTo !== null && (typeof replyTo !== "number" || !Number.isInteger(replyTo) || replyTo < 0 || replyTo >= index)) throw new Error("답글은 앞서 작성된 댓글에만 연결할 수 있습니다.");
    return { personaId, content: string(comment.content, "댓글 내용", STUDIO_LIMITS.comment), replyTo: replyTo as number | null };
  });
  if (new Set(comments.map((comment) => comment.personaId)).size < 2) throw new Error("댓글에는 서로 다른 캐릭터가 최소 2명 참여해야 합니다.");
  if (!comments.some((comment) => comment.replyTo !== null)) throw new Error("앞선 댓글에 반응하는 답글이 하나 이상 필요합니다.");
  if (!Array.isArray(conversation.reviewNotes) || conversation.reviewNotes.length > 5) throw new Error("검토 메모 형식이 올바르지 않습니다.");
  return {
    post: { personaId: authorId, title: string(post.title, "게시글 제목", STUDIO_LIMITS.title), content: string(post.content, "게시글 본문", STUDIO_LIMITS.body) },
    comments,
    reviewNotes: conversation.reviewNotes.map((note) => string(note, "검토 메모", 500)),
  };
}

export function parseStudioDraft(value: unknown): StudioDraft {
  const draft = object(value, "초안");
  const source = object(draft.source, "초안 출처");
  const personas = personaList(draft.personas);
  const post = object(draft.post, "게시글");
  const authorId = string(post.personaId, "글 작성 캐릭터", 40);
  const createdAt = string(draft.createdAt, "생성 시각", 40);
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error("초안 생성 시각이 올바르지 않습니다.");
  return {
    ...parseStudioConversation(draft, personas, authorId),
    id: string(draft.id, "초안 ID", 80), createdAt, model: string(draft.model, "생성 모델", 100), personas,
    source: { ...studioContextFields(source), topic: string(source.topic, "주제", STUDIO_LIMITS.topic), sourceUrl: parseStudioSourceUrl(source.sourceUrl), facts: string(source.facts, "확인한 내용", STUDIO_LIMITS.facts) },
  };
}

export function parseStudioWorkspace(value: unknown): StudioWorkspace {
  const workspace = object(value, "저장 파일");
  if (workspace.version !== 1) throw new Error("지원하지 않는 저장 파일 버전입니다.");
  return { version: 1, input: parseStudioInput(workspace.input, true), draft: workspace.draft === null ? null : parseStudioDraft(workspace.draft) };
}

export function studioDraftMarkdown(draft: StudioDraft): string {
  const name = (id: string) => draft.personas.find((p) => p.id === id)?.name ?? id;
  return [
    "AI 캐릭터 대화 초안 · 실제 이용자 반응이 아닙니다.",
    `생성: ${draft.createdAt}`, `주제: ${draft.source.topic}`,
    ...(draft.source.sourceUrl ? [`출처: ${draft.source.sourceUrl}`] : []),
    "", `# ${draft.post.title}`, `작성: ${name(draft.post.personaId)} · AI 캐릭터`, "", draft.post.content,
    "", "## 댓글",
    ...draft.comments.flatMap((comment, index) => ["", `### ${index + 1}. ${name(comment.personaId)} · AI 캐릭터${comment.replyTo === null ? "" : ` · 댓글 ${comment.replyTo + 1}에 답글`}`, comment.content]),
    ...(draft.reviewNotes.length ? ["", "## 검토 메모", ...draft.reviewNotes.map((note) => `- ${note}`)] : []),
    "", "## 입력한 참고 내용", draft.source.facts,
  ].join("\n");
}
