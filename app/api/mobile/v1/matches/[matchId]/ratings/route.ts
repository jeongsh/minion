import { after } from "next/server";

import type { MobileFanRatingMutationDto } from "@/packages/contracts/src/mobile-v1";
import { moderateFanRatingReview, submitFanRating } from "@/lib/fan-rating-submission";
import { mobileError, mobileSuccess } from "@/lib/mobile/api-response";
import { getMobileAuth } from "@/lib/mobile/auth";

export const dynamic = "force-dynamic";

const CLIENT_ERRORS = [
  "평점을 제출할 세트와 선수를 확인해주세요.",
  "평점은 1.0점부터 5.0점까지 입력해주세요.",
  "평점은 0.5점 단위로 입력해주세요.",
  "세트를 찾을 수 없습니다.",
  "세트 결과가 기록된 뒤부터 평점을 입력할 수 있습니다.",
  "해당 세트의 평점 대상 선수가 아닙니다.",
];

export async function POST(request: Request, context: { params: Promise<{ matchId: string }> }) {
  const auth = await getMobileAuth(request);
  if (!auth) return mobileError("UNAUTHENTICATED", "로그인이 필요합니다.", 401);

  const installationId = request.headers.get("x-minion-installation-id")?.trim();
  if (!installationId) return mobileError("BAD_REQUEST", "앱 설치 식별자가 필요합니다.", 400);

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const { matchId } = await context.params;
  try {
    const saved = await submitFanRating({
      matchId,
      playerId: typeof body?.playerId === "string" ? body.playerId : "",
      rating: body?.rating,
      review: body?.review,
      setId: typeof body?.setId === "string" ? body.setId : "",
      userId: auth.user.id,
      voterKey: `mobile:${installationId}:${auth.user.id}`,
    });

    if (saved.review) {
      after(async () => {
        try {
          await moderateFanRatingReview(saved.ratingId, saved.review!);
        } catch (error) {
          console.warn("[mobile-fan-rating-moderation] AI 검수 실패", error);
        }
      });
    }

    const data: MobileFanRatingMutationDto = { playerId: String(body?.playerId), rating: saved.rating };
    return mobileSuccess(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "평점 제출에 실패했습니다.";
    if (message === "커뮤니티 이용이 영구 제한된 계정입니다.") {
      return mobileError("FORBIDDEN", message, 403);
    }
    if (message.startsWith("리뷰는 ") || message.startsWith("금칙어(") || CLIENT_ERRORS.includes(message)) {
      return mobileError("BAD_REQUEST", message, 400);
    }
    console.error("[mobile-fan-rating] 평점 제출 실패", error);
    return mobileError("INTERNAL", "평점 제출에 실패했습니다.", 500);
  }
}
