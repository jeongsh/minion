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
        className={`group grid min-w-0 items-center gap-2.5 min-[390px]:gap-3 ${hasThumbnail ? "grid-cols-[68px_minmax(0,1fr)] min-[390px]:grid-cols-[76px_minmax(0,1fr)]" : "grid-cols-1"}`}
      >
        {hasThumbnail ? <NewsThumbnail article={article} onError={() => setHasThumbnail(false)} className="aspect-[4/3] w-full rounded-md min-[390px]:rounded-lg" /> : null}
        <div className="flex min-w-0 flex-col">
          <h3 className="line-clamp-2 text-[12px] font-medium leading-[1.45] tracking-[-0.02em] text-[var(--ui-ink)] group-hover:underline sm:text-[14px] sm:leading-[1.5]">
            <span className="sm:font-paperozi sm:font-bold">{article.title}</span>
          </h3>
          <div className="mt-auto flex min-w-0 items-center gap-1 pt-0.5 text-[10.5px] font-medium text-[var(--ui-muted)] min-[390px]:gap-1.5 min-[390px]:pt-1 min-[390px]:text-[12px]">
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
      className={`group grid min-w-0 gap-2.5 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-2 transition-colors duration-200 motion-reduce:transition-none dark:bg-[var(--ui-surface-muted)] min-[390px]:gap-3 min-[390px]:p-2.5 sm:gap-5 sm:rounded-2xl sm:p-3 lg:p-4 ${hasThumbnail ? "grid-cols-[72px_minmax(0,1fr)] min-[390px]:grid-cols-[84px_minmax(0,1fr)] sm:grid-cols-[196px_minmax(0,1fr)]" : "grid-cols-1"}`}
    >
      {hasThumbnail ? <NewsThumbnail article={article} onError={() => setHasThumbnail(false)} className="aspect-[4/3] w-full rounded-md sm:aspect-[16/10] sm:max-h-[118px] sm:rounded-lg" /> : null}
      <div className="flex min-w-0 flex-col py-0.5">
        <div className="flex min-w-0 items-center gap-1 text-[10.5px] font-medium text-[var(--ui-muted)] min-[390px]:text-[11px] sm:gap-1.5 sm:text-[12px]">
          <span className="truncate text-[var(--ui-ink)]">{article.source}</span>
          <time className="ml-auto shrink-0" dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time>
        </div>
        <h3 className="mt-1 line-clamp-2 text-[12px] font-medium leading-[1.45] tracking-[-0.02em] text-[var(--ui-ink)] group-hover:underline min-[390px]:mt-1.5 sm:text-[18px] sm:leading-[1.4] sm:tracking-[-0.025em]">
          <span className="sm:font-paperozi sm:font-bold">{article.title}</span>
        </h3>
        <p className="mt-2 hidden line-clamp-2 text-[13px] leading-[1.65] text-[var(--ui-muted)] sm:block">{article.summary}</p>
      </div>
    </a>
  );
}
