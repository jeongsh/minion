"use client";

import { useActionState, useEffect } from "react";

import flag from "@/assets/characters/flag-3.png";
import { useToast } from "@/components/ui/toast";
import { INITIAL_ATTENDANCE_STATE } from "@/lib/auth/action-state";
import { checkInAction } from "@/lib/auth/actions";

const CONFETTI_PARTICLES = [
  { x: "-38px", y: "-22px", delay: "0ms" },
  { x: "-22px", y: "-38px", delay: "35ms" },
  { x: "4px", y: "-44px", delay: "20ms" },
  { x: "30px", y: "-34px", delay: "55ms" },
  { x: "42px", y: "-14px", delay: "15ms" },
  { x: "-32px", y: "14px", delay: "45ms" },
  { x: "28px", y: "18px", delay: "65ms" },
];

export function CheckInButton({ alreadyChecked }: { alreadyChecked: boolean }) {
  const { showToast } = useToast();
  const [state, formAction, pending] = useActionState(
    checkInAction,
    INITIAL_ATTENDANCE_STATE,
  );

  const done = alreadyChecked || state.status === "success" || state.status === "already";
  const justChecked = state.status === "success";

  useEffect(() => {
    if (!justChecked) return;
    showToast({
      title: "출석 도장 쾅!",
      description: "+10 LP 적립 완료",
      tone: "success",
      iconSrc: flag.src,
    });
  }, [justChecked, showToast]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="relative">
        {justChecked ? (
          <span className="check-in-confetti" aria-hidden>
            {CONFETTI_PARTICLES.map((particle, index) => (
              <span
                key={index}
                style={
                  {
                    "--confetti-x": particle.x,
                    "--confetti-y": particle.y,
                    "--confetti-delay": particle.delay,
                  } as React.CSSProperties
                }
              />
            ))}
          </span>
        ) : null}
        <button
          type="submit"
          disabled={pending || done}
          className={`relative min-h-11 w-full rounded-lg px-4 text-sm font-bold text-[var(--accent-foreground)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70 ${
            justChecked ? "kitsch-pop" : ""
          }`}
          style={{ backgroundColor: "var(--accent)" }}
        >
          {done ? "오늘 출석 완료" : pending ? "처리 중..." : "출석체크 (+10 LP)"}
        </button>
      </div>
      {state.message && state.status !== "success" ? (
        <p
          role="status"
          className="text-sm"
          style={{
            color: state.status === "error" ? "#dc2626" : "var(--muted)",
          }}
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
