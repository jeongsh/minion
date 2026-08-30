"use client";

import { useState } from "react";
import { NewsCard } from "@/components/news/news-card";
import { NewsThumbnail } from "@/components/news/news-thumbnail";
import { useNewsThumbnail } from "@/components/news/use-news-thumbnail";
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
  const { pending, src } = useNewsThumbnail(article.url, article.thumbnailUrl);
  const [errored, setErrored] = useState(false);
  const showThumbnail = !errored && (pending || Boolean(src));
  const thumbClassName = "aspect-[16/9] max-h-[300px] w-full rounded-lg sm:rounded-xl md:max-h-[260px] lg:max-h-[250px] xl:max-h-[300px]";

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block min-w-0"
    >
      {showThumbnail ? (
        src
          ? <NewsThumbnail article={article} src={src} priority onError={() => setErrored(true)} className={thumbClassName} />
          : <div className={`animate-pulse bg-[var(--ui-card-bg)] ${thumbClassName}`} />
      ) : null}
      <div className={showThumbnail ? "mt-2.5 sm:mt-3.5" : ""}>
        <h3 className="font-paperozi line-clamp-2 text-[14px] !font-bold leading-[1.4] tracking-[-0.035em] text-[var(--ui-ink)] group-hover:underline sm:text-[19px]">
          {article.title}
        </h3>
        <p className="mt-2 hidden line-clamp-2 text-[12px] leading-[1.65] text-[var(--ui-muted)] lg:block lg:text-[13px]">
          {article.summary}
        </p>
        <div className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-[var(--ui-muted)] min-[390px]:mt-2 min-[390px]:gap-1.5 min-[390px]:text-[12px]">
          <span className="text-[var(--ui-ink)]">{article.source}</span>
          <span aria-hidden>·</span>
          <time dateTime={article.publishedAt}>{formatNewsDate(article.publishedAt)}</time>
        </div>
      </div>
    </a>
  );
}

export function NewsFeedLayout({
  articles,
  cardSize = "home",
  compact = false,
  featured = true,
}: {
  articles: NewsArticle[];
  cardSize?: "home" | "news";
  compact?: boolean;
  featured?: boolean;
}) {
  if (articles.length === 0) return null;

  const lead = featured
    ? articles.find((article) => !isOsenArticle(article))
    : undefined;
  const secondary = lead
    ? articles.filter((article) => article.id !== lead.id)
    : articles;

  return (
    <div className={`grid gap-4 min-[390px]:gap-5 ${lead ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,1fr)] lg:gap-8" : ""}`}>
      {lead ? <LeadNewsCard article={lead} /> : null}
      <div className="grid content-start lg:py-1">
        {secondary.map((article, index) => (
          <div
            key={article.id}
            className={`${compact && index >= 3 ? "hidden lg:block" : "block"} ${compact && index >= 4 ? "lg:hidden xl:block" : ""} border-b border-[var(--ui-card-divider)] py-2.5 first:pt-0 min-[390px]:py-3 ${compact && index === 2 ? "border-b-0 pb-0 lg:border-b lg:pb-3" : ""} ${index === secondary.length - 1 ? "border-b-0 pb-0" : ""}`}
          >
            <NewsCard article={article} size={cardSize} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomeNewsSection({ articles }: { articles: NewsArticle[] }) {
  if (articles.length === 0) return null;

  return (
    <section aria-labelledby="home-news-heading">
      <SectionHeading href="/news">
        <span id="home-news-heading">LCK 뉴스</span>
      </SectionHeading>
      <NewsFeedLayout articles={articles} compact />
    </section>
  );
}
