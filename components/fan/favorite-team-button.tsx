"use client";

import { Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setFavoriteTeamAction } from "@/app/fan/[teamSlug]/actions";
import { FanHeaderTooltip, fanHeaderIconButtonClass } from "@/components/fan/fan-header-control-styles";
import { useToast } from "@/components/ui/toast";

export function FavoriteTeamButton({
  teamId,
  teamSlug,
  teamName,
  initialFavorite,
  className = fanHeaderIconButtonClass,
}: {
  teamId: string;
  teamSlug: string;
  teamName: string;
  initialFavorite: boolean;
  className?: string;
}) {
  const [favorite, setFavorite] = useState(initialFavorite);
  const [serverFavorite, setServerFavorite] = useState(initialFavorite);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const { showToast } = useToast();

  if (serverFavorite !== initialFavorite) {
    setServerFavorite(initialFavorite);
    setFavorite(initialFavorite);
  }

  function toggleFavorite() {
    const nextFavorite = !favorite;
    setFavorite(nextFavorite);
    startTransition(async () => {
      const result = await setFavoriteTeamAction(teamId, teamSlug, nextFavorite);
      if (!result.ok) {
        setFavorite(!nextFavorite);
        showToast({ title: "최애팀 설정 실패", description: result.error ?? "잠시 뒤 다시 시도해 주세요.", tone: "error" });
        return;
      }
      setFavorite(result.favorite);
      showToast({
        title: result.favorite ? `${teamName}, 내 최애팀` : "최애팀 설정 해제",
        description: result.favorite ? "자동으로 팔로우했고 중앙 독에 팀 로고를 표시합니다." : "팬 허브에서 다른 최애팀을 선택할 수 있어요.",
        tone: "success",
      });
      router.refresh();
    });
  }

  return (
    <button type="button" onClick={toggleFavorite} disabled={pending} aria-pressed={favorite} aria-label={favorite ? `${teamName} 최애팀 해제` : `${teamName} 최애팀 설정`} className={className} style={favorite ? { color: "var(--team-accent-text)" } : undefined}>
      <Star size={17} fill={favorite ? "currentColor" : "none"} strokeWidth={2.3} aria-hidden="true" />
      <FanHeaderTooltip>{favorite ? "최애팀 해제" : "최애팀 설정"}</FanHeaderTooltip>
    </button>
  );
}
