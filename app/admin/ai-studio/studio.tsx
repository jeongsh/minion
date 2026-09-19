"use client";

import { cloneElement, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import Image from "next/image";

import { FilterDropdown } from "@/components/match-filter-dropdown";
import {
  createStudioInput,
  parseStudioDraft,
  parseStudioInput,
  parseStudioWorkspace,
  STUDIO_LIMITS,
  studioDraftMarkdown,
  type StudioDraft,
  type StudioGenerateResult,
  type StudioPersona,
} from "@/lib/community/ai-studio";
import { STUDIO_STYLE_SOURCES, STUDIO_STYLE_SUMMARY } from "@/lib/community/ai-studio-style";
import { normalizeStudioSourceUrl } from "@/lib/community/ai-studio-source-url";
import type { StudioMedia } from "@/lib/community/ai-studio-media";
import { MediaPanel, MediaPreview } from "./media-panel";
import { PublicationPanel } from "./publication-panel";

const MAX_FILE_BYTES = 100 * 1024;
const COMMENT_OPTIONS = Array.from({ length: STUDIO_LIMITS.comments - 2 }, (_, index) => ({ value: String(index + 3), label: `${index + 3}개` }));
type SourceImportResult = { ok: true; source: { title: string; url: string; facts: string; warnings: string[]; media?: StudioMedia[] } } | { ok: false; error: string };
const fieldClass = "w-full min-w-0 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-3 py-2.5 text-base font-normal leading-relaxed text-[var(--ui-ink)] outline-none focus:border-[var(--ui-ink)] focus:ring-1 focus:ring-[var(--ui-ink)] disabled:opacity-60";
const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] px-4 py-2 text-sm font-medium text-[var(--ui-ink)] transition hover:bg-[var(--ui-surface-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";
const panelClass = "min-w-0 space-y-5 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-5 sm:p-6";
const PERSONA_ROLES: Record<string, { letter: string; label: string; color: string }> = {
  "t1-optimist": { letter: "A", label: "평범한 T1 팬", color: "bg-red-500/10 text-red-700 dark:text-red-300" },
  "geng-fan": { letter: "B", label: "평범한 젠지 팬", color: "bg-amber-500/10 text-amber-800 dark:text-amber-300" },
  "t1-partisan": { letter: "C", label: "T1 편파 팬", color: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  "hle-kind": { letter: "D", label: "따뜻한 HLE 팬", color: "bg-orange-500/10 text-orange-700 dark:text-orange-300" },
  "unaffiliated-baiter": { letter: "E", label: "무소속 분탕", color: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
  "neutral-analyst": { letter: "F", label: "중립 분석", color: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
};

function Field({ label, children }: { label: string; children: ReactElement<{ "aria-labelledby"?: string }> }) {
  const labelId = useId();
  return <label className="flex min-w-0 flex-col gap-2"><span id={labelId} className="text-sm font-medium">{label}</span>{cloneElement(children, { "aria-labelledby": labelId })}</label>;
}

function AiBadge({ guest = false }: { guest?: boolean }) {
  return <><span className="shrink-0 rounded-full bg-[var(--ui-surface-muted)] px-2.5 py-1 text-[13px] font-medium text-[var(--ui-muted)]">AI 캐릭터</span>{guest ? <span className="shrink-0 rounded-full border border-[var(--ui-border)] px-2.5 py-1 text-[13px] font-medium text-[var(--ui-muted)]">비회원</span> : null}</>;
}

function PersonaAvatar({ persona, index }: { persona?: StudioPersona; index: number }) {
  const [failedUrl, setFailedUrl] = useState("");
  const role = persona ? PERSONA_ROLES[persona.id] : undefined;
  const imageUrl = persona?.profileImageUrl;
  if (imageUrl && failedUrl !== imageUrl) {
    return <Image src={imageUrl} width={40} height={40} alt="" unoptimized referrerPolicy="no-referrer" onError={() => setFailedUrl(imageUrl)} className="size-10 shrink-0 rounded-full object-cover" />;
  }
  return <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full text-base font-bold ${role?.color ?? "bg-[var(--ui-surface-muted)] text-[var(--ui-muted)]"}`}>{role?.letter ?? String.fromCharCode(65 + Math.max(index, 0))}</span>;
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function PersonaIdentity({ draft, personaId }: { draft: StudioDraft; personaId: string }) {
  const index = draft.personas.findIndex((persona) => persona.id === personaId);
  const persona = draft.personas[index];
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PersonaAvatar persona={persona} index={index} />
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="break-all text-base font-bold">{persona?.name ?? personaId}</span>
        <AiBadge guest={persona?.authorType === "guest"} />
        {persona ? <span className="text-[13px] font-normal text-[var(--ui-muted)]">{persona.team}</span> : null}
      </div>
    </div>
  );
}

function ConversationPreview({ draft }: { draft: StudioDraft }) {
  const rootByComment: number[] = [];
  draft.comments.forEach((comment, index) => { rootByComment[index] = comment.replyTo === null ? index : rootByComment[comment.replyTo]; });
  const rootIndices = rootByComment.filter((root, index) => root === index);
  const replyCount = draft.comments.length - rootIndices.length;
  const name = (index: number) => draft.personas.find((persona) => persona.id === draft.comments[index].personaId)?.name ?? "캐릭터";

  function commentCard(index: number) {
    const comment = draft.comments[index];
    return (
      <article id={`studio-comment-${index}`} className="scroll-mt-24 space-y-3 p-4 sm:p-5" aria-label={`댓글 ${index + 1}`}>
        <PersonaIdentity draft={draft} personaId={comment.personaId} />
        {comment.replyTo !== null ? <a href={`#studio-comment-${comment.replyTo}`} className="inline-block text-[13px] font-medium text-[var(--ui-muted)] underline-offset-4 hover:underline">↳ {name(comment.replyTo)} · 댓글 {comment.replyTo + 1}에 답글</a> : null}
        <p className="whitespace-pre-wrap break-words text-base font-normal leading-7">{comment.content}</p>
        <span className="block text-[13px] font-normal text-[var(--ui-muted)]">댓글 {index + 1}</span>
      </article>
    );
  }

  return (
    <div className="space-y-6" aria-label="캐릭터 대화 미리보기">
      <article className="space-y-5 rounded-xl border border-[var(--ui-border)] p-5 sm:p-6">
        <h3 className="break-words text-lg font-bold leading-relaxed">{draft.post.title}</h3>
        <PersonaIdentity draft={draft} personaId={draft.post.personaId} />
        <MediaPreview media={draft.source.media} />
        <p className="whitespace-pre-wrap break-words border-t border-[var(--ui-border)] pt-5 text-base font-normal leading-7">{draft.post.content}</p>
      </article>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-bold">댓글 전체 {draft.comments.length}개</h3>
        <span className="text-[13px] font-normal text-[var(--ui-muted)]">댓글 {rootIndices.length}개 · 대댓글 {replyCount}개</span>
      </div>
      <ol className="space-y-4">
        {rootIndices.map((root) => {
          const replies = draft.comments.map((_, index) => index).filter((index) => index !== root && rootByComment[index] === root);
          return <li key={root} className="overflow-hidden rounded-xl border border-[var(--ui-border)]">
            {commentCard(root)}
            {replies.length ? <ol className="ml-4 border-l-2 border-[var(--ui-border)] bg-[var(--ui-surface-muted)]/40 sm:ml-8">{replies.map((index) => <li key={index} className="border-t border-[var(--ui-border)]">{commentCard(index)}</li>)}</ol> : null}
          </li>;
        })}
      </ol>
    </div>
  );
}

export function AiStudio({ storageKey, generationAvailable }: { storageKey: string; generationAvailable: boolean }) {
  const [input, setInput] = useState(createStudioInput);
  const [draft, setDraft] = useState<StudioDraft | null>(null);
  const [pending, setPending] = useState<"generating" | "collecting" | "importing" | "copying" | "publishing" | "analyzing" | null>(null);
  const [view, setView] = useState<"conversation" | "edit">("conversation");
  const [sourceWarnings, setSourceWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busyRef = useRef(false);
  const seenSourceUrlsRef = useRef<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  function clearFeedback() {
    setError("");
    setNotice("");
  }

  function serializeWorkspace() {
    const workspace = parseStudioWorkspace({ version: 1, input, draft });
    const json = JSON.stringify(workspace, null, 2);
    if (new Blob([json]).size > MAX_FILE_BYTES) throw new Error("저장 내용이 100KB를 넘었습니다. 참고 내용이나 캐릭터 설명을 줄여 주세요.");
    return json;
  }

  function saveBrowser() {
    if (busyRef.current) return;
    clearFeedback();
    try {
      window.localStorage.setItem(storageKey, serializeWorkspace());
      setNotice("현재 입력과 초안을 이 브라우저에 저장했습니다.");
    } catch (cause) {
      setError(errorMessage(cause, "브라우저에 저장하지 못했습니다. JSON 파일로 내려받아 주세요."));
    }
  }

  function restoreBrowser() {
    if (busyRef.current) return;
    clearFeedback();
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) throw new Error("이 브라우저에 저장한 작업이 없습니다.");
      if (new Blob([raw]).size > MAX_FILE_BYTES) throw new Error("저장된 작업이 100KB를 초과합니다.");
      const workspace = parseStudioWorkspace(JSON.parse(raw));
      setInput(workspace.input);
      setDraft(workspace.draft);
      setView("conversation");
      setSourceWarnings([]);
      setNotice("브라우저에 저장했던 작업을 불러왔습니다.");
    } catch (cause) {
      setError(errorMessage(cause, "저장된 작업을 불러오지 못했습니다."));
    }
  }

  function downloadJson() {
    if (busyRef.current) return;
    clearFeedback();
    try {
      const url = URL.createObjectURL(new Blob([serializeWorkspace()], { type: "application/json;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "minion-ai-studio.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setNotice("작업 파일을 내려받았습니다. JSON 가져오기로 이어서 편집할 수 있습니다.");
    } catch (cause) {
      setError(errorMessage(cause, "파일을 내려받지 못했습니다."));
    }
  }

  async function importJson(file: File) {
    if (busyRef.current) return;
    busyRef.current = true;
    setPending("importing");
    clearFeedback();
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error("100KB 이하의 JSON 파일을 선택해 주세요.");
      const workspace = parseStudioWorkspace(JSON.parse(await file.text()));
      setInput(workspace.input);
      setDraft(workspace.draft);
      setView("conversation");
      setSourceWarnings([]);
      setNotice("파일에서 작업을 불러왔습니다. 브라우저 저장은 별도로 눌러 주세요.");
    } catch (cause) {
      setError(errorMessage(cause, "미니언 스튜디오에서 저장한 JSON 파일을 선택해 주세요."));
    } finally {
      busyRef.current = false;
      setPending(null);
      if (importRef.current) importRef.current.value = "";
    }
  }

  async function copyMarkdown() {
    if (!draft || busyRef.current) return;
    busyRef.current = true;
    setPending("copying");
    clearFeedback();
    try {
      if (!navigator.clipboard?.writeText) throw new Error("이 브라우저에서는 클립보드를 사용할 수 없습니다. JSON 파일로 저장해 주세요.");
      await navigator.clipboard.writeText(studioDraftMarkdown(parseStudioDraft(draft)));
      setNotice("AI 캐릭터 표시와 출처가 포함된 초안을 복사했습니다.");
    } catch (cause) {
      setError(errorMessage(cause, "클립보드 복사에 실패했습니다. 브라우저 권한을 확인해 주세요."));
    } finally {
      busyRef.current = false;
      setPending(null);
    }
  }

  async function collectSource(url: string) {
    if (busyRef.current || !generationAvailable) return;
    busyRef.current = true;
    setPending("collecting");
    clearFeedback();
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 125_000);
    try {
      const excludeUrls = [...seenSourceUrlsRef.current];
      if (!url && input.sourceUrl) {
        try {
          excludeUrls.push(normalizeStudioSourceUrl(input.sourceUrl));
        } catch { /* A manually entered source URL does not block automatic search. */ }
      }
      const response = await fetch("/api/admin/ai-studio/source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, ...(!url ? { excludeUrls: [...new Set(excludeUrls)].slice(-20) } : {}) }),
        signal: controller.signal,
      });
      let result: SourceImportResult;
      try {
        result = await response.json() as SourceImportResult;
      } catch {
        throw new Error("소재를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
      if (!result.ok) throw new Error(result.error || "소재를 가져오지 못했습니다.");
      if (!response.ok) throw new Error("소재를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.");
      const source = result.source;
      const checked = parseStudioInput({ ...createStudioInput(), topic: source.title, sourceUrl: source.url, facts: source.facts, media: source.media });
      if (!Array.isArray(source.warnings) || source.warnings.some((warning) => typeof warning !== "string")) throw new Error("가져온 소재의 형식이 올바르지 않습니다. 다시 시도해 주세요.");
      seenSourceUrlsRef.current = [...seenSourceUrlsRef.current.filter((seen) => seen !== checked.sourceUrl), checked.sourceUrl].slice(-20);
      setInput((current) => ({ ...current, topic: checked.topic, sourceUrl: checked.sourceUrl, facts: checked.facts, media: checked.media, mediaContext: "", mediaReviewed: false }));
      setSourceWarnings(source.warnings.slice(0, 8).map((warning) => warning.slice(0, 500)));
      setNotice("소재를 가져왔습니다. 출처와 참고 내용을 확인한 뒤 대화를 생성해 주세요.");
    } catch (cause) {
      setError(controller.signal.aborted
        ? "소재를 가져오는 시간이 초과되었습니다. 입력 내용은 유지됩니다. URL을 바꾸거나 참고 내용을 직접 입력해 주세요."
        : errorMessage(cause, "소재를 가져오지 못했습니다. 기존 입력은 유지됩니다."));
    } finally {
      window.clearTimeout(timeout);
      abortRef.current = null;
      busyRef.current = false;
      setPending(null);
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || !generationAvailable) return;
    clearFeedback();
    let request;
    try {
      request = parseStudioInput(input);
    } catch (cause) {
      setError(errorMessage(cause, "입력 내용을 확인해 주세요."));
      return;
    }
    busyRef.current = true;
    setPending("generating");
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 55_000);
    try {
      const response = await fetch("/api/admin/ai-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      let result: StudioGenerateResult;
      try {
        result = await response.json() as StudioGenerateResult;
      } catch {
        throw new Error("생성 결과를 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
      if (!result.ok) throw new Error(result.error || "초안을 생성하지 못했습니다.");
      if (!response.ok) throw new Error("초안을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      const nextDraft = parseStudioDraft(result.draft);
      setDraft(nextDraft);
      setView("conversation");
      setNotice(`게시글 1개와 댓글·대댓글 ${nextDraft.comments.length}개를 만들었습니다. 내용을 검토하고 저장해 주세요.`);
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (cause) {
      setError(controller.signal.aborted
        ? "생성이 55초 안에 끝나지 않았습니다. 기존 초안은 유지됩니다. 잠시 후 다시 시도해 주세요."
        : errorMessage(cause, "초안 생성에 실패했습니다. 기존 초안은 유지됩니다."));
    } finally {
      window.clearTimeout(timeout);
      abortRef.current = null;
      busyRef.current = false;
      setPending(null);
    }
  }

  function updatePersona<K extends keyof Omit<StudioPersona, "id">>(id: string, field: K, value: StudioPersona[K]) {
    setInput((current) => ({ ...current, personas: current.personas.map((persona) => persona.id === id ? { ...persona, [field]: value } : persona) }));
  }

  function addPersona() {
    if (busyRef.current || input.personas.length >= STUDIO_LIMITS.personas) return;
    const id = `p-${crypto.randomUUID()}`;
    setInput((current) => {
      let number = current.personas.length + 1;
      while (current.personas.some((persona) => persona.name === `새 캐릭터 ${number}`)) number += 1;
      return { ...current, personas: [...current.personas, {
        id,
        name: `새 캐릭터 ${number}`,
        team: "중립",
        authorType: "member",
        perspective: "확인한 경기 내용을 바탕으로 다른 관점을 제시한다.",
        voice: "펨코 롤 게시판처럼 짧은 반말을 쓴다. ㅋㅋ, ㄹㅇ 같은 표현은 어울릴 때만 쓰고 의견에 따라 공감하거나 반박한다.",
      }] };
    });
  }

  function removePersona(id: string) {
    if (busyRef.current || input.personas.length <= 3) return;
    setInput((current) => {
      const personas = current.personas.filter((persona) => persona.id !== id);
      return { ...current, personas, authorId: current.authorId === id ? personas[0].id : current.authorId };
    });
  }

  function resetPersonas() {
    if (busyRef.current) return;
    const defaults = createStudioInput();
    setInput((current) => ({ ...current, personas: defaults.personas, authorId: defaults.authorId, situation: defaults.situation }));
    clearFeedback();
    setNotice("기본 캐릭터 A~F 6명과 대화 상황을 적용했습니다. 소재와 기존 초안은 유지됩니다.");
  }

  const draftPersonaName = (id: string) => draft?.personas.find((persona) => persona.id === id)?.name ?? id;

  return (
    <div className="space-y-6 text-[var(--ui-ink)]" aria-busy={pending !== null}>
      <section className={`${panelClass} !space-y-3`} aria-label="작업 저장">
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!pending} onClick={saveBrowser} className={buttonClass}>브라우저에 저장</button>
          <button type="button" disabled={!!pending} onClick={restoreBrowser} className={buttonClass}>저장한 작업 불러오기</button>
          <button type="button" disabled={!!pending} onClick={downloadJson} className={buttonClass}>JSON 내려받기</button>
          <button type="button" disabled={!!pending} onClick={() => importRef.current?.click()} className={buttonClass}>JSON 가져오기</button>
          <input ref={importRef} type="file" accept=".json,application/json" className="hidden" aria-label="작업 JSON 파일" disabled={!!pending} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importJson(file); }} />
        </div>
        <p className="text-base font-normal leading-relaxed text-[var(--ui-muted)]">저장 버튼을 눌러 작업을 보관하세요. 불러오기와 가져오기는 현재 편집 내용을 바꿉니다.</p>
      </section>

      <div role="alert" aria-atomic="true" className={error ? "rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-base leading-relaxed text-red-700 dark:text-red-300" : "sr-only"}>{error}</div>
      <div role="status" aria-live="polite" aria-atomic="true" className={notice || pending ? "rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-4 text-base leading-relaxed" : "sr-only"}>
        {pending === "generating" ? "캐릭터가 게시글과 댓글을 작성하고 있습니다. 최대 55초 정도 걸릴 수 있습니다." : pending === "collecting" ? "출처 페이지와 웹 검색에서 소재를 확인하고 있습니다. 최대 55초 정도 걸릴 수 있습니다." : pending === "importing" ? "작업 파일을 불러오고 있습니다." : pending === "copying" ? "초안을 복사하고 있습니다." : notice}
      </div>

      <form onSubmit={generate}>
        <fieldset disabled={!!pending} className="min-w-0 space-y-6">
          <legend className="sr-only">초안 생성 설정</legend>
          <section className={panelClass} aria-labelledby="studio-source-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="studio-source-title" className="home-section-title text-xl">1. 이야기할 소재</h2>
              <button type="button" disabled={!!pending || !generationAvailable} onClick={() => void collectSource("")} className={buttonClass}>웹에서 자동 가져오기</button>
            </div>
            <p className="text-base font-normal leading-relaxed text-[var(--ui-muted)]">공개 페이지의 본문이나 웹 검색 요약을 가져옵니다. 영상·댓글 전체 수집은 아닙니다.</p>
            <p className="text-base font-normal leading-relaxed text-[var(--ui-muted)]">자동으로 소재를 찾거나 원하는 기사·영상·SNS·커뮤니티 주소를 넣어 검색하세요. 완료되면 현재 주제와 참고 내용을 바꿉니다. 소재 검색과 대화 생성에는 OpenAI API 사용 요금이 발생합니다.</p>
            <Field label="출처 URL · 선택">
              <input type="url" maxLength={2_000} value={input.sourceUrl} onChange={(event) => { setInput({ ...input, sourceUrl: event.target.value, media: [], mediaContext: "", mediaReviewed: false }); setSourceWarnings([]); }} placeholder="https://…" aria-describedby="studio-source-help" className={fieldClass} />
            </Field>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={!!pending || !generationAvailable || !input.sourceUrl.trim()} onClick={() => void collectSource(input.sourceUrl.trim())} className={buttonClass}>이 URL 가져오기</button>
              <p id="studio-source-help" className="flex-1 basis-72 text-base font-normal leading-relaxed text-[var(--ui-muted)]">공개된 HTTPS 주소를 지원합니다. 검색에서 확인할 수 없는 자료는 참고 내용을 직접 입력해 주세요.</p>
            </div>
            {sourceWarnings.length ? <aside aria-label="가져온 소재 확인 사항" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4"><ul className="list-disc space-y-2 pl-5 text-base font-normal leading-relaxed">{sourceWarnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></aside> : null}
            <Field label="주제">
              <input required maxLength={STUDIO_LIMITS.topic} value={input.topic} onChange={(event) => setInput({ ...input, topic: event.target.value })} placeholder="예: 오늘 경기에서 갈린 바텀 밴픽 평가" className={fieldClass} />
            </Field>
            <Field label="참고 내용과 이야기할 쟁점">
              <textarea required rows={7} maxLength={STUDIO_LIMITS.facts} value={input.facts} onChange={(event) => setInput({ ...input, facts: event.target.value })} placeholder={"확인된 사실: 경기 결과, 밴픽, 실제 장면 등\n이야기할 쟁점: 어떤 선택이 좋았는지, 다르게 볼 부분 등\n확인되지 않은 내용은 별도로 표시해 주세요."} className={`${fieldClass} resize-y`} />
            </Field>
            <p className="text-right text-[13px] font-normal text-[var(--ui-muted)]">{input.facts.length.toLocaleString()} / {STUDIO_LIMITS.facts.toLocaleString()}자</p>
            <MediaPanel input={input} onChange={setInput} onBusy={busy => { busyRef.current = busy; setPending(busy ? "analyzing" : null); }} />
          </section>

          <section className={panelClass} aria-labelledby="studio-personas-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="studio-personas-title" className="home-section-title text-xl">2. 캐릭터 설정</h2>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!!pending} onClick={resetPersonas} className={buttonClass}>기본 6명 적용</button>
                <button type="button" disabled={!!pending || input.personas.length >= STUDIO_LIMITS.personas} onClick={addPersona} className={buttonClass}>캐릭터 추가 · {input.personas.length}/{STUDIO_LIMITS.personas}</button>
              </div>
            </div>
            <p className="text-base font-normal leading-relaxed text-[var(--ui-muted)]">하온부·chovyyyy·민서아빠·마구유시·비로그인 유저·야자와 니코, 여섯 캐릭터의 기본 설정입니다. 서로 다른 관심사와 말투로 반응하며 매번 전원이 등장하지는 않습니다.</p>
            <p className="text-base font-normal leading-relaxed text-[var(--ui-muted)]">민서아빠는 T1을 지키려 하고, 비로그인 유저는 지킬 팀 없이 반대편을 긁습니다. 설정을 바꾸면 다음 초안부터 반영됩니다. 예전 3인 저장 파일도 그대로 불러올 수 있습니다.</p>
            <details className="rounded-xl border border-[var(--ui-border)] p-4">
              <summary className="cursor-pointer text-sm font-medium">공통 말투 설정과 참고 자료</summary>
              <div className="mt-4 space-y-5">
                <ul className="list-disc space-y-2 pl-5 text-base font-normal leading-relaxed">{STUDIO_STYLE_SUMMARY.map((summary) => <li key={summary}>{summary}</li>)}</ul>
                <div className="space-y-4">{STUDIO_STYLE_SOURCES.map((source) => <div key={source.url} className="space-y-2 border-t border-[var(--ui-border)] pt-4"><a href={source.url} target="_blank" rel="noreferrer noopener" className="text-base font-medium leading-relaxed underline underline-offset-4">{source.label}</a><p className="text-base font-normal leading-relaxed text-[var(--ui-muted)]">{source.note}</p></div>)}</div>
              </div>
            </details>
            <Field label="이번 대화 상황">
              <textarea rows={3} maxLength={STUDIO_LIMITS.situation} value={input.situation} onChange={(event) => setInput({ ...input, situation: event.target.value })} placeholder="예: HLE 패배 뒤 마구유시는 선수를 격려하고, 야자와 니코는 확인된 장면을 짚는다. 비로그인 유저는 짧게 반대 의견을 던진다." className={`${fieldClass} resize-y`} />
            </Field>
            <div className="grid gap-4 lg:grid-cols-3">
              {input.personas.map((persona, index) => (
                <article key={persona.id} className="min-w-0 space-y-4 rounded-xl border border-[var(--ui-border)] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3"><PersonaAvatar persona={persona} index={index} /><h3 className="text-base font-bold leading-relaxed">{PERSONA_ROLES[persona.id] ? `${PERSONA_ROLES[persona.id].letter} · ${PERSONA_ROLES[persona.id].label}` : `캐릭터 ${String.fromCharCode(65 + index)}`}</h3></div>
                    <button type="button" disabled={!!pending || input.personas.length <= 3} onClick={() => removePersona(persona.id)} className="min-h-8 shrink-0 px-2 text-sm font-medium text-[var(--ui-muted)] hover:text-[var(--ui-ink)] disabled:cursor-not-allowed disabled:opacity-40" aria-label={`${persona.name || "캐릭터"} 삭제`}>삭제</button>
                  </div>
                  <div className="flex flex-wrap gap-2"><AiBadge guest={persona.authorType === "guest"} /></div>
                  <Field label="이름"><input required maxLength={STUDIO_LIMITS.personaName} value={persona.name} onChange={(event) => updatePersona(persona.id, "name", event.target.value)} className={fieldClass} /></Field>
                  <Field label="응원팀"><input required maxLength={40} value={persona.team} onChange={(event) => updatePersona(persona.id, "team", event.target.value)} className={fieldClass} /></Field>
                  <Field label="관점"><textarea required rows={4} maxLength={STUDIO_LIMITS.personaDetail} value={persona.perspective} onChange={(event) => updatePersona(persona.id, "perspective", event.target.value)} className={`${fieldClass} resize-y`} /></Field>
                  <Field label="말투"><textarea required rows={3} maxLength={STUDIO_LIMITS.personaDetail} value={persona.voice} onChange={(event) => updatePersona(persona.id, "voice", event.target.value)} className={`${fieldClass} resize-y`} /></Field>
                </article>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-[var(--ui-border)] pt-5">
              <span className="text-sm font-medium">게시글 작성 캐릭터</span>
              <FilterDropdown ariaLabel="게시글 작성 캐릭터" options={input.personas.map((persona) => ({ value: persona.id, label: persona.name || "이름을 입력해 주세요" }))} selected={input.authorId} onSelect={(authorId) => setInput({ ...input, authorId })} disabled={!!pending} triggerTypography="ui" triggerClassName="border border-[var(--ui-border)] !px-3" />
              <span className="text-sm font-medium">댓글·대댓글 수</span>
              <FilterDropdown ariaLabel="댓글과 대댓글 수" options={COMMENT_OPTIONS} selected={String(input.commentCount)} onSelect={(value) => setInput({ ...input, commentCount: Number(value) })} disabled={!!pending} triggerTypography="ui" triggerClassName="border border-[var(--ui-border)] !px-3" />
              <button type="submit" disabled={!!pending || !generationAvailable} className={`${buttonClass} !border-[var(--ui-ink)] !bg-[var(--ui-ink)] !text-[var(--ui-surface)] sm:ml-auto`}>{pending === "generating" ? "초안 생성 중…" : draft ? `새 대화 생성 · 댓글 ${input.commentCount}개` : `게시글 1개 + 댓글 ${input.commentCount}개 생성`}</button>
            </div>
            {draft ? <p className="text-base font-normal leading-relaxed text-[var(--ui-muted)]">새 초안이 완성되면 아래 초안을 바꿉니다. 현재 편집본을 남기려면 먼저 저장하세요.</p> : null}
            {!generationAvailable ? <p className="rounded-lg bg-[var(--ui-surface-muted)] p-4 text-base leading-relaxed">AI 연결이 아직 설정되지 않아 소재 검색과 대화 생성을 사용할 수 없습니다. 캐릭터 설정과 작업 저장은 사용할 수 있습니다.</p> : null}
          </section>
        </fieldset>
      </form>

      <section ref={previewRef} className={`${panelClass} scroll-mt-24`} aria-labelledby="studio-preview-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="studio-preview-title" className="home-section-title text-xl">3. 초안 검토</h2>
          <div className="flex flex-wrap gap-2">
            <div role="group" aria-label="초안 표시 방식" className="flex rounded-lg border border-[var(--ui-border)] p-1">
              {([{ value: "conversation", label: "대화 보기" }, { value: "edit", label: "내용 수정" }] as const).map((option) => <button key={option.value} type="button" disabled={!!pending || !draft} aria-pressed={view === option.value} onClick={() => setView(option.value)} className={`min-h-8 rounded-md px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50 ${view === option.value ? "bg-[var(--ui-ink)] text-[var(--ui-surface)]" : "text-[var(--ui-muted)] hover:bg-[var(--ui-surface-muted)]"}`}>{option.label}</button>)}
            </div>
            <button type="button" disabled={!!pending || !draft} onClick={() => void copyMarkdown()} className={buttonClass}>초안 복사</button>
          </div>
        </div>
        {draft ? (
          <fieldset disabled={!!pending} className="min-w-0 space-y-5">
            <legend className="sr-only">생성된 게시글과 댓글 편집</legend>
            <p className="text-base font-normal leading-relaxed text-[var(--ui-muted)]">AI 캐릭터가 만든 대화입니다. 댓글 묶음을 읽어 보고, 내용을 바꾸려면 ‘내용 수정’을 눌러 주세요.</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] font-normal text-[var(--ui-muted)]">
              <span>생성: {new Date(draft.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</span>
              <span>주제: {draft.source.topic}</span>
            </div>
            {view === "conversation" ? <ConversationPreview draft={draft} /> : <>
            <article className="min-w-0 space-y-4 rounded-xl border border-[var(--ui-border)] p-4 sm:p-5">
              <PersonaIdentity draft={draft} personaId={draft.post.personaId} />
              <Field label="게시글 제목"><input required maxLength={STUDIO_LIMITS.title} value={draft.post.title} onChange={(event) => setDraft({ ...draft, post: { ...draft.post, title: event.target.value } })} className={fieldClass} /></Field>
              <Field label="게시글 본문"><textarea required rows={8} maxLength={STUDIO_LIMITS.body} value={draft.post.content} onChange={(event) => setDraft({ ...draft, post: { ...draft.post, content: event.target.value } })} className={`${fieldClass} resize-y`} /></Field>
            </article>
            <div className="space-y-3">
              <h3 className="text-lg font-bold">댓글 {draft.comments.length}개</h3>
              {draft.comments.map((comment, index) => (
                <article key={`${draft.id}-${index}`} className={`min-w-0 space-y-3 rounded-xl border border-[var(--ui-border)] p-4 ${comment.replyTo === null ? "" : "ml-4 border-l-4 sm:ml-8"}`}>
                  <PersonaIdentity draft={draft} personaId={comment.personaId} />
                  <span className="block text-[13px] font-normal text-[var(--ui-muted)]">{comment.replyTo === null ? `댓글 ${index + 1}` : `댓글 ${index + 1} · ${draftPersonaName(draft.comments[comment.replyTo].personaId)}의 댓글 ${comment.replyTo + 1}에 답글`}</span>
                  <Field label={`댓글 ${index + 1} 내용`}><textarea required rows={3} maxLength={STUDIO_LIMITS.comment} value={comment.content} onChange={(event) => setDraft({ ...draft, comments: draft.comments.map((item, commentIndex) => commentIndex === index ? { ...item, content: event.target.value } : item) })} className={`${fieldClass} resize-y`} /></Field>
                </article>
              ))}
            </div>
            </>}
            {draft.reviewNotes.length ? <aside className="space-y-3 rounded-xl bg-[var(--ui-surface-muted)] p-4"><h3 className="text-lg font-bold">검토 메모</h3><ul className="list-disc space-y-2 pl-5 text-base font-normal leading-relaxed">{draft.reviewNotes.map((note, index) => <li key={index}>{note}</li>)}</ul></aside> : null}
            <details className="rounded-xl border border-[var(--ui-border)] p-4">
              <summary className="cursor-pointer text-sm font-medium">이 초안에 사용한 참고 내용</summary>
              <div className="mt-4 space-y-3 text-base font-normal leading-relaxed">
                {draft.source.sourceUrl ? <a href={draft.source.sourceUrl} target="_blank" rel="noreferrer noopener" className="break-all underline underline-offset-4">{draft.source.sourceUrl}</a> : null}
                <p className="whitespace-pre-wrap break-words">{draft.source.facts}</p>
              </div>
            </details>
          </fieldset>
        ) : <p className="py-8 text-center text-base font-normal leading-relaxed text-[var(--ui-muted)]">소재와 캐릭터를 정하면 게시글과 댓글이 여기에 표시됩니다.</p>}
      </section>
      <PublicationPanel draft={draft} disabled={!!pending} onBusy={busy => { busyRef.current = busy; setPending(busy ? "publishing" : null); }} />
    </div>
  );
}
