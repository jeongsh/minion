"use client";

import { useTransition, useState } from "react";
import { toggleFanAction, checkinAction } from "@/app/fan/[teamSlug]/actions";

export function FanEngagementBar({
  teamId,
  teamSlug,
  popularity,
  fanCount,
  isFan: initialIsFan,
  isCheckedInToday: initialCheckedIn,
}: {
  teamId: string;
  teamSlug: string;
  popularity: number;
  fanCount: number;
  isFan: boolean;
  isCheckedInToday: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [isFan, setIsFan] = useState(initialIsFan);
  const [isCheckedIn, setIsCheckedIn] = useState(initialCheckedIn);
  const [localPopularity, setLocalPopularity] = useState(popularity);
  const [localFanCount, setLocalFanCount] = useState(fanCount);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function showToast(message: string, type: "success" | "error") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  function handleFan() {
    startTransition(async () => {
      const result = await toggleFanAction(teamId, teamSlug);
      if (result.ok) {
        if (result.isFan) {
          setIsFan(true);
          setLocalPopularity((p) => p + 5);
          setLocalFanCount((c) => c + 1);
          showToast("팬이 되었어요! 인기도 +5", "success");
        } else {
          setIsFan(false);
          setLocalPopularity((p) => Math.max(0, p - 5));
          setLocalFanCount((c) => Math.max(0, c - 1));
          showToast("팬을 취소했어요.", "success");
        }
      } else {
        showToast(result.error ?? "오류가 발생했어요.", "error");
      }
    });
  }

  function handleCheckin() {
    startTransition(async () => {
      const result = await checkinAction(teamId, teamSlug);
      if (result.ok) {
        setIsCheckedIn(true);
        setLocalPopularity((p) => p + 1);
        showToast("출석체크 완료! 인기도 +1", "success");
      } else {
        showToast(result.error ?? "오류가 발생했어요.", "error");
      }
    });
  }

  return (
    <div className="relative">
      {/* 토스트 알림 */}
      {toast && (
        <div
          className={`absolute -top-12 left-0 right-0 flex justify-center transition-opacity ${
            toast ? "opacity-100" : "opacity-0"
          }`}
        >
          <span
            className={`rounded-full px-4 py-1.5 text-sm font-bold shadow-lg ${
              toast.type === "success"
                ? "bg-white/90 text-green-700"
                : "bg-white/90 text-red-600"
            }`}
          >
            {toast.message}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {/* 인기도 */}
        <div className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/25 px-4 py-2.5 backdrop-blur-sm">
          <span className="text-xs font-bold text-white/60">인기도</span>
          <span className="text-xl font-black text-white tabular-nums">
            {localPopularity.toLocaleString()}
          </span>
        </div>

        {/* 팬 버튼 */}
        <button
          type="button"
          onClick={handleFan}
          disabled={isPending}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition-all disabled:opacity-60 ${
            isFan
              ? "bg-accent text-white shadow-md shadow-accent/30"
              : "border border-white/40 bg-black/20 text-white hover:border-accent hover:bg-accent/20 hover:text-accent"
          }`}
        >
          <span className="text-base leading-none">{isFan ? "♥" : "♡"}</span>
          <span>{isFan ? "팬" : "팬 되기"}</span>
          {localFanCount > 0 && (
            <span className={`rounded-full px-2 py-0.5 text-xs ${isFan ? "bg-white/20" : "bg-white/10"}`}>
              {localFanCount.toLocaleString()}
            </span>
          )}
        </button>

        {/* 출석체크 버튼 */}
        <button
          type="button"
          onClick={handleCheckin}
          disabled={isPending || isCheckedIn}
          className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black transition-all disabled:opacity-60 ${
            isCheckedIn
              ? "border border-white/20 bg-black/20 text-white/50 cursor-default"
              : "border border-white/40 bg-black/20 text-white hover:border-white/80 hover:bg-white/10"
          }`}
        >
          <span className="text-base leading-none">{isCheckedIn ? "✓" : "☀"}</span>
          <span>{isCheckedIn ? "출석완료" : "출석체크"}</span>
        </button>
      </div>
    </div>
  );
}
