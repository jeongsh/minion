"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formControlClassName } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { sendMessageAction, updateMessageAction } from "@/lib/messages/actions";
import type { DirectMessage } from "@/lib/messages/queries";

type Recipient = { id: string; nickname: string };
const date = (value: string) => new Intl.DateTimeFormat("ko-KR", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Seoul" }).format(new Date(value));

export function Mailbox({ box, messages, recipient }: { box: "inbox" | "sent"; messages: DirectMessage[]; recipient: Recipient | null }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  const [draftRecipient, setDraftRecipient] = useState(recipient);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && !pending) router.refresh(); }, 30000);
    return () => window.clearInterval(timer);
  }, [router, pending]);

  function openMessage(message: DirectMessage) {
    setSelected(selected === message.id ? null : message.id);
    if (selected !== message.id && box === "inbox" && !message.read_at) {
      startTransition(async () => {
        try {
          const result = await updateMessageAction({ id: message.id, operation: "read" });
          if (!result.ok) showToast({ title: result.error, tone: "error" });
          else { router.refresh(); window.dispatchEvent(new Event("minion:messages-updated")); }
        } catch { showToast({ title: "읽음 상태를 저장하지 못했습니다.", tone: "error" }); }
      });
    }
  }

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
        <ul className="divide-y divide-[var(--ui-border)]">
          {messages.map((message) => {
            const person = box === "inbox" ? message.sender : message.recipient;
            const personId = box === "inbox" ? message.sender_id : message.recipient_id;
            const open = selected === message.id;
            return (
              <li key={message.id} className="min-w-0 py-1">
                <button type="button" disabled={pending} onClick={() => openMessage(message)} aria-expanded={open} aria-controls={`message-${message.id}`} className="w-full min-w-0 rounded-lg px-3 py-4 text-left hover:bg-[var(--ui-card-hover)] focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60">
                  <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                    <span className="min-w-0 break-all text-base font-bold text-[var(--ui-ink)]">{person?.nickname ?? "알 수 없는 사용자"}</span>
                    <span className="flex shrink-0 items-center gap-2 text-[13px] font-normal text-[var(--ui-muted)]">
                      {box === "inbox" && !message.read_at ? <span className="text-[var(--accent)]">안 읽음</span> : null}
                      <time dateTime={message.created_at}>{date(message.created_at)}</time>
                    </span>
                  </span>
                  {!open ? <span className="mt-1 block truncate text-base font-normal text-[var(--ui-muted)]">{message.body}</span> : null}
                </button>
                {open ? <div id={`message-${message.id}`} className="space-y-4 px-3 pb-5">
                  <p className="whitespace-pre-wrap break-words text-base font-normal leading-relaxed text-[var(--ui-ink)] [overflow-wrap:anywhere]">{message.body}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" disabled={pending} onClick={() => { setDraftRecipient({ id: personId, nickname: person?.nickname ?? "사용자" }); setBody(""); setError(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}>{box === "inbox" ? "답장" : "쪽지 보내기"}</Button>
                    <Link href={`/community/user/${personId}`} className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-[var(--ui-muted)] hover:text-[var(--ui-ink)]">프로필</Link>
                    <Button variant="secondary" disabled={pending} onClick={() => {
                      if (!window.confirm("내 쪽지함에서 삭제할까요? 상대방의 쪽지는 유지됩니다.")) return;
                      startTransition(async () => {
                        try {
                          const result = await updateMessageAction({ id: message.id, operation: "delete" });
                          if (!result.ok) { showToast({ title: result.error, tone: "error" }); return; }
                          setSelected(null); router.refresh();
                          window.dispatchEvent(new Event("minion:messages-updated"));
                          showToast({ title: "내 쪽지함에서 삭제했습니다.", tone: "success" });
                        } catch { showToast({ title: "쪽지를 삭제하지 못했습니다.", tone: "error" }); }
                      });
                    }}>삭제</Button>
                  </div>
                </div> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
