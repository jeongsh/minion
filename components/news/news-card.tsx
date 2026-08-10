"use client";

import { useState } from "react";
import { NewsThumbnail } from "@/components/news/news-thumbnail";
import { formatNewsDate, type NewsArticle } from "@/lib/data/news";

export function NewsCard({
  article,
  size = "page",
}: {
  article: NewsArticle;
  size?: "page" | "home";
}) {
  const home = size === "home";
  const [hasThumbnail, setHasThumbnail] = useState(Boolean(article.thumbnailUrl));

  if (home) {
    return (
      <a
        href={article.url}
        target="_blank"
        rel="noopener noreferrer"
        className={`group grid min-w-0 items-center gap-3 ${hasThumbnail ? "grid-cols-[76px_minmax(0,1fr)]" : "grid-cols-1"}`}
      >
        {hasThumbnail ? <NewsThumbnail article={article} onError={() => setHasThumbnail(false)} className="h-16 w-full rounded-lg" /> : null}
        <div className="flex min-w-0 flex-col">
          <h3 className="font-paperozi line-clamp-2 text-[14px] font-bold leading-[1.5] tracking-[-0.02em] text-[var(--ui-ink)] group-hover:underline">
            {article.title}
          </h3>
          <div className="mt-auto flex min-w-0 items-center gap-1.5 pt-1 text-[12px] font-semibold text-[var(--ui-muted)]">
            <span className="truncate">{article.source}</span>
            <span aria-hidden>·</span>
            <time className="shrink-0" dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time>
          </div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group grid min-w-0 gap-3 rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 transition-colors duration-200 motion-reduce:transition-none dark:bg-[var(--ui-surface-muted)] sm:gap-5 lg:p-4 ${hasThumbnail ? "grid-cols-[108px_minmax(0,1fr)] sm:grid-cols-[196px_minmax(0,1fr)]" : "grid-cols-1"}`}
    >
      {hasThumbnail ? <NewsThumbnail article={article} onError={() => setHasThumbnail(false)} className="aspect-[4/3] max-h-[118px] w-full rounded-lg sm:aspect-[16/10]" /> : null}
      <div className="flex min-w-0 flex-col py-0.5">
        <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-[var(--ui-muted)]">
          <span className="truncate text-[var(--ui-ink)]">{article.source}</span>
          <time className="ml-auto shrink-0" dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time>
        </div>
        <h3 className="font-paperozi mt-1.5 line-clamp-2 text-[16px] font-bold leading-[1.4] tracking-[-0.025em] text-[var(--ui-ink)] group-hover:underline sm:text-[18px]">
          {article.title}
        </h3>
        <p className="mt-2 hidden line-clamp-2 text-[13px] leading-[1.65] text-[var(--ui-muted)] sm:block">{article.summary}</p>
      </div>
    </a>
  );
}
