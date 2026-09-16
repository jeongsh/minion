"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_STUDIO_PERSONAS, type StudioDraft } from "@/lib/community/ai-studio";

const button = "rounded-lg border border-[var(--ui-border)] px-3 py-2 text-sm font-medium disabled:opacity-50";
const field = "w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 text-base font-normal";
type QueueRow = { id: string; post_id: string; ordinal: number; persona_id: string; content: string; due_at: string; status: string; error: string | null };
type InboxRow = { id: string; post_id: string; status: string; response_persona: string | null; response_text: string | null; community_posts: { title: string } | null };
type Dashboard = { campaigns: { post_id: string; state: string; community_posts: { title: string } | null }[]; queue: QueueRow[]; inbox: InboxRow[]; settings: { watch_enabled: boolean } };
const name = (id: string | null) => DEFAULT_STUDIO_PERSONAS.find(p => p.id === id)?.name ?? "캐릭터";
const stateName: Record<string, string> = { active: "진행", paused: "일시정지", cancelled: "취소", scheduled: "예약", published: "게시 완료", failed: "실패" };
async function action(body: unknown) {
  const response = await fetch("/api/admin/ai-studio/publication", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error ?? "요청에 실패했습니다.");
  return result as { postId?: string };
}
function QueueEditor({ row, busy, run }: { row: QueueRow; busy: boolean; run: (v: unknown) => Promise<void> }) {
  const [text, setText] = useState(row.content);
  const [due, setDue] = useState(() => { const date = new Date(row.due_at); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); });
  return <details className="rounded-lg border border-[var(--ui-border)] p-3">
    <summary className="cursor-pointer text-sm font-medium">{row.ordinal + 1}. {name(row.persona_id)} · {stateName[row.status]} · {new Date(row.due_at).toLocaleString("ko-KR")}</summary>
    <div className="mt-3 space-y-3">
      <textarea aria-label="예약 댓글 내용" className={field} value={text} maxLength={600} onChange={e => setText(e.target.value)} disabled={busy || ["published", "cancelled"].includes(row.status)} />
      {row.error ? <p className="text-base text-red-400">{row.error}</p> : null}
      {!["published", "cancelled"].includes(row.status) ? <div className="flex flex-wrap gap-2">
        <input type="datetime-local" aria-label="댓글 예약 시간" className={field} value={due} onChange={e => setDue(e.target.value)} />
        <button className={button} disabled={busy || !due || !Number.isFinite(Date.parse(due))} onClick={() => void run({ action: "edit", postId: row.post_id, queueId: row.id, text, dueAt: new Date(due).toISOString() })}>예약 수정</button>
        <button className={button} disabled={busy} onClick={() => void run({ action: "cancel_item", postId: row.post_id, queueId: row.id })}>이 댓글 취소</button>
      </div> : null}
    </div>
  </details>;
}
function ReplyEditor({ row, busy, run }: { row: InboxRow; busy: boolean; run: (v: unknown) => Promise<void> }) {
  const [text, setText] = useState(row.response_text ?? "");
  return <article className="space-y-3 rounded-xl border border-[var(--ui-border)] p-4">
    <a href={`/community/post/${row.post_id}`} target="_blank" rel="noreferrer" className="text-base font-bold underline">{row.community_posts?.title ?? "대화 보기"}</a>
    <p className="text-base">{row.status === "drafted" ? `${name(row.response_persona)} 답변 후보` : "실제 유저 참여 · 관리자 검토 대기"}</p>
    {row.status === "drafted" ? <textarea aria-label="승인할 답변 내용" className={field} value={text} maxLength={380} onChange={e => setText(e.target.value)} disabled={busy} /> : row.response_text ? <p className="text-base">{row.response_text}</p> : null}
    <div className="flex flex-wrap gap-2">
      <button className={button} disabled={busy} onClick={() => void run({ action: "draft_reply", eventId: row.id })}>답변 후보 생성</button>
      {row.status === "drafted" ? <button className={button} disabled={busy || !text.trim()} onClick={() => void run({ action: "approve_reply", eventId: row.id, text })}>승인 · 2분 후 답변</button> : null}
      <button className={button} disabled={busy} onClick={() => void run({ action: "dismiss_reply", eventId: row.id })}>답변 없이 닫기</button>
    </div>
  </article>;
}
export function PublicationPanel({ draft, disabled, onBusy }: { draft: StudioDraft | null; disabled: boolean; onBusy: (busy: boolean) => void }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [published, setPublished] = useState("");
  const refresh = useCallback(async () => {
    try { const response = await fetch("/api/admin/ai-studio/publication", { cache: "no-store" }); const result = await response.json(); if (!response.ok || !result.ok) throw new Error(result.error); setData(result); }
    catch (e) { setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다."); }
  }, []);
  useEffect(() => { const initial = setTimeout(() => void refresh(), 0); const timer = setInterval(() => void refresh(), 30000); return () => { clearTimeout(initial); clearInterval(timer); }; }, [refresh]);
  async function run(value: unknown) {
    if (busy || disabled) return;
    setBusy(true); onBusy(true); setError(""); setNotice("");
    try { const result = await action(value); if (result.postId) { setPublished(result.postId); setNotice("게시글을 올리고 댓글을 예약했습니다. 실제 유저가 참여하면 예약이 일시정지됩니다."); } else setNotice("변경 사항을 저장했습니다."); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "저장에 실패했습니다."); }
    finally { setBusy(false); onBusy(false); }
  }
  return <fieldset disabled={busy || disabled} className="min-w-0"><section className="space-y-5 rounded-2xl border border-[var(--ui-border)] p-5 sm:p-6" aria-labelledby="publication-title">
    <h2 id="publication-title" className="home-section-title text-xl">4. 게시와 댓글 예약</h2>
    <p className="text-base leading-relaxed">게시글은 바로 올라갑니다. 첫 댓글은 2~5분 뒤, 다음 댓글은 3~10분 간격으로 달립니다. 브라우저를 닫아도 예약은 유지됩니다. 댓글에는 별도의 AI 캐릭터 문구를 붙이지 않습니다.</p>
    <button className={`${button} bg-[var(--ui-ink)] text-[var(--ui-surface)]`} disabled={busy || disabled || !draft} onClick={() => void run({ action: "publish", draft })}>{busy ? "처리 중…" : "검토한 초안 게시 + 댓글 예약"}</button>
    {error ? <p role="alert" className="whitespace-pre-wrap text-base text-red-400">{error}</p> : null}
    {notice ? <p role="status" className="text-base">{notice}</p> : null}
    {published ? <a className="block text-base underline" href={`/community/post/${published}`} target="_blank" rel="noreferrer">게시된 글 보기</a> : null}
    <div className="flex flex-wrap items-center gap-3 border-t border-[var(--ui-border)] pt-5">
      <h3 className="text-lg font-bold">예약 관리</h3>
      <button className={button} disabled={busy} onClick={() => void refresh()}>새로고침</button>
      <button className={button} disabled={busy} onClick={() => void run({ action: "pause_all" })}>모든 예약 일시정지</button>
    </div>
    {data?.campaigns.map(c => <details key={c.post_id} className="space-y-3 rounded-xl border border-[var(--ui-border)] p-4">
      <summary className="cursor-pointer text-base font-medium">{c.community_posts?.title ?? "게시글"} · {stateName[c.state]}</summary>
      <div className="mt-3 flex flex-wrap gap-2"><a href={`/community/post/${c.post_id}`} target="_blank" rel="noreferrer" className={button}>게시글 보기</a>{([['pause', '일시정지'], ['resume', '예약 재개'], ['cancel', '남은 예약 취소']] as const).map(([act, label]) => <button key={act} className={button} disabled={busy || c.state === "cancelled"} onClick={() => void run({ action: act, postId: c.post_id })}>{label}</button>)}</div>
      {data.queue.filter(q => q.post_id === c.post_id).sort((a, b) => a.ordinal - b.ordinal).map(q => <QueueEditor key={`${q.id}:${q.content}:${q.due_at}`} row={q} busy={busy} run={run} />)}
    </details>)}
    {data && !data.campaigns.length ? <p className="text-base text-[var(--ui-muted)]">예약된 대화가 없습니다.</p> : null}
    <h3 className="border-t border-[var(--ui-border)] pt-5 text-lg font-bold">실제 유저 답변 검토</h3>
    <p className="text-base leading-relaxed">실제 유저가 참여하면 기존 댓글 예약을 멈춥니다. 답변 후보를 검토해 한 명의 답변만 승인할 수 있습니다. 대화가 바뀌면 다시 생성해야 합니다.</p>
    {data ? <label className="flex items-center gap-2 text-base"><input type="checkbox" checked={data.settings.watch_enabled} disabled={busy} onChange={e => void run({ action: "watch", enabled: e.target.checked })} />새 참여를 검토 목록에 모으기</label> : null}
    {data?.inbox.map(row => <ReplyEditor key={`${row.id}:${row.response_text}`} row={row} busy={busy} run={run} />)}
    {data && !data.inbox.length ? <p className="text-base text-[var(--ui-muted)]">검토할 새 참여가 없습니다.</p> : null}
  </section></fieldset>;
}
