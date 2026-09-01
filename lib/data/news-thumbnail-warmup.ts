import "server-only";

import { after } from "next/server";
import type { NewsArticle } from "@/lib/data/news";
import { warmNewsThumbnails } from "@/lib/data/news-thumbnail-cache";
import { isR2Url } from "@/lib/storage/r2";

/**
 * 화면 응답을 먼저 보낸 뒤 누락된 뉴스 썸네일을 R2에 채운다.
 * 이미 영구 URL이 붙은 피드는 작업 자체를 예약하지 않는다.
 */
export function scheduleNewsThumbnailWarmup(articles: NewsArticle[]) {
  const pending = articles.filter((article) => !article.thumbnailUrl || !isR2Url(article.thumbnailUrl));
  if (pending.length === 0) return;

  after(async () => {
    const result = await warmNewsThumbnails(pending);
    if (result.failed > 0) {
      console.warn("[news-thumbnail] warmup incomplete", result);
    }
  });
}
