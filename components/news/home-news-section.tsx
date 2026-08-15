"use client";

import { useState } from "react";
import { NewsCard } from "@/components/news/news-card";
import { NewsThumbnail } from "@/components/news/news-thumbnail";
import { SectionHeading } from "@/components/ui/section-heading";
import { formatNewsDate, type NewsArticle } from "@/lib/data/news";

function isOsenArticle(article: NewsArticle) {
  if (article.source.trim().toLocaleLowerCase("ko-KR") === "osen") return true;

  try {
    const hostname = new URL(article.url).hostname.toLowerCase().replace(/^www\./, "");
    return hostname === "osen.co.kr" || hostname.endsWith(".osen.co.kr");
  } catch {
    return false;
  }
}

function LeadNewsCard({ article }: { article: NewsArticle }) {
  const [hasThumbnail, setHasThumbnail] = useState(Boolean(article.thumbnailUrl));

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block min-w-0"
    >
      {hasThumbnail ? <NewsThumbnail article={article} priority onError={() => setHasThumbnail(false)} className="aspect-[16/9] max-h-[300px] w-full rounded-xl md:max-h-[260px] lg:max-h-[250px] xl:max-h-[300px]" /> : null}
      <div className={hasThumbnail ? "mt-3.5" : ""}>
        <h3 className="font-paperozi line-clamp-2 text-[17px] font-black leading-[1.38] tracking-[-0.035em] text-[var(--ui-ink)] group-hover:underline sm:text-[19px]">
          {article.title}
        </h3>
        <p className="mt-2 hidden line-clamp-2 text-[12px] leading-[1.65] text-[var(--ui-muted)] lg:block lg:text-[13px]">
          {article.summary}
        </p>
        <div className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-[var(--ui-muted)]">
          <span className="text-[var(--ui-ink)]">{article.source}</span>
          <span aria-hidden>·</span>
          <time dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time>
        </div>
      </div>
    </a>
  );
}

export function HomeNewsSection({ articles }: { articles: NewsArticle[] }) {
  if (articles.length === 0) return null;
  const lead = articles.find((article) => !isOsenArticle(article));
  const secondary = lead
    ? articles.filter((article) => article.id !== lead.id)
    : articles;

  return (
    <section aria-labelledby="home-news-heading">
      <SectionHeading href="/news">
        <span id="home-news-heading">LCK 뉴스</span>
      </SectionHeading>
      <div className={`grid gap-5 rounded-2xl border border-[var(--ui-card-divider)] p-3 sm:p-4 ${lead ? "lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)] lg:gap-8" : ""}`}>
        {lead ? <LeadNewsCard article={lead} /> : null}
        <div className="grid content-start lg:py-1">
          {secondary.map((article, index) => (
            <div
              key={article.id}
              className={`${index >= 3 ? "hidden lg:block" : "block"} ${index >= 4 ? "lg:hidden xl:block" : ""} border-b border-[var(--ui-card-divider)] py-3 first:pt-0 ${index === 2 ? "border-b-0 pb-0 lg:border-b lg:pb-3" : ""} ${index === secondary.length - 1 ? "xl:border-b-0 xl:pb-0" : ""}`}
            >
              <NewsCard article={article} size="home" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
