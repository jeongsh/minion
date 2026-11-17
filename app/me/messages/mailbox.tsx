"use client";

import Link from "next/link";
import { Reply, Send, Trash2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formControlClassName } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { sendMessageAction, updateMessageAction } from "@/lib/messages/actions";
import type { DirectMessage } from "@/lib/messages/queries";

type Recipient = { id: string; nickname: string };
const iconActionClassName = "grid h-10 w-10 shrink-0 place-items-center transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
const date = (value: string) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));

export function Mailbox({ box, messages, recipient }: { box: "inbox" | "sent"; messages: DirectMessage[]; recipient: Recipient | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLUListElement>(null);
  const readIds = useRef(new Set<string>());
  const [draftRecipient, setDraftRecipient] = useState(recipient);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && !pending) router.refresh(); }, 30000);
    return () => window.clearInterval(timer);
  }, [router, pending]);

  useEffect(() => {
    if (box !== "inbox" || !listRef.current) return;
    let active = true;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).map((entry) => entry.target.getAttribute("data-message-id")!)
        .filter((id) => !readIds.current.has(id));
      if (!visible.length) return;
      visible.forEach((id) => readIds.current.add(id));
      void Promise.all(visible.map(async (id) => {
        try {
          const result = await updateMessageAction({ id, operation: "read" });
          if (result.ok) return true;
        } catch { /* Keep failed receipts eligible for the next refresh. */ }
        readIds.current.delete(id);
        return false;
      })).then((results) => {
        if (!active) return;
        if (results.some(Boolean)) { router.refresh(); window.dispatchEvent(new Event("minion:messages-updated")); }
        if (results.includes(false)) showToast({ title: "읽음 상태를 저장하지 못했습니다.", tone: "error" });
      });
    }, { threshold: 0.1 });
    listRef.current.querySelectorAll("[data-unread]").forEach((element) => observer.observe(element));
    return () => { active = false; observer.disconnect(); };
  }, [box, messages, router, showToast]);

  return (
    <div className="space-y-5">
      {draftRecipient ? (
        <form className="space-y-3 rounded-xl bg-[var(--ui-card-bg)] p-4 sm:p-5" onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            try {
              const result = await sendMessageAction({ recipientId: draftRecipient.id, body });
              if (!result.ok) { setError(result.error); return; }
              setBody(""); setDraftRecipient(null);
              window.dispatchEvent(new Event("minion:messages-updated"));
              showToast({ title: "쪽지를 보냈습니다.", tone: "success" });
              router.push("/me/messages?box=sent"); router.refresh();
            } catch { setError("쪽지를 보내지 못했습니다. 다시 시도해주세요."); }
          });
        }}>
          <p className="break-words text-base font-bold text-[var(--ui-ink)]">{draftRecipient.nickname}님에게</p>
          <label htmlFor="message-body" className="sr-only">쪽지 내용</label>
          <textarea id="message-body" autoFocus required maxLength={2000} value={body} disabled={pending} onChange={(event) => setBody(event.target.value)} placeholder="쪽지 내용을 입력해주세요." aria-describedby={error ? "message-error" : undefined} aria-invalid={!!error} className={`${formControlClassName} !h-40 w-full resize-y p-3 text-base font-normal text-[var(--ui-ink)]`} />
          {error ? <p id="message-error" role="alert" className="text-base text-red-600">{error}</p> : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] font-normal text-[var(--ui-muted)]">{body.length.toLocaleString("ko-KR")} / 2,000</span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" disabled={pending} onClick={() => { setDraftRecipient(null); setError(null); }}>취소</Button>
              <Button type="submit" disabled={pending || !body.trim()}>{pending ? "보내는 중" : "보내기"}</Button>
            </div>
          </div>
        </form>
      ) : null}
      {messages.length === 0 ? <p className="py-12 text-center text-base text-[var(--ui-muted)]">{box === "inbox" ? "받은 쪽지가 없습니다." : "보낸 쪽지가 없습니다."}</p> : (
        <ul ref={listRef} className="divide-y divide-[var(--ui-border)]">
          {messages.map((message) => {
            const person = box === "inbox" ? message.sender : message.recipient;
            const personId = box === "inbox" ? message.sender_id : message.recipient_id;
            return (
              <li key={message.id} data-message-id={message.id} data-unread={box === "inbox" && !message.read_at ? "" : undefined} className="min-w-0 space-y-3 py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="break-all text-base font-bold text-[var(--ui-ink)]">{person?.nickname ?? "알 수 없는 사용자"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-normal text-[var(--ui-muted)]">
                      <time dateTime={message.created_at}>{date(message.created_at)}</time>
                      {box === "inbox" && !message.read_at ? <span className="text-[var(--accent)]">안 읽음</span> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center">
                    <button type="button" className={`${iconActionClassName} text-[var(--accent)]`} aria-label={box === "inbox" ? "답장" : "쪽지 보내기"} title={box === "inbox" ? "답장" : "쪽지 보내기"} disabled={pending} onClick={() => { setDraftRecipient({ id: personId, nickname: person?.nickname ?? "사용자" }); setBody(""); setError(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      {box === "inbox" ? <Reply size={16} aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
                    </button>
                    <Link href={`/community/user/${personId}`} aria-label="프로필 보기" title="프로필 보기" className={`${iconActionClassName} text-[var(--ui-muted)]`}><UserRound size={16} aria-hidden="true" /></Link>
                    <button type="button" aria-label="쪽지 삭제" title="쪽지 삭제" className={`${iconActionClassName} text-red-500 dark:text-red-400`} disabled={pending} onClick={() => {
                      if (!window.confirm("내 쪽지함에서 삭제할까요? 상대방의 쪽지는 유지됩니다.")) return;
                      startTransition(async () => {
                        try {
                          const result = await updateMessageAction({ id: message.id, operation: "delete" });
                          if (!result.ok) { showToast({ title: result.error, tone: "error" }); return; }
                          router.refresh();
                          window.dispatchEvent(new Event("minion:messages-updated"));
                          showToast({ title: "내 쪽지함에서 삭제했습니다.", tone: "success" });
                        } catch { showToast({ title: "쪽지를 삭제하지 못했습니다.", tone: "error" }); }
                      });
                    }}><Trash2 size={18} aria-hidden="true" /></button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap break-words text-base font-normal leading-relaxed text-[var(--ui-ink)] [overflow-wrap:anywhere]">{message.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
