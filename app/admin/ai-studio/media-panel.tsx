"use client";
import { useState } from "react";
import type { StudioInput } from "@/lib/community/ai-studio";
import { extractStudioMedia, studioMediaNodes, parseStudioMedia } from "@/lib/community/ai-studio-media";
import { PostContentViewer } from "@/components/community/editor/post-content-viewer";
const field = "w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 text-base font-normal";
export function MediaPreview({ media }: { media: StudioInput["media"] }) { return <PostContentViewer content={JSON.stringify({ type: "doc", content: studioMediaNodes(media) })} />; }
export function MediaPanel({ input, onChange, onBusy }: { input: StudioInput; onChange: (value: StudioInput) => void; onBusy: (busy: boolean) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const analysisMedia = input.media?.length ? input.media : extractStudioMedia("", input.sourceUrl);
  async function analyze() {
    setBusy(true); onBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/ai-studio/analyze", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ media: analysisMedia, reference: `${input.topic}\n${input.facts}` }) });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error ?? "미디어 분석에 실패했습니다.");
      onChange({ ...input, media: analysisMedia, mediaContext: result.context, mediaReviewed: true }); setMessage(`${result.method} 분석 완료. ${Array.isArray(result.warnings) ? result.warnings.join(" ") : ""}`);
    } catch (e) { setMessage(e instanceof Error ? e.message : "미디어 분석에 실패했습니다."); }
    finally { setBusy(false); onBusy(false); }
  }
  function add() {
    try {
      const parsed = extractStudioMedia("", url);
      if (!parsed.length) { const pathname = new URL(url).pathname; if (/\.(png|jpe?g|gif|webp)$/i.test(pathname)) parsed.push({ kind: "image", url }); else if (/\.(mp4|webm)$/i.test(pathname)) parsed.push({ kind: "video", url }); }
      if (!parsed.length) throw new Error("유튜브·X·인스타그램 게시물 또는 이미지·영상 파일 주소를 입력해 주세요.");
      const media = [...(input.media ?? []), ...parsed].filter((m, i, all) => all.findIndex(n => n.url === m.url) === i);
      if (media.length > 8) throw new Error("미디어는 최대 8개입니다.");
      onChange({ ...input, media: parseStudioMedia(media), mediaContext: "", mediaReviewed: false }); setUrl(""); setMessage("");
    } catch (e) { setMessage(e instanceof Error ? e.message : "주소를 확인해 주세요."); }
  }
  return <div className="space-y-4 border-t border-[var(--ui-border)] pt-5">
    <h3 className="text-lg font-bold">원문 미디어와 맥락</h3>
    <p className="text-base leading-relaxed">유튜브·X·인스타그램·이미지를 분석할 수 있습니다. SNS는 공개 본문과 접근 가능한 사진·영상을 함께 확인합니다. 영상·SNS는 게시글에 임베드하고 이미지·영상 파일은 첨부합니다.</p>
    {(input.media ?? []).map((m, index) => <div key={m.url} className="flex items-center gap-3"><a href={m.url} target="_blank" rel="noreferrer" className="min-w-0 break-all text-sm font-medium underline">{m.kind} · {m.url}</a><button type="button" className="shrink-0 p-2 text-sm font-medium" onClick={() => onChange({ ...input, media: input.media?.filter((_, i) => i !== index), mediaReviewed: false })}>제외</button></div>)}
    <div className="flex flex-wrap gap-2"><input type="url" aria-label="추가할 미디어 주소" value={url} onChange={e => setUrl(e.target.value)} className={field} placeholder="유튜브·SNS·이미지·영상 주소" /><button type="button" disabled={busy} onClick={add} className="rounded-lg border border-[var(--ui-border)] px-3 py-2 text-sm font-medium">미디어 추가</button><button type="button" disabled={busy || !analysisMedia.length} onClick={() => void analyze()} className="rounded-lg border border-[var(--ui-border)] px-3 py-2 text-sm font-medium disabled:opacity-50">{busy ? "본문·사진·영상 분석 중…" : "미디어·SNS 자동 분석"}</button></div>
    {message ? <p role="status" className="text-base leading-relaxed">{message}</p> : null}
    <label className="block space-y-2"><span className="text-sm font-medium">실제 원문·영상 맥락</span><textarea rows={5} maxLength={6000} value={input.mediaContext ?? ""} onChange={e => onChange({ ...input, mediaContext: e.target.value, mediaReviewed: false })} className={field} placeholder="예: 강소라가 무협풍으로 지난 월즈 페이커 소개 멘트를 재현하는 장면. 실제 팬인지 검증하는 영상은 아님." /></label>
    {input.media?.length ? <details><summary className="cursor-pointer text-sm font-medium">첨부 미리보기</summary><MediaPreview media={input.media} /></details> : null}
  </div>;
}
