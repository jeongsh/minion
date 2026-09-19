"use client";
import { useCallback, useEffect, useState } from "react";
import { DEFAULT_STUDIO_PERSONAS, type StudioDraft } from "@/lib/community/ai-studio";

const button = "rounded-lg border border-[var(--ui-border)] px-3 py-2 text-sm font-medium disabled:opacity-50";
const field = "w-full rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 text-base font-normal";
type QueueRow = { id: string; post_id: string; ordinal: number; persona_id: string; content: string; due_at: string; status: string; error: string | null };
type InboxRow = { id: string; post_id: string; status: string; attempts: number; last_error: string | null; response_persona: string | null; response_text: string | null; community_posts: { title: string } | null };
type Dashboard = { campaigns: { post_id: string; state: string; auto_reply_enabled: boolean; community_posts: { title: string } | null }[]; queue: QueueRow[]; inbox: InboxRow[]; settings: { watch_enabled: boolean } };
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
  const [due, setDue] = useState(() => { const date = new Date(row.due_at); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 19); });
  return <details className="rounded-lg border border-[var(--ui-border)] p-3">
    <summary className="cursor-pointer text-sm font-medium">{row.ordinal + 1}. {name(row.persona_id)} · {stateName[row.status]} · {new Date(row.due_at).toLocaleString("ko-KR")}</summary>
    <div className="mt-3 space-y-3">
      <textarea aria-label="예약 댓글 내용" className={field} value={text} maxLength={600} onChange={e => setText(e.target.value)} disabled={busy || ["published", "cancelled"].includes(row.status)} />
      {row.error ? <p className="text-base text-red-400">{row.error}</p> : null}
      {!["published", "cancelled"].includes(row.status) ? <div className="flex flex-wrap gap-2">
        <input type="datetime-local" step={1} aria-label="댓글 예약 시간" className={field} value={due} onChange={e => setDue(e.target.value)} />
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
      {row.status === "drafted" ? <button className={button} disabled={busy || !text.trim()} onClick={() => void run({ action: "approve_reply", eventId: row.id, text })}>승인 · 0~5분 후 답변</button> : null}
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
    try { const result = await action(value); if (result.postId) { setPublished(result.postId); setNotice("게시글을 올리고 댓글을 예약했습니다. 사용자가 참여하면 최신 맥락으로 답변을 자동 재생성합니다."); } else setNotice("변경 사항을 저장했습니다."); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "저장에 실패했습니다."); }
    finally { setBusy(false); onBusy(false); }
  }
  return <fieldset disabled={busy || disabled} className="min-w-0"><section className="space-y-5 rounded-2xl border border-[var(--ui-border)] p-5 sm:p-6" aria-labelledby="publication-title">
    <h2 id="publication-title" className="home-section-title text-xl">4. 게시와 댓글 예약</h2>
    <p className="text-base leading-relaxed">게시글은 바로 올라갑니다. 첫 댓글과 이후 댓글 간격은 각각 0~5분 사이에서 초 단위로 무작위로 정해집니다. 예약을 재개할 때도 같은 방식으로 정해집니다. 브라우저를 닫아도 예약은 유지됩니다. 댓글에는 별도의 AI 캐릭터 문구를 붙이지 않습니다.</p>
    <button className={`${button} bg-[var(--ui-ink)] text-[var(--ui-surface)]`} disabled={busy || disabled || !draft} onClick={() => void run({ action: "publish", draft })}>{busy ? "처리 중…" : "검토한 초안 게시 + 댓글 예약"}</button>
    {error ? <p role="alert" className="whitespace-pre-wrap text-base text-red-400">{error}</p> : null}
    {notice ? <p role="status" className="text-base">{notice}</p> : null}
    {published ? <a className="block text-base underline" href={`/community/post/${published}`} target="_blank" rel="noreferrer">게시된 글 보기</a> : null}
    <div className="flex flex-wrap items-center gap-3 border-t border-[var(--ui-border)] pt-5">
      <h3 className="text-lg font-bold">예약 관리</h3>
      <button className={button} disabled={busy} onClick={() => void refresh()}>새로고침</button>
      <button className={button} disabled={busy} onClick={() => void run({ action: "pause_all" })}>모든 예약 일시정지</button>
    </div>
    {data?.campaigns.map(c => {
      const rows = data.queue.filter(q => q.post_id === c.post_id).sort((a, b) => a.ordinal - b.ordinal);
      const remaining = rows.filter(q => !["published", "cancelled"].includes(q.status));
      const completed = rows.length > 0 && rows.every(q => q.status === "published");
      const autoPending = c.auto_reply_enabled && c.state === "active" && data.inbox.some(i => i.post_id === c.post_id);
      const pauseReason = c.state === "paused" && remaining.length > 0
        ? remaining.find(q => q.status === "failed")?.error ?? remaining.find(q => q.error)?.error ?? "관리자 일시정지 또는 AI 글·댓글 수정/삭제로 중단된 예약입니다. 내용을 확인한 뒤 재개해 주세요."
        : null;
      return <details key={c.post_id} className="space-y-3 rounded-xl border border-[var(--ui-border)] p-4">
        <summary className="cursor-pointer text-base font-medium">{c.community_posts?.title ?? "게시글"} · {autoPending ? "자동 재생성 대기" : completed ? "게시 완료" : rows.length > 0 && !remaining.length ? "예약 종료" : stateName[c.state]} · {rows.filter(q => q.status === "published").length}/{rows.length}개 게시 · 자동 답변 {c.auto_reply_enabled && c.state === "active" ? "켜짐" : "꺼짐"}</summary>
        {pauseReason ? <p className="mt-3 text-base leading-relaxed">중단 사유: {pauseReason}</p> : null}
        <div className="mt-3 flex flex-wrap gap-2"><a href={`/community/post/${c.post_id}`} target="_blank" rel="noreferrer" className={button}>게시글 보기</a>{([['pause', '일시정지'], ['resume', '자동 답변·예약 재개'], ['cancel', '남은 예약 취소']] as const).map(([act, label]) => <button key={act} className={button} disabled={busy || c.state === "cancelled"} onClick={() => void run({ action: act, postId: c.post_id })}>{label}</button>)}</div>
        {rows.map(q => <QueueEditor key={`${q.id}:${q.content}:${q.due_at}`} row={q} busy={busy} run={run} />)}
      </details>;
    })}
    {data && !data.campaigns.length ? <p className="text-base text-[var(--ui-muted)]">예약된 대화가 없습니다.</p> : null}
    <h3 className="border-t border-[var(--ui-border)] pt-5 text-lg font-bold">사용자 참여 자동 답변</h3>
    <p className="text-base leading-relaxed">AI 글에 사용자가 참여하면 이전 예약을 교체하고 최신 맥락으로 답변을 자동 생성합니다. 생성은 1분마다 확인하며, 생성 후 0~5분 사이에 게시합니다. 새 댓글이 오면 다시 생성하고, 오류는 자동 재시도합니다. 관리자가 일시정지·취소한 글은 자동으로 재개하지 않습니다.</p>
    {data ? <label className="flex items-center gap-2 text-base"><input type="checkbox" checked={data.settings.watch_enabled} disabled={busy} onChange={e => void run({ action: "watch", enabled: e.target.checked })} />새 사용자 참여 감지 및 자동 답변 켜기</label> : null}
    {data?.inbox.map(row => data.campaigns.some(c => c.post_id === row.post_id && c.auto_reply_enabled && c.state === "active")
      ? <article key={row.id} className="space-y-2 rounded-xl border border-[var(--ui-border)] p-4">
        <a href={`/community/post/${row.post_id}`} target="_blank" rel="noreferrer" className="text-base font-bold underline">{row.community_posts?.title ?? "대화 보기"}</a>
        <p className="text-base">{data.settings.watch_enabled ? row.last_error ? "자동 재시도 대기" : "최신 대화로 답변을 자동 생성하고 있습니다." : "자동 답변이 꺼져 있습니다."}</p>
        {row.last_error ? <p className="text-base text-red-400">{row.last_error}</p> : null}
      </article>
      : <ReplyEditor key={`${row.id}:${row.response_text}`} row={row} busy={busy} run={run} />)}
    {data && !data.inbox.length ? <p className="text-base text-[var(--ui-muted)]">처리 중인 새 참여가 없습니다.</p> : null}
  </section></fieldset>;
}
